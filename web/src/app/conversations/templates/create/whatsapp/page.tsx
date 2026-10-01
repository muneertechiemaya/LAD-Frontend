'use client';

import React, { useState, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Bold, Italic, Strikethrough, Code, Plus, Trash2,
  Upload, FileIcon, CheckCircle2, AlertCircle, Loader2,
  ChevronDown, Phone, Globe, MessageSquare, Play, ShieldCheck, Copy,
} from 'lucide-react';
import { fetchWithTenant } from '@/lib/fetch-with-tenant';
import { useWhatsAppAccounts } from '@lad/frontend-features/meta-onboarding';

// ── Types ────────────────────────────────────────────────────────────────────

type Category  = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
type MediaType = 'NONE' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
type ButtonType = 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
type MobileTab = 'details' | 'content' | 'preview';

/**
 * How the customer gets the code out of WhatsApp and into your app.
 *
 * COPY_CODE is the only one that needs nothing from the tenant, which is why it
 * is the default — the other two hand the code straight to an Android app and
 * are dead ends without one.
 */
type OtpType = 'COPY_CODE' | 'ONE_TAP' | 'ZERO_TAP';

interface SupportedApp {
  id:            string;
  packageName:   string;
  signatureHash: string;
}

/** The OTP button exactly as Meta's create-template API takes it. */
interface OtpButtonPayload {
  type:                     'OTP';
  otp_type:                 OtpType;
  supported_apps?:          { package_name: string; signature_hash: string }[];
  zero_tap_terms_accepted?: true;
}

interface TemplateButton {
  id:      string;
  type:    ButtonType;
  text:    string;
  url:     string;
  phone:   string;
  urlType: 'static' | 'dynamic';
}

// ── Constants ─────────────────────────────────────────────────────────────────

const LANGUAGES = [
  { code: 'en_US', label: 'English (US)' },
  { code: 'en',    label: 'English' },
  { code: 'ar',    label: 'Arabic' },
  { code: 'hi',    label: 'Hindi' },
  { code: 'ur',    label: 'Urdu' },
  { code: 'fr',    label: 'French' },
  { code: 'es',    label: 'Spanish' },
  { code: 'pt_BR', label: 'Portuguese (BR)' },
  { code: 'de',    label: 'German' },
  { code: 'id',    label: 'Indonesian' },
];

