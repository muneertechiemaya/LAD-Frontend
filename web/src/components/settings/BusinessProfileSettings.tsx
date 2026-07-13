'use client';
/**
 * Business Profile settings tab.
 *
 * Renders all 14 (+3 optional) fields stored in
 * ai_icp_profiles.icp_data and persisted via /api/ai-playground.
 * Reads/writes through `useBusinessProfile()` so the wizard's Company step,
 * the ICP Discovery chat, and this tab all stay in sync.
 *
 * Field set + completeness math come from the shared SDK module — do not
 * duplicate that vocabulary here.
 */

import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Target, Save, CheckCircle2, AlertTriangle, Building2, MapPin, Clock, Upload } from 'lucide-react';
import {
  useBusinessProfile,
  BUSINESS_PROFILE_COMPANY_HALF,
  BUSINESS_PROFILE_ICP_HALF,
  BUSINESS_PROFILE_OPTIONAL_FIELDS,
  type BusinessProfile,
} from '@lad/frontend-features/ai-icp-assistant';
import { useBusinessHours, useUpdateBusinessHours } from '@lad/frontend-features/settings';
import type { BusinessHoursPayload, BusinessHoursRecord } from '@lad/frontend-features/settings';
import { selectSettings, setCompanyLogo, setCompanyLocation } from '@/store/slices/settingsSlice';
import { BusinessHoursModal } from './BusinessHoursModal';