const CATEGORIES: { value: Category; label: string; color: string }[] = [
  { value: 'MARKETING',      label: 'Marketing',      color: 'bg-purple-100 text-purple-700 border-purple-200  dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-900/60' },
  { value: 'UTILITY',        label: 'Utility',        color: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/60'       },
  { value: 'AUTHENTICATION', label: 'Authentication', color: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-900/60' },
];

/**
 * Meta writes and localises every word of an authentication template, so these
 * are the exact strings the customer sees — reproduced here only so the preview
 * is honest. Editing them does not change the message; the template has no text
 * fields to send.
 *
 * https://developers.facebook.com/docs/whatsapp/business-management-api/authentication-templates
 */
const AUTH_BODY_COPY     = '{{1}} is your verification code.';
const AUTH_SECURITY_COPY = 'For your security, do not share this code.';
const authExpiryCopy = (mins: number) => `This code expires in ${mins} minutes.`;

const OTP_OPTIONS: { value: OtpType; label: string; desc: string; needsApp: boolean }[] = [
  { value: 'COPY_CODE', label: 'Copy code',
    desc: 'The customer taps to copy the code, then pastes it into your app or site. Works everywhere.',
    needsApp: false },
  { value: 'ONE_TAP',   label: 'One-tap autofill',
    desc: 'The customer taps once and WhatsApp hands the code to your Android app.',
    needsApp: true },
  { value: 'ZERO_TAP',  label: 'Zero-tap autofill',
    desc: 'Your Android app reads the code with no tap at all.',
    needsApp: true },
];

/**
 * Message validity — how long Meta keeps trying before it gives up.
 *
 * Meta's range for authentication templates is 30–900 seconds. A code that
 * arrives after it has expired is worse than one that never arrives, which is
 * why this is a short list of sane values rather than a free number field.
 */
const AUTH_TTL_OPTIONS: { value: string; label: string }[] = [
  { value: '',    label: "Meta's default (10 minutes)" },
  { value: '30',  label: '30 seconds' },
  { value: '60',  label: '1 minute' },
  { value: '120', label: '2 minutes' },
  { value: '300', label: '5 minutes' },
  { value: '600', label: '10 minutes' },
  { value: '900', label: '15 minutes' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 8); }

function extractVars(text: string): string[] {
  const matches = [...text.matchAll(/\{\{(\d+)\}\}/g)];
  const seen = new Set<string>();
  return matches.map(m => m[1]).filter(v => { if (seen.has(v)) return false; seen.add(v); return true; });
}

/** Render WhatsApp markdown (*bold*, _italic_, ~strike~) to HTML safely */
function renderWAMarkdown(text: string): string {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>')
    .replace(/_([^_\n]+)_/g,   '<em>$1</em>')
    .replace(/~([^~\n]+)~/g,   '<s>$1</s>')
    .replace(/`([^`\n]+)`/g,   '<code class="font-mono text-xs bg-slate-100  dark:bg-slate-800 px-0.5 rounded">$1</code>');
}

function WAText({ text }: { text: string }) {
  if (!text) return <span className="text-slate-400 dark:text-slate-500 italic text-xs">Body text appears here...</span>;
  return (
    <>
      {text.split('\n').map((line, i) => (
        <React.Fragment key={i}>
          {i > 0 && <br />}
          <span dangerouslySetInnerHTML={{ __html: renderWAMarkdown(line) }} />
        </React.Fragment>
      ))}
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ToolbarBtn({ icon, onClick, title }: { icon: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="p-1.5 rounded text-[#64748B] dark:text-gray-400 hover:bg-white dark:hover:bg-gray-800 hover:text-[#1E293B] dark:hover:text-white hover:shadow-sm transition-all"
    >
      {icon}
    </button>
  );
}

function ButtonRow({
  btn, onChange, onRemove,
}: {
  btn: TemplateButton;
  onChange: (p: Partial<TemplateButton>) => void;
  onRemove: () => void;
}) {
  const typeLabel =
    btn.type === 'QUICK_REPLY' ? 'Quick reply' :
    btn.type === 'URL'         ? 'Visit website' : 'Call phone';

  return (
    <div className="p-3 border border-[#E2E8F0] dark:border-gray-800 rounded-lg space-y-2 bg-[#FAFBFC] dark:bg-[#000724]">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-[#64748B] dark:text-gray-400 w-24 shrink-0">{typeLabel}</span>
        <span className="text-xs text-[#64748B] dark:text-slate-400 shrink-0">Button text</span>
        <input
          value={btn.text}
          onChange={e => onChange({ text: e.target.value })}
          placeholder="Button label"
          maxLength={25}
          className="flex-1 px-2 py-1.5 border border-[#E2E8F0] dark:border-gray-800 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#0b1957]/30 bg-white dark:bg-[#000c3b] text-gray-900 dark:text-white"
        />
        <span className="text-[10px] text-[#64748B] dark:text-slate-400 shrink-0">{btn.text.length}/25</span>
        <button type="button" onClick={onRemove} className="text-[#94A3B8] dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 p-1 transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {btn.type === 'URL' && (
        <div className="flex items-center gap-2 pl-24 flex-wrap">
          <span className="text-xs text-[#64748B] dark:text-slate-400 shrink-0">URL type</span>
          <select
            value={btn.urlType}
            onChange={e => onChange({ urlType: e.target.value as 'static' | 'dynamic' })}
            className="max-lg:min-h-11 max-md:text-[16px] px-2 py-1 border border-[#E2E8F0] dark:border-gray-800 rounded text-xs bg-white dark:bg-[#000c3b] text-gray-900 dark:text-white focus:outline-none"
          >
            <option value="static" className="dark:bg-[#000c3b]">Static</option>
            <option value="dynamic" className="dark:bg-[#000c3b]">Dynamic</option>
          </select>
          <span className="text-xs text-[#64748B] dark:text-slate-400 shrink-0">Website URL</span>
          <input
            type="url"
            value={btn.url}
            onChange={e => onChange({ url: e.target.value })}
            placeholder="https://example.com"
            className="flex-1 min-w-0 px-2 py-1.5 border border-[#E2E8F0] dark:border-gray-800 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#0b1957]/30 bg-white dark:bg-[#000c3b] text-gray-900 dark:text-white"
          />
          <span className="text-[10px] text-[#64748B] dark:text-slate-400 shrink-0">{btn.url.length}/2000</span>
        </div>
      )}

      {btn.type === 'PHONE_NUMBER' && (
        <div className="flex items-center gap-2 pl-24">
          <span className="text-xs text-[#64748B] dark:text-slate-400 shrink-0">Phone number</span>
          <input
            value={btn.phone}
            onChange={e => onChange({ phone: e.target.value })}
            placeholder="+971501234567"
            className="flex-1 px-2 py-1.5 border border-[#E2E8F0] dark:border-gray-800 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#0b1957]/30 bg-white dark:bg-[#000c3b] text-gray-900 dark:text-white"
          />
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

/**
 * The whole editable surface of an authentication template.
 *
 * Deliberately NOT a variant of the body editor beside it. Meta writes and
 * localises every word of an authentication message, so there is no text to
 * type: what the tenant chooses is how the code is delivered, whether the
 * security line is appended, and how long the code lasts. Offering a body
 * textarea here — which is what this form did before — collects work Meta
 * discards and then rejects the submission for it.
 */
function AuthenticationFields({
  otpType, onOtpType,
  addSecurityRec, onAddSecurityRec,
  useCodeExpiry, onUseCodeExpiry,
  codeExpiryMins, onCodeExpiryMins,
  ttl, onTtl,
  apps, onApps,
}: {
  otpType: OtpType;
  onOtpType: (v: OtpType) => void;
  addSecurityRec: boolean;
  onAddSecurityRec: (v: boolean) => void;
  useCodeExpiry: boolean;
  onUseCodeExpiry: (v: boolean) => void;
  codeExpiryMins: number;
  onCodeExpiryMins: (v: number) => void;
  ttl: string;
  onTtl: (v: string) => void;
  apps: SupportedApp[];
  onApps: (v: SupportedApp[]) => void;
}) {
  const needsApp = OTP_OPTIONS.find(o => o.value === otpType)?.needsApp ?? false;

  return (
    <div className="space-y-6">

      {/* ── What Meta will send, so nobody goes looking for the body field ── */}
      <div className="flex gap-3 p-4 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/70 dark:bg-blue-950/20">
        <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">Meta writes this message</p>
          <p className="text-xs text-blue-800/80 dark:text-blue-300/80 mt-1 leading-relaxed">
            Authentication templates use fixed wording that Meta translates into every language you
            get approved — so there is no body, footer or button text to write. Approval is usually
            quick for the same reason.
          </p>
          <div className="mt-3 rounded-lg bg-white dark:bg-[#000724] border border-blue-100 dark:border-blue-900/40 px-3 py-2.5">
            <p className="text-sm text-[#1E293B] dark:text-gray-200 leading-relaxed">
              {AUTH_BODY_COPY}{addSecurityRec ? ` ${AUTH_SECURITY_COPY}` : ''}
            </p>
            {useCodeExpiry && (
              <p className="text-xs text-slate-400 dark:text-gray-500 mt-1.5">{authExpiryCopy(codeExpiryMins)}</p>
            )}
          </div>
          <p className="text-[11px] text-blue-700/70 dark:text-blue-400/70 mt-2">
            <code className="font-mono">{'{{1}}'}</code> is the code, which your app supplies when it sends the message.
          </p>
        </div>
      </div>

      {/* ── Code delivery ── */}
      <div>
        <label className="block text-sm font-medium text-[#1E293B] dark:text-white mb-1.5">
          How the customer gets the code <span className="text-red-500">*</span>
        </label>
        <div className="space-y-2">
          {OTP_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onOtpType(opt.value)}
              aria-pressed={otpType === opt.value}
              className={`w-full text-left p-3 rounded-lg border transition-colors cursor-pointer ${
                otpType === opt.value
                  ? 'border-[#0b1957] dark:border-blue-500 bg-[#F0F4FF] dark:bg-blue-950/20'
                  : 'border-[#E2E8F0] dark:border-gray-800 bg-white dark:bg-[#000724] hover:border-[#0b1957]/40 dark:hover:border-blue-500/40'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 ${
                  otpType === opt.value
                    ? 'border-[#0b1957] dark:border-blue-500 bg-[#0b1957] dark:bg-blue-500'
                    : 'border-[#CBD5E1] dark:border-gray-600'
                }`} />
                <span className="text-sm font-semibold text-[#1E293B] dark:text-white">{opt.label}</span>
                {!opt.needsApp && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400">
                    No app needed
                  </span>
                )}
                {opt.needsApp && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                    Android app required
                  </span>
                )}
              </div>
              <p className="text-xs text-[#64748B] dark:text-gray-400 mt-1 ml-5.5">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ── Registered apps, for the two autofill types only ── */}
      {needsApp && (
        <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/10">
          <p className="text-sm font-semibold text-[#1E293B] dark:text-white">Your Android app</p>
          <p className="text-xs text-[#64748B] dark:text-gray-400 mt-1">
            Autofill hands the code straight to your app, so Meta has to know which app to trust.
            Both values come from your Android build — the package name from the manifest, the hash
            from the signing key.
            {otpType === 'ZERO_TAP' && ' Submitting also accepts Meta’s zero-tap terms on your behalf.'}
          </p>

          <div className="mt-3 space-y-2">
            {apps.map(app => (
              <div key={app.id} className="flex flex-col sm:flex-row items-stretch sm:items-start gap-2">
                <input
                  value={app.packageName}
                  onChange={e => onApps(apps.map(a => a.id === app.id ? { ...a, packageName: e.target.value } : a))}
                  placeholder="com.example.app"
                  className="flex-1 min-w-0 px-2.5 py-2 border border-[#E2E8F0] dark:border-gray-800 rounded-lg text-sm font-mono focus:outline-none focus:ring-1 focus:ring-[#0b1957]/30 bg-white dark:bg-[#000724] text-gray-900 dark:text-white"
                />
                <input
                  value={app.signatureHash}
                  onChange={e => onApps(apps.map(a => a.id === app.id ? { ...a, signatureHash: e.target.value } : a))}
                  placeholder="Signature hash (11 chars)"
                  className="flex-1 min-w-0 px-2.5 py-2 border border-[#E2E8F0] dark:border-gray-800 rounded-lg text-sm font-mono focus:outline-none focus:ring-1 focus:ring-[#0b1957]/30 bg-white dark:bg-[#000724] text-gray-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => onApps(apps.filter(a => a.id !== app.id))}
                  title="Remove app"
                  className="p-2 text-[#94A3B8] hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {apps.length === 0 && (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Add at least one app, or choose <strong>Copy code</strong> — autofill cannot deliver a
                code without one.
              </p>
            )}
            {apps.length < 5 && (
              <button
                type="button"
                onClick={() => onApps([...apps, { id: uid(), packageName: '', signatureHash: '' }])}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-[#E2E8F0] dark:border-gray-800 rounded-lg text-xs font-medium text-[#1E293B] dark:text-gray-300 hover:border-[#0b1957]/40 dark:hover:border-blue-500/40 transition-colors cursor-pointer bg-white dark:bg-[#000724]"
              >
                <Plus className="w-3.5 h-3.5" /> Add app
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── The two flags ── */}
      <div className="space-y-3">
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={addSecurityRec}
            onChange={e => onAddSecurityRec(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-[#CBD5E1] dark:border-gray-700 text-[#0b1957] focus:ring-[#0b1957]/30 cursor-pointer"
          />
          <span>
            <span className="text-sm font-medium text-[#1E293B] dark:text-white">Add the security recommendation</span>
            <span className="block text-xs text-[#64748B] dark:text-gray-400 mt-0.5">
              Appends “{AUTH_SECURITY_COPY}”
            </span>
          </span>
        </label>

        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={useCodeExpiry}
            onChange={e => onUseCodeExpiry(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-[#CBD5E1] dark:border-gray-700 text-[#0b1957] focus:ring-[#0b1957]/30 cursor-pointer"
          />
          <span className="min-w-0">
            <span className="text-sm font-medium text-[#1E293B] dark:text-white">Show when the code expires</span>
            <span className="block text-xs text-[#64748B] dark:text-gray-400 mt-0.5">
              Adds a footer line. This is wording only — it does not enforce the expiry, which stays
              your app’s job.
            </span>
          </span>
        </label>

        {useCodeExpiry && (
          <div className="ml-6.5 flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={90}
              value={codeExpiryMins}
              onChange={e => onCodeExpiryMins(Number(e.target.value))}
              className="w-20 px-2.5 py-1.5 border border-[#E2E8F0] dark:border-gray-800 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#0b1957]/30 bg-white dark:bg-[#000724] text-gray-900 dark:text-white"
            />
            <span className="text-sm text-[#64748B] dark:text-gray-400">minutes</span>
            {!(codeExpiryMins >= 1 && codeExpiryMins <= 90) && (
              <span className="text-xs text-red-600 dark:text-red-400">Meta allows 1–90 minutes.</span>
            )}
          </div>
        )}
      </div>

      {/* ── Validity period ── */}
      <div>
        <label className="block text-sm font-medium text-[#1E293B] dark:text-white mb-1.5">
          Message validity period
          <span className="ml-1 text-[#64748B] dark:text-slate-400 font-normal text-xs">· Optional</span>
        </label>
        <select
          value={ttl}
          onChange={e => onTtl(e.target.value)}
          className="max-lg:min-h-11 max-md:text-[16px] w-full px-3 py-2 border border-[#E2E8F0] dark:border-gray-800 rounded-lg text-sm bg-white dark:bg-[#000724] text-[#1E293B] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0b1957]/20 focus:border-[#0b1957] dark:focus:ring-blue-500/20 dark:focus:border-blue-500"
        >
          {AUTH_TTL_OPTIONS.map(o => (
            <option key={o.value || 'default'} value={o.value} className="dark:bg-[#000724]">{o.label}</option>
          ))}
        </select>
        <p className="text-xs text-[#64748B] dark:text-gray-400 mt-1.5">
          How long Meta keeps trying to deliver before giving up. Keep it short — a code that arrives
          after it has expired is worse than one that never arrives.
        </p>
      </div>
    </div>
  );
}

export default function WhatsAppTemplateCreatePage() {
  const router = useRouter();

  // ── Mobile tab state ───────────────────────────────────────────────────────
  const [mobileTab, setMobileTab] = useState<MobileTab>('details');

  // ── State ──────────────────────────────────────────────────────────────────
  const [name,     setName]     = useState('');
  // A template lives on a WABA, not on a workspace. With two connected numbers
  // there are two separate libraries, and submitting without choosing sent every
  // template to whichever number was connected FIRST.
  const { accounts } = useWhatsAppAccounts();
  const [accountId, setAccountId] = useState('');
  const targetAccount = accounts.find(a => a.id === accountId) ?? accounts[0];
  const effectiveAccountId = targetAccount?.id ?? '';

  const [language, setLanguage] = useState('en_US');
  const [category, setCategory] = useState<Category>('MARKETING');

  // Header / media
  const [mediaType,       setMediaType]       = useState<MediaType>('NONE');
  const [headerText,      setHeaderText]       = useState('');
  const [headerVarExample,setHeaderVarExample] = useState('');
  const [mediaHandle,     setMediaHandle]     = useState('');
  const [mediaFileName,   setMediaFileName]   = useState('');
  const [uploadStatus,    setUploadStatus]    = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [uploadError,     setUploadError]     = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Body
  const [bodyText,     setBodyText]     = useState('');
  const [bodyExamples, setBodyExamples] = useState<Record<string, string>>({});
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Footer
  const [footerText, setFooterText] = useState('');

  // Buttons
  const [buttons,        setButtons]        = useState<TemplateButton[]>([]);
  const [showBtnMenu,    setShowBtnMenu]    = useState(false);

  // Authentication templates — a separate, much smaller set of controls, because
  // Meta supplies the copy and only these choices are ours to make.
  const [otpType,        setOtpType]        = useState<OtpType>('COPY_CODE');
  const [addSecurityRec, setAddSecurityRec] = useState(true);
  const [useCodeExpiry,  setUseCodeExpiry]  = useState(true);
  const [codeExpiryMins, setCodeExpiryMins] = useState(10);
  const [authTtl,        setAuthTtl]        = useState('');   // '' = Meta's default
  const [supportedApps,  setSupportedApps]  = useState<SupportedApp[]>([]);

  // Submit
  const [submitting, setSubmitting] = useState(false);
  const [result,     setResult]     = useState<{ success: boolean; message: string } | null>(null);

  // ── Derived ────────────────────────────────────────────────────────────────
  const safeName = name
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 512);

  const bodyVars      = useMemo(() => extractVars(bodyText),  [bodyText]);
  const headerVars    = useMemo(() => extractVars(headerText), [headerText]);
  const categoryInfo  = CATEGORIES.find(c => c.value === category)!;
  const isAuth        = category === 'AUTHENTICATION';
  const otpNeedsApp   = OTP_OPTIONS.find(o => o.value === otpType)?.needsApp ?? false;
  // Authentication templates support no header of any kind, so a media type
  // chosen before the category was switched must stop counting — otherwise the
  // preview keeps rendering an image block for a message that cannot have one.
  const isMediaHeader = !isAuth && mediaType !== 'NONE';

  const varDensityWarning = useMemo(() => {
    if (bodyVars.length === 0) return null;
    const stripped   = bodyText.replace(/\{\{\d+\}\}/g, '').trim();
    const wordCount  = stripped.split(/\s+/).filter(Boolean).length;
    const minWords   = bodyVars.length * 3;
    if (wordCount < minWords) {
      return `${wordCount} word${wordCount !== 1 ? 's' : ''} for ${bodyVars.length} variable${bodyVars.length !== 1 ? 's' : ''}. Meta requires ≥${minWords} surrounding words.`;
    }
    return null;
  }, [bodyText, bodyVars]);

  // ── Formatting toolbar ─────────────────────────────────────────────────────
  const wrapSelection = useCallback((open: string, close: string) => {
    const ta = bodyTextareaRef.current;
    if (!ta) return;
    const s = ta.selectionStart, e = ta.selectionEnd;
    const sel = bodyText.slice(s, e);
    const next = bodyText.slice(0, s) + open + sel + close + bodyText.slice(e);
    setBodyText(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(s + open.length, s + open.length + sel.length);
    });
  }, [bodyText]);

  const insertBodyVar = useCallback(() => {
    const ta = bodyTextareaRef.current;
    const nextNum = bodyVars.length > 0 ? Math.max(...bodyVars.map(Number)) + 1 : 1;
    const tag = `{{${nextNum}}}`;
    const pos = ta?.selectionStart ?? bodyText.length;
    const next = bodyText.slice(0, pos) + tag + bodyText.slice(pos);
    setBodyText(next);
    requestAnimationFrame(() => {
      if (ta) { ta.focus(); ta.setSelectionRange(pos + tag.length, pos + tag.length); }
    });
  }, [bodyText, bodyVars]);

  // ── Media upload ───────────────────────────────────────────────────────────
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadStatus('uploading');
    setUploadError('');
    setMediaHandle('');
    setMediaFileName(file.name);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });
      const res = await fetchWithTenant(
        '/api/whatsapp-conversations/conversations/templates/upload-media?channel=waba',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // Same number as the submission — a header handle is WABA-scoped.
          body: JSON.stringify({ file_base64: base64, filename: file.name, content_type: file.type, account_id: effectiveAccountId }),
        }
      );
      const data = await res.json();
      if (data.success && data.media_id) {
        setMediaHandle(data.media_id);
        setUploadStatus('done');
      } else {
        const raw = data.error || data.detail || 'Upload failed';
        setUploadError(typeof raw === 'string' ? raw : JSON.stringify(raw));
        setUploadStatus('error');
      }
    } catch (err: any) {
      setUploadError(err?.message ?? 'Upload failed');
      setUploadStatus('error');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
    // effectiveAccountId is a real dependency: a handle uploaded against one
    // number is rejected by Meta when the template is submitted to another.
  }, [effectiveAccountId]);

  // ── Build Meta components ──────────────────────────────────────────────────
  const buildComponents = useCallback(() => {
    const comps: object[] = [];

    /**
     * Authentication templates take a DIFFERENT grammar, not a subset of this
     * one. No text in the body, none in the footer, none on the button — Meta
     * writes all three and translates them into every approved language. What
     * we send is three flags and one OTP button.
     *
     * Falling through to the code below and merely omitting `text` would still
     * emit a HEADER when a media handle was uploaded earlier, and authentication
     * templates support no header at all. So this returns early.
     */
    if (isAuth) {
      comps.push({ type: 'BODY', add_security_recommendation: addSecurityRec });
      if (useCodeExpiry) {
        comps.push({ type: 'FOOTER', code_expiration_minutes: codeExpiryMins });
      }
      const otpButton: OtpButtonPayload = { type: 'OTP', otp_type: otpType };
      if (otpNeedsApp) {
        otpButton.supported_apps = supportedApps
          .filter(a => a.packageName.trim() && a.signatureHash.trim())
          .map(a => ({ package_name: a.packageName.trim(), signature_hash: a.signatureHash.trim() }));
      }
      if (otpType === 'ZERO_TAP') otpButton.zero_tap_terms_accepted = true;
      comps.push({ type: 'BUTTONS', buttons: [otpButton] });
      return comps;
    }

    // Header
    if (isMediaHeader && mediaHandle) {
      comps.push({ type: 'HEADER', format: mediaType, example: { header_handle: [mediaHandle] } });
    } else if (!isMediaHeader && headerText.trim()) {
      const comp: any = { type: 'HEADER', format: 'TEXT', text: headerText };
      if (headerVars.length > 0 && headerVarExample) comp.example = { header_text: [headerVarExample] };
      comps.push(comp);
    }

    // Body (required)
    if (bodyText.trim()) {
      const comp: any = { type: 'BODY', text: bodyText };
      if (bodyVars.length > 0) comp.example = { body_text: [bodyVars.map(v => bodyExamples[v] || `example${v}`)] };
      comps.push(comp);
    }

    // Footer
    if (footerText.trim()) comps.push({ type: 'FOOTER', text: footerText });

    // Buttons
    const validBtns = buttons.filter(b => b.text.trim());
    if (validBtns.length > 0) {
      comps.push({
        type: 'BUTTONS',
        buttons: validBtns.map(b => {
          if (b.type === 'QUICK_REPLY')  return { type: 'QUICK_REPLY', text: b.text };
          if (b.type === 'PHONE_NUMBER') return { type: 'PHONE_NUMBER', text: b.text, phone_number: b.phone };
          return { type: 'URL', text: b.text, url: b.url };
        }),
      });
    }
    return comps;
  }, [isAuth, addSecurityRec, useCodeExpiry, codeExpiryMins, otpType, otpNeedsApp, supportedApps,
      isMediaHeader, mediaType, mediaHandle, headerText, headerVars, headerVarExample,
      bodyText, bodyVars, bodyExamples, footerText, buttons]);

  // ── Validation ──────────────────────────────────────────────────────────────
  const canSubmit = useMemo(() => {
    if (!safeName) return false;

    // Authentication templates have no body to check — Meta writes it. Running
    // them through the checks below would block every submission on an empty
    // body the tenant is not allowed to fill.
    if (isAuth) {
      if (otpNeedsApp) {
        // An autofill button with no registered app cannot deliver a code.
        const usable = supportedApps.filter(a => a.packageName.trim() && a.signatureHash.trim());
        if (usable.length === 0) return false;
        // A half-filled row is a typo, not an intent — Meta rejects the whole
        // submission for it, so catch it before the round trip.
        if (supportedApps.some(a => Boolean(a.packageName.trim()) !== Boolean(a.signatureHash.trim()))) return false;
      }
      if (useCodeExpiry && !(codeExpiryMins >= 1 && codeExpiryMins <= 90)) return false;
      return true;
    }

    if (!bodyText.trim()) return false;
    if (bodyVars.some(v => !bodyExamples[v]?.trim())) return false;
    if (isMediaHeader && !mediaHandle) return false;
    if (uploadStatus === 'uploading') return false;
    if (!isMediaHeader && headerText && headerVars.length > 0 && !headerVarExample.trim()) return false;
    if (buttons.some(b => b.type === 'URL' && !b.url.trim())) return false;
    if (buttons.some(b => b.type === 'PHONE_NUMBER' && !b.phone.trim())) return false;
    if (varDensityWarning) return false;
    return true;
  }, [safeName, isAuth, otpNeedsApp, supportedApps, useCodeExpiry, codeExpiryMins,
      bodyText, bodyVars, bodyExamples, isMediaHeader, mediaHandle, uploadStatus,
      headerText, headerVars, headerVarExample, buttons, varDensityWarning]);

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetchWithTenant(
        '/api/whatsapp-conversations/conversations/templates?channel=waba',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: safeName, language, category,
            components: buildComponents(), account_id: effectiveAccountId,
            // Top level, not a component — and only meaningful for the category
            // whose form actually offers it.
            ...(isAuth && authTtl ? { message_send_ttl_seconds: Number(authTtl) } : {}),
          }),
        }
      );
      const data = await res.json();
      if (data.success) {
        setResult({ success: true, message: `"${safeName}" submitted - status: ${data.status ?? 'PENDING'}` });
      } else {
        setResult({ success: false, message: data.error || 'Meta rejected the template.' });
      }
    } catch (err: any) {
      setResult({ success: false, message: err?.message ?? 'Unexpected error.' });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Preview derived ─────────────────────────────────────────────────────────
  // The preview is the only place a tenant sees what Meta will actually send, so
  // for authentication templates it must show Meta's copy — not the empty body
  // that the form (correctly) refuses to let them fill.
  const previewBody = useMemo(() => {
    if (isAuth) return AUTH_BODY_COPY.replace('{{1}}', '123456')
      + (addSecurityRec ? ` ${AUTH_SECURITY_COPY}` : '');
    let text = bodyText;
    bodyVars.forEach(v => {
      text = text.replace(new RegExp(`\\{\\{${v}\\}\\}`, 'g'), bodyExamples[v] || `[example${v}]`);
    });
    return text;
  }, [isAuth, addSecurityRec, bodyText, bodyVars, bodyExamples]);

  const previewHeaderText = useMemo(() => {
    if (isAuth || isMediaHeader) return null;
    return headerText.replace(/\{\{1\}\}/g, headerVarExample || '[example]');
  }, [isAuth, isMediaHeader, headerText, headerVarExample]);

  const previewFooterText = useMemo(() => {
    if (isAuth) return useCodeExpiry ? authExpiryCopy(codeExpiryMins) : '';
    return footerText;
  }, [isAuth, useCodeExpiry, codeExpiryMins, footerText]);

  /**
   * What the bubble shows under the message.
   *
   * Authentication templates have exactly one button and its label is chosen by
   * Meta per language, so the label here is the English one — indicative, not a
   * value we send.
   */
  const previewButtons = useMemo(() => {
    if (isAuth) {
      return [{
        id:   'otp',
        kind: 'OTP' as const,
        text: otpType === 'COPY_CODE' ? 'Copy code' : 'Autofill',
      }];
    }
    return buttons
      .filter(b => b.text.trim())
      .map(b => ({ id: b.id, kind: b.type, text: b.text }));
  }, [isAuth, otpType, buttons]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F8F9FE] dark:bg-[#000724] transition-colors duration-200" onClick={() => setShowBtnMenu(false)}>

      {/* ── Sticky header bar with integrated tabs ── */}
      <div className="bg-white dark:bg-[#000724] border-b border-[#E2E8F0] dark:border-gray-800 sticky top-0 z-20 shadow-sm transition-colors">
        <div className="px-4 md:px-6 py-4 sm:py-5 flex items-center gap-3">
          <button
            onClick={() => router.push('/conversations/templates')}
            className="flex items-center gap-1.5 text-xs sm:text-sm px-3 py-1.5 max-lg:min-h-11 max-md:text-sm rounded-lg border border-[#E2E8F0] dark:border-gray-800 text-[#64748B] hover:text-[#1E293B] dark:text-gray-300 dark:hover:text-white font-medium transition-colors cursor-pointer bg-transparent"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <span className="text-base font-semibold text-[#1E293B] dark:text-white">Create WhatsApp template</span>
        </div>

        {/* Integrated Mobile Tabs */}
        <div className="md:hidden flex px-4 border-t border-[#E2E8F0] dark:border-gray-800/60">
          <button
            onClick={() => setMobileTab('details')}
            className="flex-1 py-3.5 text-center text-xs sm:text-sm font-medium border-b-2 transition-colors cursor-pointer border-transparent text-[#64748B] dark:text-gray-400 hover:text-[#1E293B] dark:hover:text-white data-[state=active]:border-[#0b1957] dark:data-[state=active]:border-blue-500 data-[state=active]:text-[#0b1957] dark:data-[state=active]:text-white"
            data-state={mobileTab === 'details' ? 'active' : 'inactive'}
          >
            Template details
          </button>
          <button
            onClick={() => setMobileTab('content')}
            className="flex-1 py-3.5 text-center text-xs sm:text-sm font-medium border-b-2 transition-colors cursor-pointer border-transparent text-[#64748B] dark:text-gray-400 hover:text-[#1E293B] dark:hover:text-white data-[state=active]:border-[#0b1957] dark:data-[state=active]:border-blue-500 data-[state=active]:text-[#0b1957] dark:data-[state=active]:text-white"
            data-state={mobileTab === 'content' ? 'active' : 'inactive'}
          >
            Content and button
          </button>
          <button
            onClick={() => setMobileTab('preview')}
            className="flex-1 py-3.5 text-center text-xs sm:text-sm font-medium border-b-2 transition-colors cursor-pointer border-transparent text-[#64748B] dark:text-gray-400 hover:text-[#1E293B] dark:hover:text-white data-[state=active]:border-[#0b1957] dark:data-[state=active]:border-blue-500 data-[state=active]:text-[#0b1957] dark:data-[state=active]:text-white"
            data-state={mobileTab === 'preview' ? 'active' : 'inactive'}
          >
            Preview
          </button>
        </div>
      </div>

      {/* ── Two-column layout ── */}
      <div className="flex">

        {/* ─── Left: Form ─── */}
        <div className={`flex-1 p-5 md:p-8 space-y-6 min-w-0 max-w-4xl ${mobileTab === 'preview' ? 'hidden' : ''}`}>

          {/* ── Template name & language section ── */}
          <div className={`bg-white dark:bg-[#000c3b] border border-[#E2E8F0] dark:border-gray-800 rounded-xl shadow-sm overflow-hidden ${mobileTab !== 'details' ? 'hidden md:block' : ''}`}>
            <div className="px-6 py-4 border-b border-[#E2E8F0] dark:border-gray-800 bg-[#F8F9FE] dark:bg-[#000c3b]">
              <h2 className="text-base font-semibold text-[#1E293B] dark:text-white">Template name and language</h2>
            </div>
            <div className="p-6 space-y-4">
              {/* See CreateWabaTemplateModal: shown for one number too, because a
                  template is bound to the number it was submitted against and the
                  fallback is otherwise invisible. */}
              {accounts.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-[#1E293B] dark:text-white mb-1.5">WhatsApp number</label>
                  {accounts.length > 1 ? (
                  <select
                    value={effectiveAccountId}
                    onChange={e => setAccountId(e.target.value)}
                    className="max-lg:min-h-11 max-md:text-[16px] w-full px-3 py-2.5 border border-[#E2E8F0] dark:border-gray-800 rounded-lg text-sm bg-white dark:bg-[#000724] text-[#1E293B] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0b1957]/20 focus:border-[#0b1957] dark:focus:ring-blue-500/20 dark:focus:border-blue-500"
                  >
                    {accounts.map(a => (
                      <option key={a.id} value={a.id} className="dark:bg-[#000724]">
                        {a.display_phone_number || a.display_name || a.slug}
                      </option>
                    ))}
                  </select>
                  ) : (
                    <div
                      className="w-full px-3 py-2.5 border border-[#E2E8F0] dark:border-gray-800 rounded-lg text-sm bg-[#F8FAFC] dark:bg-[#000724] text-[#1E293B] dark:text-white"
                      data-testid="waba-template-single-account"
                    >
                      {targetAccount?.display_phone_number || targetAccount?.display_name || targetAccount?.slug}
                    </div>
                  )}
                  <p className="text-[11px] text-[#64748B] dark:text-slate-400 mt-1">
                    Templates belong to one number. Meta reviews this one against{' '}
                    {accounts.length > 1 ? 'the number you pick' : 'this number'}.
                  </p>
                </div>
              )}

              {/* Name + Language row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#1E293B] dark:text-white mb-1.5">Name your template</label>
                  <div className="relative">
                    <input
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="e.g. welcome_message"
                      maxLength={512}
                      className="w-full px-3 py-2.5 pr-16 border border-[#E2E8F0] dark:border-gray-800 rounded-lg text-sm text-[#1E293B] dark:text-white placeholder:text-[#94A3B8] dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0b1957]/20 focus:border-[#0b1957] dark:focus:ring-blue-500/20 dark:focus:border-blue-500 bg-white dark:bg-[#000724]"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#64748B] dark:text-slate-400 pointer-events-none">{name.length}/512</span>
                  </div>
                  {name && safeName !== name.toLowerCase().replace(/\s+/g, '_') && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">Will be saved as: <span className="font-mono font-semibold">{safeName}</span></p>
                  )}
                  {safeName && (
                    <p className="text-[11px] text-[#64748B] dark:text-slate-400 mt-1 font-mono">{safeName || 'template_name'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#1E293B] dark:text-white mb-1.5">Select language</label>
                  <select
                    value={language}
                    onChange={e => setLanguage(e.target.value)}
                    className="max-lg:min-h-11 max-md:text-[16px] w-full px-3 py-2.5 border border-[#E2E8F0] dark:border-gray-800 rounded-lg text-sm bg-white dark:bg-[#000724] text-[#1E293B] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0b1957]/20 focus:border-[#0b1957] dark:focus:ring-blue-500/20 dark:focus:border-blue-500"
                  >
                    {LANGUAGES.map(l => <option key={l.code} value={l.code} className="dark:bg-[#000724]">{l.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Category + Submit row */}
              <div className="flex items-center justify-between pt-1">
                <div>
                  <p className="text-sm font-medium text-[#1E293B] dark:text-white mb-2">Category</p>
                  <div className="flex gap-2">
                    {CATEGORIES.map(c => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setCategory(c.value)}
                        className={`text-sm font-semibold px-4 py-2 max-lg:min-h-11 rounded-full border transition-all cursor-pointer ${
                          category === c.value
                            ? 'bg-[#0b1957] dark:bg-blue-600 text-white border-[#0b1957] dark:border-blue-600 shadow-[0_2px_8px_rgba(11,25,87,0.25)]'
                            : 'bg-white dark:bg-[#000724] text-[#64748B] dark:text-gray-300 border-[#E2E8F0] dark:border-gray-800 hover:border-[#0b1957]/40 dark:hover:border-blue-500/40 hover:text-[#1E293B] dark:hover:text-white'
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {result && (
                    <div className={`flex items-center gap-2 text-sm max-w-[260px] ${result.success ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                      {result.success
                        ? <CheckCircle2 className="w-4 h-4 shrink-0" />
                        : <AlertCircle  className="w-4 h-4 shrink-0" />}
                      <span className="text-xs line-clamp-2">{result.message}</span>
                    </div>
                  )}
                  <button
                    onClick={handleSubmit}
                    disabled={!canSubmit || submitting}
                    className="hidden md:inline-flex items-center gap-2 px-5 py-2.5 bg-[#0b1957] text-white rounded-xl font-semibold text-sm hover:bg-[#0a1540] disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_4px_20px_rgba(11,25,87,0.3)]  dark:hover:bg-white hover:shadow-[0_8px_30px_rgba(11,25,87,0.5)]  dark:text-gray-900 dark:bg-gray-100 dark:shadow-none transition-all cursor-pointer"
                  >
                    {submitting
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
                      : 'Submit to Meta'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ── Content section ── */}
          <div className={`bg-white dark:bg-[#000c3b] border border-[#E2E8F0] dark:border-gray-800 rounded-xl shadow-sm overflow-hidden ${mobileTab !== 'content' ? 'hidden md:block' : ''}`}>
            <div className="px-6 py-4 border-b border-[#E2E8F0] dark:border-gray-800 bg-[#F8F9FE] dark:bg-[#000c3b]">
              <h2 className="text-base font-semibold text-[#1E293B] dark:text-white">Content</h2>
              <p className="text-xs text-[#64748B] dark:text-gray-400 mt-0.5">
                {isAuth
                  ? 'Meta supplies the wording for authentication templates. Choose how the code reaches your customer.'
                  : 'Add a header, body and footer for your template. Cloud API hosted by Meta will review variables and content.'}
              </p>
            </div>

            <div className="p-6 space-y-6">

              {isAuth ? (
                <AuthenticationFields
                  otpType={otpType}               onOtpType={setOtpType}
                  addSecurityRec={addSecurityRec} onAddSecurityRec={setAddSecurityRec}
                  useCodeExpiry={useCodeExpiry}   onUseCodeExpiry={setUseCodeExpiry}
                  codeExpiryMins={codeExpiryMins} onCodeExpiryMins={setCodeExpiryMins}
                  ttl={authTtl}                   onTtl={setAuthTtl}
                  apps={supportedApps}            onApps={setSupportedApps}
                />
              ) : (
                <>

              {/* Variable type + Media sample row. Each column is a flex column with
                  the select pinned to the bottom, so the two selects line up even
                  when "Media sample · Optional" wraps to two lines on a phone. */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col">
                  <label className="block text-sm font-medium text-[#1E293B] dark:text-white mb-1.5">
                    Type of variable
                    <span className="ml-1.5 text-[#64748B] dark:text-slate-400 text-xs">ⓘ</span>
                  </label>
                  <select className="mt-auto max-lg:min-h-11 max-md:text-[16px] w-full px-3 py-2 border border-[#E2E8F0] dark:border-gray-800 rounded-lg text-sm bg-white dark:bg-[#000724] text-[#1E293B] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0b1957]/20 focus:border-[#0b1957] dark:focus:ring-blue-500/20 dark:focus:border-blue-500">
                    <option className="dark:bg-[#000724]">Number</option>
                  </select>
                </div>
                <div className="flex flex-col">
                  <label className="block text-sm font-medium text-[#1E293B] dark:text-white mb-1.5">
                    Media sample
                    <span className="ml-1 text-[#64748B] dark:text-slate-400 font-normal text-xs">· Optional</span>
                  </label>
                  <select
                    value={mediaType}
                    onChange={e => {
                      setMediaType(e.target.value as MediaType);
                      setMediaHandle('');
                      setMediaFileName('');
                      setUploadStatus('idle');
                      setUploadError('');
                    }}
                    className="mt-auto max-lg:min-h-11 max-md:text-[16px] w-full px-3 py-2 border border-[#E2E8F0] dark:border-gray-800 rounded-lg text-sm bg-white dark:bg-[#000724] text-[#1E293B] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0b1957]/20 focus:border-[#0b1957] dark:focus:ring-blue-500/20 dark:focus:border-blue-500"
                  >
                    <option value="NONE" className="dark:bg-[#000724]">None</option>
                    <option value="IMAGE" className="dark:bg-[#000724]">Image</option>
                    <option value="VIDEO" className="dark:bg-[#000724]">Video</option>
                    <option value="DOCUMENT" className="dark:bg-[#000724]">Document</option>
                  </select>
                </div>
              </div>

              {/* File upload area */}
              {isMediaHeader && (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept={
                      mediaType === 'IMAGE'    ? 'image/jpeg,image/png,image/webp' :
                      mediaType === 'VIDEO'    ? 'video/mp4,video/3gp' :
                      'application/pdf,.doc,.docx'
                    }
                    onChange={handleFileChange}
                  />
                  {uploadStatus === 'done' ? (
                    <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-xl">
                      <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-green-800 dark:text-green-200 truncate">{mediaFileName}</p>
                        <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">Uploaded to Meta successfully</p>
                      </div>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="text-xs text-green-700 dark:text-green-400 underline underline-offset-2 hover:text-green-800 dark:hover:text-green-300 shrink-0 cursor-pointer"
                      >
                        Replace file
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadStatus === 'uploading'}
                      className="w-full border-2 border-dashed border-[#E2E8F0] dark:border-gray-800 hover:border-[#0b1957]/40 dark:hover:border-blue-500/40 rounded-xl p-8 flex flex-col items-center gap-3 transition-colors group disabled:cursor-not-allowed bg-[#FAFBFC] dark:bg-[#000724] hover:bg-[#F0F4FF] dark:hover:bg-[#0b1957]/10"
                    >
                      {uploadStatus === 'uploading' ? (
                        <>
                          <Loader2 className="w-8 h-8 text-[#0b1957] dark:text-blue-400 animate-spin" />
                          <p className="text-sm font-medium text-[#64748B] dark:text-gray-400">Uploading to Meta…</p>
                        </>
                      ) : (
                        <>
                          <div className="w-12 h-12 rounded-full bg-[#0b1957]/5 dark:bg-blue-500/10 group-hover:bg-[#0b1957]/10 dark:group-hover:bg-blue-500/20 flex items-center justify-center transition-colors">
                            <Upload className="w-6 h-6 text-[#0b1957]/60 dark:text-blue-400/60 group-hover:text-[#0b1957] dark:group-hover:text-blue-400" />
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-semibold text-[#1E293B] dark:text-white group-hover:text-[#0b1957] dark:group-hover:text-blue-400">
                              Choose {mediaType.charAt(0) + mediaType.slice(1).toLowerCase()} file
                            </p>
                            <p className="text-xs text-[#64748B] dark:text-slate-400 mt-1">
                              {mediaType === 'IMAGE'    && 'JPG, PNG or WebP · Max 5MB'}
                              {mediaType === 'VIDEO'    && 'MP4 or 3GP · Max 16MB'}
                              {mediaType === 'DOCUMENT' && 'PDF, DOC or DOCX · Max 100MB'}
                            </p>
                          </div>
                        </>
                      )}
                    </button>
                  )}
                  {uploadStatus === 'error' && (
                    <div className="flex items-center gap-2 mt-2 text-xs text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {uploadError}
                    </div>
                  )}
                </div>
              )}

              {/* Header text */}
              <div>
                <label className="block text-sm font-medium text-[#1E293B] dark:text-white mb-1.5">
                  Header
                  <span className="ml-1 text-[#64748B] dark:text-slate-400 font-normal text-xs">· Optional</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={headerText}
                    onChange={e => setHeaderText(e.target.value)}
                    placeholder={
                      isMediaHeader
                        ? 'Text header not available when media is selected'
                        : 'Add a short line of text to the header of your message'
                    }
                    disabled={isMediaHeader}
                    maxLength={60}
                    className="w-full px-3 py-2.5 pr-16 border border-[#E2E8F0] dark:border-gray-800 rounded-lg text-sm text-[#1E293B] dark:text-white placeholder:text-[#94A3B8] dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0b1957]/20 focus:border-[#0b1957] dark:focus:ring-blue-500/20 dark:focus:border-blue-500 disabled:bg-[#F8F9FE] dark:disabled:bg-[#000724] disabled:text-[#94A3B8] dark:disabled:text-gray-600 disabled:cursor-not-allowed bg-white dark:bg-[#000724]"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#64748B] dark:text-slate-400 pointer-events-none">
                    {headerText.length}/60
                  </span>
                </div>
                {headerVars.length > 0 && !isMediaHeader && (
                  <div className="mt-2">
                    <label className="text-xs text-[#64748B] dark:text-gray-400 mb-1 block">
                      Example for <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded text-gray-800 dark:text-gray-200">{'{{1}}'}</code>
                      <span className="text-red-500 ml-1">*</span>
                    </label>
                    <input
                      value={headerVarExample}
                      onChange={e => setHeaderVarExample(e.target.value)}
                      placeholder="e.g. John"
                      className="w-full px-3 py-2 border border-[#E2E8F0] dark:border-gray-800 rounded-lg text-sm bg-white dark:bg-[#000724] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0b1957]/20 focus:border-[#0b1957] dark:focus:ring-blue-500/20 dark:focus:border-blue-500"
                    />
                  </div>
                )}
              </div>

              {/* Body */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium text-[#1E293B] dark:text-white">
                    Body <span className="text-red-500">*</span>
                  </label>
                  <span className="text-xs text-[#64748B] dark:text-slate-400">{bodyText.length}/1028</span>
                </div>

                {/* Formatting toolbar */}
                <div className="flex items-center gap-0.5 px-2 py-1.5 border border-b-0 border-[#E2E8F0] dark:border-gray-800 rounded-t-lg bg-[#F8F9FE] dark:bg-[#000c3b]">
                  <ToolbarBtn icon={<Bold        className="w-3.5 h-3.5" />} onClick={() => wrapSelection('*', '*')} title="Bold (*text*)" />
                  <ToolbarBtn icon={<Italic      className="w-3.5 h-3.5" />} onClick={() => wrapSelection('_', '_')} title="Italic (_text_)" />
                  <ToolbarBtn icon={<Strikethrough className="w-3.5 h-3.5" />} onClick={() => wrapSelection('~', '~')} title="Strikethrough (~text~)" />
                  <ToolbarBtn icon={<Code        className="w-3.5 h-3.5" />} onClick={() => wrapSelection('`', '`')} title="Monospace (`text`)" />
                  <div className="w-px h-4 bg-[#E2E8F0] dark:bg-gray-800 mx-1.5" />
                  <button
                    type="button"
                    onClick={insertBodyVar}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#0b1957] dark:text-blue-400 hover:bg-[#0b1957]/8 dark:hover:bg-blue-500/10 rounded-md transition-colors cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Add variable
                  </button>
                </div>
                <textarea
                  ref={bodyTextareaRef}
                  rows={6}
                  maxLength={1028}
                  value={bodyText}
                  onChange={e => setBodyText(e.target.value)}
                  placeholder="Hi {{1}}, your appointment on {{2}} is confirmed."
                  className="w-full px-3 py-2.5 border border-[#E2E8F0] dark:border-gray-800 rounded-b-lg text-sm text-[#1E293B] dark:text-white placeholder:text-[#94A3B8] dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0b1957]/20 focus:border-[#0b1957] dark:focus:ring-blue-500/20 dark:focus:border-blue-500 resize-none bg-white dark:bg-[#000724] font-sans"
                />
                {varDensityWarning && (
                  <div className="flex items-center gap-2 mt-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg px-3 py-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {varDensityWarning}
                  </div>
                )}
              </div>

              {/* Variable samples */}
              {bodyVars.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-[#1E293B] dark:text-white mb-1">Variable samples</h3>
                  <p className="text-xs text-[#64748B] dark:text-gray-400 mb-3">
                    Include samples of all variables in your message to help Meta review your template.
                    Remember not to include any customer information.
                  </p>
                  <div className="border border-[#E2E8F0] dark:border-gray-800 rounded-xl overflow-hidden">
                    <div className="grid grid-cols-2 grid-cols-[1fr_1fr] px-4 py-2.5 bg-[#F8F9FE] dark:bg-[#000c3b] border-b border-[#E2E8F0] dark:border-gray-800">
                      <span className="text-xs font-semibold text-[#64748B] dark:text-gray-400">Body</span>
                      <span className="text-xs font-semibold text-[#64748B] dark:text-gray-400">Sample value <span className="text-red-500">*</span></span>
                    </div>
                    {bodyVars.map(v => (
                      <div key={v} className="grid grid-cols-2 px-4 py-3 border-b border-[#E2E8F0] dark:border-gray-800 last:border-0 items-center gap-4 bg-white dark:bg-[#000c3b]/10">
                        <span className="text-sm font-mono text-[#64748B] dark:text-gray-400">{`{{${v}}}`}</span>
                        <input
                          value={bodyExamples[v] || ''}
                          onChange={e => setBodyExamples(prev => ({ ...prev, [v]: e.target.value }))}
                          placeholder={`Sample for {{${v}}}`}
                          className="px-3 py-1.5 border border-[#E2E8F0] dark:border-gray-800 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#0b1957]/30 focus:border-[#0b1957] bg-white dark:bg-[#000724] text-gray-900 dark:text-white"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer */}
              <div>
                <label className="block text-sm font-medium text-[#1E293B] dark:text-white mb-1.5">
                  Footer
                  <span className="ml-1 text-[#64748B] dark:text-slate-400 font-normal text-xs">· Optional</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={footerText}
                    onChange={e => setFooterText(e.target.value)}
                    placeholder="Add a short line of text to the bottom of your message"
                    maxLength={60}
                    className="w-full px-3 py-2.5 pr-16 border border-[#E2E8F0] dark:border-gray-800 rounded-lg text-sm text-[#1E293B] dark:text-white placeholder:text-[#94A3B8] dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0b1957]/20 focus:border-[#0b1957] dark:focus:ring-blue-500/20 dark:focus:border-blue-500 bg-white dark:bg-[#000724]"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#64748B] dark:text-slate-400 pointer-events-none">
                    {footerText.length}/60
                  </span>
                </div>
              </div>
                </>
              )}
            </div>
          </div>

          {/* ── Buttons section ── */}
          {/* Hidden for authentication templates: Meta accepts exactly one button
              there, the OTP button, and it is configured above. Leaving this open
              would let a tenant add a quick reply that makes the whole submission
              invalid for a reason the error message does not explain. */}
      {!isAuth && (mobileTab === 'content' || typeof window === 'undefined' || window.innerWidth >= 768) && (
          <div className="bg-white dark:bg-[#000c3b] border border-[#E2E8F0] dark:border-gray-800 rounded-xl shadow-sm">
            <div className="px-6 py-4 border-b border-[#E2E8F0] dark:border-gray-800 bg-[#F8F9FE] dark:bg-[#000c3b]">
              <h2 className="text-base font-semibold text-[#1E293B] dark:text-white">
                Buttons
                <span className="ml-1 text-[#64748B] dark:text-slate-400 font-normal text-sm">· Optional</span>
              </h2>
              <p className="text-xs text-[#64748B] dark:text-gray-400 mt-0.5">
                Create buttons that let customers respond to your message or take action. You can add up to 3 buttons.
              </p>
            </div>

            <div className="p-6 space-y-3 bg-white dark:bg-[#000c3b]/10">
              {buttons.map(btn => (
                <ButtonRow
                  key={btn.id}
                  btn={btn}
                  onChange={patch => setButtons(prev => prev.map(b => b.id === btn.id ? { ...b, ...patch } : b))}
                  onRemove={() => setButtons(prev => prev.filter(b => b.id !== btn.id))}
                />
              ))}

              {buttons.length < 3 && (
                <div className="relative" onClick={e => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => setShowBtnMenu(v => !v)}
                    className="flex items-center gap-2 px-4 py-2 border border-[#E2E8F0] dark:border-gray-800 rounded-lg text-sm font-medium text-[#1E293B] dark:text-gray-300 hover:border-[#0b1957]/40 dark:hover:border-blue-500/40 hover:bg-[#F8F9FE] dark:hover:bg-[#000c3b] transition-colors cursor-pointer bg-white dark:bg-[#000724]"
                  >
                    <Plus className="w-4 h-4" /> Add button <ChevronDown className="w-4 h-4 ml-0.5" />
                  </button>
                  {showBtnMenu && (
                    <div className="absolute top-full left-0 mt-1 bg-white dark:bg-[#000c3b] border border-[#E2E8F0] dark:border-gray-800 rounded-xl shadow-lg z-10 overflow-hidden min-w-52">
                      {[
                        { type: 'QUICK_REPLY'   as ButtonType, label: 'Quick reply',        desc: 'Pre-set response button'  },
                        { type: 'URL'           as ButtonType, label: 'Visit website',       desc: 'Link to a URL'            },
                        { type: 'PHONE_NUMBER'  as ButtonType, label: 'Call phone number',   desc: 'Dial a phone number'      },
                      ].map(opt => (
                        <button
                          key={opt.type}
                          type="button"
                          onClick={() => {
                            setButtons(prev => [...prev, { id: uid(), type: opt.type, text: '', url: '', phone: '', urlType: 'static' }]);
                            setShowBtnMenu(false);
                          }}
                          className="w-full px-4 py-3 text-left hover:bg-[#F8F9FE] dark:hover:bg-[#000724] transition-colors border-b border-[#E2E8F0] dark:border-gray-800 last:border-0 cursor-pointer bg-white dark:bg-[#000c3b]"
                        >
                          <p className="text-sm font-semibold text-[#1E293B] dark:text-white">{opt.label}</p>
                          <p className="text-xs text-[#64748B] dark:text-gray-400 mt-0.5">{opt.desc}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
      )}

            {/* ── Mobile Footer with Template Status Indicator ── */}
            <div className="p-4 pb-20 space-y-2">
              <p className="text-sm text-[#64748B] dark:text-slate-400">Template details pending</p>
            </div>
          </div>

          {/* ─── Mobile Preview Tab Wrapper Layout ─── */}
          <div className={`md:hidden flex-1 p-4 pb-20 ${mobileTab === 'preview' ? 'block' : 'hidden'}`}>
            <div className="mx-auto max-w-md w-full">

              {/* WA chat background */}
              <div className="bg-[#e5ddd5] dark:bg-slate-900 rounded-2xl p-4 min-h-[350px] w-full shadow-inner">
                {/* Chat header bar */}
                <div className="flex items-center gap-2 mb-4 pb-2 border-b border-black/10 dark:border-white/10">
                  <div className="w-8 h-8 rounded-full bg-[#25D366] flex items-center justify-center shrink-0">
                    <MessageSquare className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#1E293B] dark:text-white leading-none">Your Business</p>
                    <p className="text-[11px] text-[#64748B] dark:text-gray-400 mt-0.5">Online</p>
                  </div>
                </div>

                {/* Message bubble */}
                <div className="bg-white dark:bg-[#000c3b] rounded-xl shadow-sm overflow-hidden w-full mx-auto border border-transparent dark:border-gray-800">
                  {/* Media / text header */}
                  {isMediaHeader && (
                      <div className="h-36 bg-slate-100 dark:bg-[#000724] flex items-center justify-center border-b border-slate-200 dark:border-gray-800">
                        {uploadStatus === 'done' ? (
                            <div className="text-center px-2">
                              <FileIcon className="w-9 h-9 mx-auto text-slate-500 dark:text-gray-400 mb-1" />
                              <p className="text-xs text-slate-500 dark:text-gray-400 truncate max-w-[200px]">{mediaFileName}</p>
                            </div>
                        ) : (
                            <div className="text-center">
                        <span className="text-3xl block mb-1">
                          {mediaType === 'IMAGE' ? '🖼️' : mediaType === 'VIDEO' ? '🎥' : '📄'}
                        </span>
                              <p className="text-xs text-slate-400 dark:text-gray-500">No {mediaType.toLowerCase()} uploaded</p>
                            </div>
                        )}
                      </div>
                  )}

                  {!isMediaHeader && previewHeaderText && (
                      <div className="px-4 py-2.5 bg-slate-50 dark:bg-[#000724] border-b border-slate-100 dark:border-gray-800">
                        <p className="text-base font-bold text-[#1E293B] dark:text-white">
                          {previewHeaderText.split('{{1}}').map((part, index) => (
                              <React.Fragment key={index}>
                                {index > 0 && <span className="text-blue-600 dark:text-blue-400">{headerVarExample || '{{1}}'}</span>}
                                {part}
                              </React.Fragment>
                          ))}
                        </p>
                      </div>
                  )}

                  {/* Body */}
                  <div className="px-4 py-3">
                    <p className="text-base text-[#1E293B] dark:text-gray-200 leading-relaxed">
                      <WAText text={previewBody} />
                    </p>
                  </div>

                  {/* Footer */}
                  {previewFooterText && (
                      <div className="px-4 pb-2">
                        <p className="text-sm text-slate-400 dark:text-gray-500">{previewFooterText}</p>
                      </div>
                  )}

                  {/* Timestamp */}
                  <div className="px-4 pb-2 flex justify-end">
                    <span className="text-[11px] text-slate-400 dark:text-gray-500">09:33 ✓✓</span>
                  </div>

                  {/* Buttons */}
                  {previewButtons.length > 0 && (
                      <div className="border-t border-slate-100 dark:border-gray-800">
                        {previewButtons.map(b => (
                            <div
                                key={b.id}
                                className="flex items-center justify-center gap-1.5 px-4 py-3 text-sm text-[#0b85eb] dark:text-blue-400 font-semibold border-b border-slate-100 dark:border-gray-800 last:border-0"
                            >
                              {b.kind === 'URL'          && <Globe  className="w-3 h-3.5" />}
                              {b.kind === 'PHONE_NUMBER' && <Phone  className="w-3 h-3.5" />}
                              {b.kind === 'OTP'          && <Copy   className="w-3 h-3.5" />}
                              {b.text}
                            </div>
                        ))}
                      </div>
                  )}
                </div>
              </div>

              {/* Submission summary card */}
              {(safeName || bodyText) && (
                  <div className="mt-5 p-4 bg-[#F8F9FE] dark:bg-[#000c3b] rounded-xl border border-[#E2E8F0] dark:border-gray-800 space-y-2">
                    <p className="text-xs font-semibold text-[#64748B] dark:text-gray-400 uppercase tracking-wide mb-2">Summary</p>
                    {safeName && (
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs text-[#64748B] dark:text-slate-400">Name</span>
                          <span className="text-xs font-mono font-semibold text-[#1E293B] dark:text-white truncate max-w-[160px] text-right">{safeName}</span>
                        </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#64748B] dark:text-slate-400">Language</span>
                      <span className="text-xs text-[#1E293B] dark:text-white">{LANGUAGES.find(l => l.code === language)?.label}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#64748B] dark:text-slate-400">Category</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${categoryInfo.color}`}>
                    {category}
                  </span>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs text-[#64748B] dark:text-slate-400">Components</span>
                      <span className="text-xs text-[#1E293B] dark:text-white text-right">
                    {buildComponents().map((c: any) => c.type).join(', ') || '-'}
                  </span>
                    </div>
                  </div>
              )}
            </div>
          </div>

        {/* ─── Right: Desktop Preview (sticky) ─── */}
        <div className="hidden md:block w-[340px] shrink-0 sticky top-[61px] h-[calc(100vh-61px)] overflow-y-auto border-l border-[#E2E8F0] dark:border-gray-800 bg-white dark:bg-[#000724]">
          <div className="p-5">
            {/* Preview header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[#1E293B] dark:text-white">Template preview</h3>
              <div className="flex items-center gap-1 text-xs text-[#64748B] dark:text-gray-400">
                <Play className="w-3 h-3" />
                <span>Live</span>
              </div>
            </div>

            {/* WhatsApp phone mock */}
            <div className="mx-auto max-w-[270px]">
              {/* WA chat background */}
              <div className="bg-[#e5ddd5] dark:bg-slate-900 rounded-2xl p-3 min-h-[300px]">
                {/* Chat header bar */}
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-black/10 dark:border-white/10">
                  <div className="w-7 h-7 rounded-full bg-[#25D366] flex items-center justify-center shrink-0">
                    <MessageSquare className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#1E293B] dark:text-white leading-none">Your Business</p>
                    <p className="text-[10px] text-[#64748B] dark:text-gray-400 mt-0.5">Online</p>
                  </div>
                </div>

                {/* Message bubble */}
                <div className="bg-white dark:bg-[#000c3b] rounded-xl shadow-sm overflow-hidden max-w-[230px] mx-auto border border-transparent dark:border-gray-800">
                  {/* Media / text header */}
                  {isMediaHeader && (
                    <div className="h-28 bg-slate-100 dark:bg-[#000724] flex items-center justify-center border-b border-slate-200 dark:border-gray-800">
                      {uploadStatus === 'done' ? (
                        <div className="text-center px-2">
                          <FileIcon className="w-8 h-8 mx-auto text-slate-500 dark:text-gray-400 mb-1" />
                          <p className="text-[10px] text-slate-500 dark:text-gray-400 truncate max-w-[160px]">{mediaFileName}</p>
                        </div>
                      ) : (
                        <div className="text-center">
                          <span className="text-2xl block mb-1">
                            {mediaType === 'IMAGE' ? '🖼️' : mediaType === 'VIDEO' ? '🎥' : '📄'}
                          </span>
                          <p className="text-[10px] text-slate-400 dark:text-gray-500">No {mediaType.toLowerCase()} uploaded</p>
                        </div>
                      )}
                    </div>
                  )}

                  {!isMediaHeader && previewHeaderText && (
                    <div className="px-3 py-2 bg-slate-50 dark:bg-[#000724] border-b border-slate-100 dark:border-gray-800">
                      <p className="text-sm font-bold text-[#1E293B] dark:text-white">
                            {previewHeaderText.split('{{1}}').map((part, index) => (
                                <React.Fragment key={index}>
                                  {index > 0 && <span className="text-blue-600 dark:text-blue-400">{headerVarExample || '{{1}}'}</span>}
                                  {part}
                                </React.Fragment>
                            ))}
                          </p>
                    </div>
                  )}

                  {/* Body */}
                  <div className="px-3 py-2.5">
                    <p className="text-sm text-[#1E293B] dark:text-gray-200 leading-relaxed">
                      <WAText text={previewBody} />
                    </p>
                  </div>

                  {/* Footer */}
                  {previewFooterText && (
                    <div className="px-3 pb-2">
                      <p className="text-xs text-slate-400 dark:text-gray-500">{previewFooterText}</p>
                    </div>
                  )}

                  {/* Timestamp */}
                  <div className="px-3 pb-2 flex justify-end">
                    <span className="text-[10px] text-slate-400 dark:text-gray-500">09:33 ✓✓</span>
                  </div>

                  {/* Buttons */}
                  {previewButtons.length > 0 && (
                    <div className="border-t border-slate-100 dark:border-gray-800">
                      {previewButtons.map(b => (
                        <div
                          key={b.id}
                          className="flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs text-[#0b85eb] dark:text-blue-400 font-semibold border-b border-slate-100 dark:border-gray-800 last:border-0"
                        >
                          {b.kind === 'URL'          && <Globe  className="w-3 h-3" />}
                          {b.kind === 'PHONE_NUMBER' && <Phone  className="w-3 h-3" />}
                          {b.kind === 'OTP'          && <Copy   className="w-3 h-3" />}
                          {b.text}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Submission summary card */}
            {(safeName || bodyText) && (
              <div className="mt-5 p-4 bg-[#F8F9FE] dark:bg-[#000c3b] rounded-xl border border-[#E2E8F0] dark:border-gray-800 space-y-2">
                <p className="text-xs font-semibold text-[#64748B] dark:text-gray-400 uppercase tracking-wide mb-2">Summary</p>
                {safeName && (
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs text-[#64748B] dark:text-slate-400">Name</span>
                    <span className="text-xs font-mono font-semibold text-[#1E293B] dark:text-white truncate max-w-[160px] text-right">{safeName}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#64748B] dark:text-slate-400">Language</span>
                  <span className="text-xs text-[#1E293B] dark:text-white">{LANGUAGES.find(l => l.code === language)?.label}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#64748B] dark:text-slate-400">Category</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${categoryInfo.color}`}>
                    {category}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs text-[#64748B] dark:text-slate-400">Components</span>
                  <span className="text-xs text-[#1E293B] dark:text-white text-right">
                    {buildComponents().map((c: any) => c.type).join(', ') || '-'}
                  </span>
                </div>
              </div>
            )}
          </div>
      </div>

        </div>

        {/* ── Mobile Fixed Submit Bar ── */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-[#000724] border-t border-[#E2E8F0] dark:border-gray-800 p-4 z-30">
          <button
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-[#0b1957] dark:bg-gray-100 text-white dark:text-gray-900 rounded-xl font-semibold text-sm hover:bg-[#0a1540] dark:hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_4px_20px_rgba(11,25,87,0.3)] dark:shadow-none transition-all cursor-pointer"
          >
            {submitting
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
                : 'Submit to Meta'}
          </button>
        </div>

    </div>
  );
}