// ── Business-hours summary (display only; the modal computes its own on save) ──
const BH_DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
function bhSummary(bh: BusinessHoursRecord | BusinessHoursPayload | null | undefined): string | null {
  if (!bh || !bh.startTime) return null;
  const fmt = (v: string) => {
    const [h, m] = (v || '').split(':').map(Number);
    return `${(h % 12) || 12}:${String(m || 0).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
  };
  const sorted = [...(bh.activeDays || [])].sort((a, b) => a - b);
  let days = sorted.map((i) => BH_DAY_LABELS[i]).join(', ') || 'No days';
  if (sorted.length === 7) days = 'All days';
  else if (JSON.stringify(sorted) === JSON.stringify([0, 1, 2, 3, 4])) days = 'Mon–Fri';
  else if (JSON.stringify(sorted) === JSON.stringify([5, 6])) days = 'Sat–Sun';
  return `${fmt(bh.startTime)} – ${fmt(bh.endTime)} · ${days} · ${bh.timezone}`;
}

type Key = keyof BusinessProfile;

interface FieldSpec {
  key: Key;
  label: string;
  hint?: string;
  multiline?: boolean;
  placeholder?: string;
}

// Field copy for every key the form surfaces. Kept here (not in the SDK)
// because labels are app-facing UI copy, not contract data.
const FIELD_COPY: Record<string, { label: string; hint?: string; multiline?: boolean; placeholder?: string }> = {
  companyName:        { label: 'Company name',         placeholder: 'Acme Inc.' },
  industry:           { label: 'Industry',             hint: 'Comma-separate if you serve multiple.', placeholder: 'B2B SaaS, Healthtech' },
  website:            { label: 'Website',              placeholder: 'https://acme.com' },
  valueProposition:   { label: 'Value proposition',    multiline: true,  placeholder: 'AI sales assistant for outbound teams in MENA.' },
  productsServices:   { label: 'Products & services',  multiline: true,  hint: 'What the prospect actually buys.' },
  targetCustomers:    { label: 'Target customers',     multiline: true,  hint: 'Plain language — the chat dives deeper.' },
  contactEmail:       { label: 'Contact email',        hint: 'Shared by the agent when a prospect asks how to reach you.', placeholder: 'you@company.com' },
  contactPhone:       { label: 'Contact phone',        hint: 'Shared by the agent when a prospect asks how to reach you.', placeholder: '+971 50 123 4567' },

  companyDescription: { label: 'Company description',  multiline: true },
  icpJobTitles:       { label: 'Job titles',           hint: 'Comma-separate, partial matches OK.', placeholder: 'Head of Growth, VP Sales' },
  icpCompanySize:     { label: 'Company size',         hint: 'Headcount or revenue range.', placeholder: '50–250 employees' },
  icpLocations:       { label: 'Locations',            hint: 'Where your buyers are based.', placeholder: 'UAE, Saudi Arabia' },
  icpPainPoints:      { label: 'Pain points',          multiline: true,  hint: 'What you solve, in their language.' },
  sampleConversation: { label: 'Sample conversation',  multiline: true,  hint: 'Optional — a real conversation that worked.' },
  operatingHours:     { label: 'Operating hours',      placeholder: '09:00 – 18:00' },
  timezone:           { label: 'Timezone',             placeholder: 'GST+4' },
  geographicFocus:    { label: 'Geographic focus',     placeholder: 'GCC, MENA' },
  competitors:        { label: 'Competitors',          hint: 'Optional — names help the AI position you.' },
  campaignTone:       { label: 'Campaign tone',        placeholder: 'Friendly, direct, low-jargon' },
};

const SECTIONS: { title: string; subtitle: string; keys: ReadonlyArray<Key> }[] = [
  {
    title: 'Company',
    subtitle: "Who you are. The wizard's Company step writes these.",
    keys: BUSINESS_PROFILE_COMPANY_HALF.filter((k) => !BUSINESS_PROFILE_OPTIONAL_FIELDS.has(k)),
  },
  {
    title: 'Ideal Customer',
    subtitle: 'Who you sell to. The ICP chat writes these.',
    keys: BUSINESS_PROFILE_ICP_HALF.filter((k) => !BUSINESS_PROFILE_OPTIONAL_FIELDS.has(k)),
  },
  {
    title: 'Optional',
    subtitle: 'Not required for the core flow, but help the AI personalise.',
    keys: [
      ...BUSINESS_PROFILE_COMPANY_HALF.filter((k) => BUSINESS_PROFILE_OPTIONAL_FIELDS.has(k)),
      ...BUSINESS_PROFILE_ICP_HALF.filter((k) => BUSINESS_PROFILE_OPTIONAL_FIELDS.has(k)),
    ],
  },
];

export const BusinessProfileSettings: React.FC = () => {
  const { profile, loading, saving, save, error, completeness } = useBusinessProfile();
  const [form, setForm] = useState<Partial<BusinessProfile>>({});
  const [hydrated, setHydrated] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // ── Company basics (merged in from the former Company tab) ────────────────
  // Logo + location persist to the settings store (Redux); business hours
  // persist to the DB via the settings API. These are operational fields with
  // no equivalent in the 14-field ICP, so they live in their own section.
  const dispatch = useDispatch();
  const settings = useSelector(selectSettings);
  const { data: savedBH } = useBusinessHours();
  const updateBH = useUpdateBusinessHours();
  const [hoursOpen, setHoursOpen] = useState(false);
  const [location, setLocation] = useState('');
  const [locationSavedAt, setLocationSavedAt] = useState<number | null>(null);

  useEffect(() => {
    setLocation(settings.companyLocation || '');
  }, [settings.companyLocation]);

  const onLogoPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // NOTE: parity with the old Company tab — preview-only via object URL, drives
    // the header avatar for the session. Server-side logo persistence is a
    // separate follow-up (needs an upload endpoint).
    if (file) dispatch(setCompanyLogo(URL.createObjectURL(file)));
  };

  const saveLocation = () => {
    dispatch(setCompanyLocation(location));
    setLocationSavedAt(Date.now());
  };

  useEffect(() => {
    if (!loading && !hydrated) {
      // Seed from the loaded profile, but only for the keys this form renders.
      // Non-canonical extras like `linkedinAudit` stay in `profile` and survive
      // the round-trip because `save()` merges into the latest profile state.
      const next: Partial<BusinessProfile> = {};
      for (const section of SECTIONS) {
        for (const k of section.keys) {
          const v = (profile as Record<string, unknown>)[k as string];
          next[k] = typeof v === 'string' ? (v as string) : '';
        }
      }
      setForm(next);
      setHydrated(true);
    }
  }, [loading, hydrated, profile]);

  const setField = (k: Key, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (saving) return;
    try {
      await save(form);
      setSavedAt(Date.now());
    } catch {
      /* error surfaces via the hook */
    }
  };

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0B1957]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl grid place-items-center" style={{ background: '#e8ebf7' }}>
            <Target className="w-5 h-5" style={{ color: '#0B1957' }} />
          </div>
          <div className="flex-1">
            <h2 className="text-gray-900 text-xl font-semibold">Business Profile</h2>
            <p className="text-gray-600 text-sm mt-1">
              The 14 fields that power ICP Discovery, lead scoring, and message personalisation.
              The wizard fills these in; edit anything here whenever your positioning changes.
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500 font-medium">Profile completeness</div>
            <div
              className={`text-lg font-bold ${
                completeness.pct >= 70 ? 'text-emerald-600' : 'text-[#0B1957]'
              }`}
            >
              {completeness.pct}% ({completeness.filled}/{completeness.total})
            </div>
          </div>
        </div>
        <div className="mt-4 h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${completeness.pct}%`,
              background:
                completeness.pct >= 70
                  ? 'linear-gradient(90deg,#10b981,#059669)'
                  : 'linear-gradient(90deg,#0b1957,#2563eb)',
            }}
          />
        </div>
      </div>

      {/* Company basics — merged in from the former Company tab. Operational
          fields (logo, location, hours) that aren't part of the 14-field ICP. */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-gray-900 text-base font-semibold flex items-center gap-2">
          <Building2 className="w-4 h-4 text-[#0B1957]" />
          Company basics
        </h3>
        <p className="text-gray-500 text-xs mt-0.5 mb-4">Logo, location, and operating hours.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Logo */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full overflow-hidden bg-gray-50 border border-gray-200 grid place-items-center flex-shrink-0">
              {settings.companyLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={settings.companyLogo} alt="Company logo" className="w-full h-full object-cover" />
              ) : (
                <Building2 className="w-6 h-6 text-gray-300" />
              )}
            </div>
            <div>
              <span className="text-[12px] font-semibold text-[#172560] block mb-1.5">Company logo</span>
              <label className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-slate-200 text-[12px] font-medium text-[#0B1957] cursor-pointer hover:bg-slate-50">
                <Upload className="w-3.5 h-3.5" />
                Upload
                <input type="file" accept="image/*" className="hidden" onChange={onLogoPick} />
              </label>
            </div>
          </div>

          {/* Location */}
          <label className="flex flex-col">
            <span className="text-[12px] font-semibold text-[#172560] inline-flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> Company location
            </span>
            <span className="block text-[11.5px] text-slate-500 mt-0.5">Where your business is based.</span>
            <div className="mt-auto pt-1.5 flex gap-2">
              <input
                type="text"
                value={location}
                placeholder="Dubai, UAE"
                onChange={(e) => { setLocation(e.target.value); setLocationSavedAt(null); }}
                className="flex-1 h-10 px-3 rounded-lg border border-slate-200 bg-white text-[13px] text-[#172560] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B1957]/30"
              />
              <button
                onClick={saveLocation}
                className="h-10 px-3 rounded-lg text-[12px] font-semibold text-white bg-[#0B1957] hover:opacity-95 transition"
              >
                {locationSavedAt ? 'Saved' : 'Save'}
              </button>
            </div>
          </label>

          {/* Business hours — DB-backed via the settings API; edited in the modal */}
          <div className="sm:col-span-2 flex items-center justify-between gap-4 rounded-lg border border-slate-200 px-4 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg grid place-items-center flex-shrink-0" style={{ background: '#e8ebf7' }}>
                <Clock className="w-4 h-4" style={{ color: '#0B1957' }} />
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-[#172560]">Business hours</div>
                <div className="text-[12px] text-slate-500 truncate">{bhSummary(savedBH) || 'Not set'}</div>
              </div>
            </div>
            <button
              onClick={() => setHoursOpen(true)}
              className="h-9 px-3 rounded-lg text-[12px] font-semibold text-[#0B1957] border border-slate-200 hover:bg-slate-50 whitespace-nowrap transition"
            >
              {savedBH ? 'Edit' : 'Set hours'}
            </button>
          </div>
        </div>
      </div>

      {/* Sections */}
      {SECTIONS.map((section) => (
        <div key={section.title} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-gray-900 text-base font-semibold">{section.title}</h3>
          <p className="text-gray-500 text-xs mt-0.5 mb-4">{section.subtitle}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {section.keys.map((k) => {
              const copy: FieldSpec = { key: k, ...FIELD_COPY[k as string] } as FieldSpec;
              const value = typeof form[k] === 'string' ? (form[k] as string) : '';
              const isOptional = BUSINESS_PROFILE_OPTIONAL_FIELDS.has(k);
              return (
                <label key={k as string} className={`flex flex-col h-full ${copy.multiline ? 'sm:col-span-2' : ''}`}>
                  <span className="text-[12px] font-semibold text-[#172560] inline-flex items-center gap-1.5">
                    {copy.label}
                    {isOptional && (
                      <span className="text-[10px] uppercase tracking-wide font-medium text-gray-400">
                        optional
                      </span>
                    )}
                  </span>
                  {copy.hint && (
                    <span className="block text-[11.5px] text-slate-500 mt-0.5">{copy.hint}</span>
                  )}
                  {/* mt-auto pins the control to the bottom of the (stretched) grid
                      cell so paired inputs line up even when one field has a hint
                      line and the other doesn't. */}
                  <div className="mt-auto pt-1.5">
                    {copy.multiline ? (
                      <textarea
                        rows={3}
                        value={value}
                        placeholder={copy.placeholder}
                        onChange={(e) => setField(k, e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-[13px] text-[#172560] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B1957]/30 resize-none"
                      />
                    ) : (
                      <input
                        type="text"
                        value={value}
                        placeholder={copy.placeholder}
                        onChange={(e) => setField(k, e.target.value)}
                        className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-[13px] text-[#172560] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B1957]/30"
                      />
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      ))}

      {/* Footer: status + save */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex items-center justify-between">
        <div className="text-sm">
          {error ? (
            <span className="text-red-600 inline-flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              Couldn&apos;t save: {error.message}
            </span>
          ) : savedAt ? (
            <span className="text-emerald-600 inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              Saved.
            </span>
          ) : (
            <span className="text-gray-500">Changes are saved when you click Save.</span>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="h-10 px-4 rounded-lg text-[13px] font-semibold text-white inline-flex items-center gap-1.5 shadow-sm hover:opacity-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: '#0B1957' }}
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {/* Business-hours editor (reused from the former Company tab) */}
      {hoursOpen && (
        <BusinessHoursModal
          initialData={
            savedBH
              ? {
                  startTime: savedBH.startTime,
                  endTime: savedBH.endTime,
                  timezone: savedBH.timezone,
                  activeDays: savedBH.activeDays,
                }
              : undefined
          }
          onSave={(payload: BusinessHoursPayload) =>
            updateBH.mutate(payload, { onSuccess: () => setHoursOpen(false) })
          }
          onClose={() => setHoursOpen(false)}
        />
      )}
    </div>
  );
};

export default BusinessProfileSettings;
