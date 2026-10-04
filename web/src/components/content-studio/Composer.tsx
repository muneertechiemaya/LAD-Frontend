'use client';
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Copy, FileText, Plus, Save, Sparkles, Trash2 } from 'lucide-react';
import type { ContentPost, Platform, PostFormat, PostPatch, StudioSettings } from '@lad/frontend-features/content-studio';
import {
  PLATFORMS,
  auditVoice,
  useChannels,
  useCreatePost,
  useDeletePost,
  useDuplicatePost,
  useFolders,
  useGenerateDraft,
  usePost,
  usePosts,
  useUpdatePost,
} from '@lad/frontend-features/content-studio';
import { apiErrorCode } from '@lad/shared/apiError';
import { useToast } from '@/components/ui/app-toaster';
import { FORMAT_LABEL, HASHTAG_HINT, PLATFORM_FORMATS, PLATFORM_META, captionOf, formatName, postTitle } from '@/lib/content-studio/meta';
import { DownloadMenu } from './DownloadMenu';
import { PlatformPreview } from './PlatformPreview';
import { CarouselEditor, ScriptEditor, ThreadEditor } from './FormatEditors';
import { GradePanel, HookPicker, SchedulePanel, VersionsPanel } from './ComposerPanels';
import { RepurposeDialog } from './RepurposeDialog';
import { Card, CsButton, ErrorNote, Field, Label, PlatformBadge, SectionTitle, StatusChip, inputCls, textareaCls, tone } from './ui';
import { cn } from '@/lib/utils';

type Form = Required<
  Pick<PostPatch, 'platform' | 'format' | 'title' | 'hook' | 'body' | 'cta' | 'slides' | 'threadParts' | 'isTemplate' | 'mediaUrls'>
> & {
  pillar: string | null;
  hashtags: string;
  script: ContentPost['script'];
  folderId: string | null;
};

function fromPost(p: ContentPost | null | undefined, platform: Platform = 'linkedin'): Form {
  return {
    platform: p?.platform || platform,
    format: p?.format || PLATFORM_FORMATS[platform][0],
    pillar: p?.pillar ?? null,
    title: p?.title || '',
    hook: p?.hook || '',
    body: p?.body || '',
    cta: p?.cta || '',
    hashtags: (p?.hashtags || []).join(' '),
    slides: p?.slides?.length ? p.slides : [],
    script: p?.script || null,
    threadParts: p?.threadParts || [],
    isTemplate: !!p?.isTemplate,
    mediaUrls: p?.mediaUrls || [],
    folderId: p?.folderId ?? null,
  };
}

function toPatch(f: Form): PostPatch {
  return {
    platform: f.platform,
    format: f.format,
    pillar: f.pillar,
    title: f.title.trim(),
    hook: f.hook,
    body: f.body,
    cta: f.cta,
    hashtags: f.hashtags
      .split(/[\s,]+/)
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => (t.startsWith('#') ? t : `#${t}`)),
    slides: f.format === 'carousel' ? f.slides : [],
    script: f.format === 'video_script' ? f.script : null,
    threadParts: f.format === 'thread' ? f.threadParts : [],
    isTemplate: f.isTemplate,
    mediaUrls: f.mediaUrls,
    folderId: f.folderId,
  };
}

/** The Create area: a start panel when nothing is open, else the composer. */
export function Composer({
  postId,
  settings,
  onOpenBrief,
  onCreated,
  onDone,
  onNew,
}: {
  postId: string | null;
  settings: StudioSettings | undefined;
  onOpenBrief: () => void;
  onCreated: (p: ContentPost) => void;
  onDone: () => void;
  onNew: () => void;
}) {
  if (!postId) return <StartPanel onCreated={onCreated} onNew={onNew} />;
  return (
    <ComposerForm
      key={postId}
      postId={postId === 'new' ? null : postId}
      settings={settings}
      onOpenBrief={onOpenBrief}
      onCreated={onCreated}
      onDone={onDone}
    />
  );
}

function StartPanel({ onCreated, onNew }: { onCreated: (p: ContentPost) => void; onNew: () => void }) {
  const drafts = usePosts({ status: 'draft', limit: 6 });
  const ideas = usePosts({ status: 'idea', limit: 6 });
  const [repurpose, setRepurpose] = useState(false);
  const list = [...(drafts.data?.posts || []), ...(ideas.data?.posts || [])].slice(0, 8);
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Card className="flex flex-col gap-3 p-5">
        <SectionTitle>Start something new</SectionTitle>
        <CsButton variant="primary" className="self-start" onClick={onNew}>
          <Plus className="h-4 w-4" aria-hidden />
          Blank post
        </CsButton>
        <CsButton className="self-start" onClick={() => setRepurpose(true)}>
          <FileText className="h-4 w-4" aria-hidden />
          Turn a long piece into posts
        </CsButton>
        <p className={cn('text-sm', tone.soft)}>
          Paste a blog post, newsletter or video transcript and get 3 LinkedIn posts, 5 X threads and 2 short-video scripts, each graded.
        </p>
      </Card>
      <Card className="flex flex-col gap-3 p-5">
        <SectionTitle>Pick up where you left off</SectionTitle>
        {list.length ? (
          <ul className="flex flex-col gap-2">
            {list.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/content-studio?tab=create&post=${p.id}`}
                  className={cn('flex min-h-11 items-center gap-2 rounded-[10px] border px-3 py-2', tone.line, tone.ink, 'hover:bg-[#F5F6FA] dark:hover:bg-[#18234A]')}
                >
                  <PlatformBadge platform={p.platform} />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{postTitle(p)}</span>
                  <StatusChip status={p.status} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className={cn('text-sm', tone.soft)}>No drafts or ideas yet. Build a plan or start a blank post.</p>
        )}
      </Card>
      <RepurposeDialog open={repurpose} onClose={() => setRepurpose(false)} onDone={(posts) => posts[0] && onCreated(posts[0])} />
    </div>
  );
}

function ComposerForm({
  postId,
  settings,
  onOpenBrief,
  onCreated,
  onDone,
}: {
  postId: string | null;
  settings: StudioSettings | undefined;
  onOpenBrief: () => void;
  onCreated: (p: ContentPost) => void;
  onDone: () => void;
}) {
  const post = usePost(postId);
  const channels = useChannels();
  const folders = useFolders();
  const create = useCreatePost();
  const update = useUpdatePost();
  const del = useDeletePost();
  const dup = useDuplicatePost();
  const draft = useGenerateDraft();
  const { push } = useToast();
  const [form, setForm] = useState<Form>(() => fromPost(null));
  const [previewOn, setPreviewOn] = useState<Platform | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Below lg an existing post opens on its words; platform, format, pillar, folder and title fold into one row.
  const [detailsOpen, setDetailsOpen] = useState(false);

  const server = post.data;
  // Sync from the server whenever a new version lands (save, restore, fix).
  useEffect(() => {
    if (server) setForm(fromPost(server));
  }, [server?.id, server?.version]); // eslint-disable-line react-hooks/exhaustive-deps

  const baseline = useMemo(() => JSON.stringify(toPatch(fromPost(server))), [server]);
  const dirty = postId ? JSON.stringify(toPatch(form)) !== baseline : !!(form.hook || form.body || form.title);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const merged: ContentPost = useMemo(
    () => ({
      ...(server ||
        ({
          id: 'new',
          status: 'draft',
          approvalState: 'not_required',
          publishMode: 'reminder',
          angle: null,
          hookPattern: null,
          grade: null,
          score: null,
          scheduledAt: null,
          timezone: settings?.timezone || 'Asia/Dubai',
          isSample: false,
          version: 0,
          locked: false,
          publishedAt: null,
          externalPostId: null,
          lastError: null,
          remindedAt: null,
          sourcePostId: null,
          createdAt: '',
          updatedAt: '',
        } as unknown as ContentPost)),
      ...(toPatch(form) as Partial<ContentPost>),
    }),
    [server, form, settings?.timezone]
  );
  const tagCount = toPatch(form).hashtags?.length || 0;
  const liveRules = useMemo(
    () => auditVoice([form.hook, form.body, form.cta, ...form.slides.map((s) => `${s.heading} ${s.text}`)].join('\n'), form.platform, tagCount),
    [form, tagCount]
  );
  const meta = PLATFORM_META[form.platform];
  const captionLen = captionOf(merged).length;

  const save = async () => {
    try {
      if (!postId) {
        const created = await create.mutateAsync({ ...toPatch(form), platform: form.platform, status: 'draft' });
        push({ variant: 'success', title: 'Saved as a draft' });
        onCreated(created);
      } else {
        await update.mutateAsync({ id: postId, patch: { ...toPatch(form), reason: 'edited' } });
        push({ variant: 'success', title: 'Saved', description: 'A new version was kept in the history.' });
      }
    } catch {
      /* shown below */
    }
  };

  const writeForMe = async () => {
    try {
      const out = postId
        ? await draft.mutateAsync({ postId })
        : await draft.mutateAsync({
            topic: form.title || form.hook,
            platform: form.platform,
            format: form.format,
            pillar: form.pillar || undefined,
          });
      push({ variant: 'success', title: 'Written and graded', description: `Score ${out.score ?? '…'} / 10` });
      if (!postId) onCreated(out);
    } catch (e) {
      if (apiErrorCode(e) === 'BRIEF_REQUIRED') onOpenBrief();
    }
  };

  if (postId && post.isLoading) return <p className={cn('text-sm', tone.soft)}>Opening the post…</p>;
  if (postId && !server) return <ErrorNote error={post.error || new Error("That post wasn't found. It may have been deleted.")} />;

  const channel = channels.data?.find((c) => c.platform === form.platform);
  const canWrite = !!(form.title || form.hook);
  const err = create.error || update.error || del.error || dup.error || (draft.error && apiErrorCode(draft.error) !== 'BRIEF_REQUIRED' ? draft.error : null);

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] xl:items-start">
      <div className="flex min-w-0 flex-col gap-4">
        <Card className="flex flex-col gap-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SectionTitle>{postId ? postTitle(merged) : 'New post'}</SectionTitle>
            {server ? <StatusChip status={server.status} /> : null}
          </div>
          {postId ? (
            <button
              type="button"
              className={cn('flex min-h-11 w-full items-center gap-2 rounded-[10px] border px-3 text-left text-sm lg:hidden', tone.line, tone.ink)}
              aria-expanded={detailsOpen}
              aria-controls="cs-post-details"
              onClick={() => setDetailsOpen((o) => !o)}
            >
              <PlatformBadge platform={form.platform} className="shrink-0" />
              <span className="min-w-0 flex-1 truncate font-semibold">
                {meta.label} · {formatName(form.platform, form.format)}
                {form.pillar ? <span className={cn('font-normal', tone.soft)}> · {form.pillar}</span> : null}
              </span>
              <span className={cn('text-[13px] font-semibold', tone.soft)}>{detailsOpen ? 'Done' : 'Change'}</span>
              <ChevronDown className={cn('h-4 w-4 shrink-0', tone.motion, detailsOpen && 'rotate-180')} aria-hidden />
            </button>
          ) : null}
          <div id="cs-post-details" className={cn('flex-col gap-4 lg:flex', !postId || detailsOpen ? 'flex' : 'hidden')}>
            <div className="flex flex-col gap-2">
              <Label>Platform</Label>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Platform">
                {PLATFORMS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={form.platform === p}
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        platform: p,
                        format: PLATFORM_FORMATS[p].includes(f.format) ? f.format : PLATFORM_FORMATS[p][0],
                      }))
                    }
                    className={cn(
                      'inline-flex min-h-11 items-center gap-2 rounded-[10px] border px-3 text-sm font-semibold',
                      form.platform === p ? 'border-[#0B1957] ring-2 ring-[#0B1957] dark:border-[#8DB4FF] dark:ring-[#8DB4FF]' : tone.line,
                      tone.surface,
                      tone.ink
                    )}
                  >
                    <PlatformBadge platform={p} />
                    {PLATFORM_META[p].label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Format" htmlFor="cs-format">
                <select id="cs-format" className={inputCls} value={form.format} onChange={(e) => set('format', e.target.value as PostFormat)}>
                  {PLATFORM_FORMATS[form.platform].map((f) => (
                    <option key={f} value={f}>
                      {FORMAT_LABEL[f]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Pillar" htmlFor="cs-pillar">
                <select id="cs-pillar" className={inputCls} value={form.pillar || ''} onChange={(e) => set('pillar', e.target.value || null)}>
                  <option value="">No pillar</option>
                  {(settings?.pillars || []).map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Folder" htmlFor="cs-folder">
                <select id="cs-folder" className={inputCls} value={form.folderId || ''} onChange={(e) => set('folderId', e.target.value || null)}>
                  <option value="">No folder</option>
                  {(folders.data || []).map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Working title" hint="Only you see this. It names the post in the calendar and library." htmlFor="cs-title">
              <input id="cs-title" className={inputCls} value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="The 11pm enquiry" />
            </Field>
          </div>
          {(!server || server.status === 'idea' || server.status === 'draft') && (
            <div className={cn('flex flex-wrap items-center gap-3 rounded-[12px] border border-dashed p-3', tone.line)}>
              <CsButton variant="primary" size="sm" busy={draft.isPending} disabled={!canWrite} onClick={writeForMe} title={canWrite ? undefined : 'Add a working title or hook first'}>
                <Sparkles className="h-4 w-4" aria-hidden />
                Write it for me
              </CsButton>
              <span className={cn('text-[13px]', tone.soft)}>Hook, body and CTA sized for {meta.label}, then graded. Your brief sets the voice.</span>
            </div>
          )}
        </Card>

        <Card className="flex flex-col gap-4 p-4">
          <Field label="Hook" hint={meta.foldAt ? `${meta.label} shows about ${meta.foldAt} characters before "see more". The hook has to land inside that.` : undefined} htmlFor="cs-hook">
            <textarea id="cs-hook" rows={2} className={textareaCls} value={form.hook} onChange={(e) => set('hook', e.target.value)} />
          </Field>
          <HookPicker
            topic={form.title}
            platform={form.platform}
            postId={postId || undefined}
            current={form.hook}
            onPick={(h) => set('hook', h.text)}
            onNeedBrief={onOpenBrief}
          />
          <Field label="Body" htmlFor="cs-body">
            <textarea id="cs-body" rows={7} className={textareaCls} value={form.body} onChange={(e) => set('body', e.target.value)} />
          </Field>
          <Field label="Call to action" hint="One ask. What does this platform reward: comments, saves or shares?" htmlFor="cs-cta">
            {/* One line of meaning, but it wraps so a phone shows all of it. */}
            <textarea id="cs-cta" rows={2} className={cn(textareaCls, 'resize-none field-sizing-content')} value={form.cta} onChange={(e) => set('cta', e.target.value.replace(/\n+/g, ' '))} />
          </Field>
          <Field label="Hashtags" hint={HASHTAG_HINT[form.platform]} htmlFor="cs-tags">
            <textarea
              id="cs-tags"
              rows={2}
              className={cn(textareaCls, 'resize-none field-sizing-content')}
              value={form.hashtags}
              onChange={(e) => set('hashtags', e.target.value.replace(/\n+/g, ' '))}
              placeholder="#SalesTips #DubaiBusiness"
            />
          </Field>
          <p className={cn('text-xs tabular-nums', captionLen > meta.limit ? 'font-semibold text-[#A1202B] dark:text-[#FFB3B9]' : tone.soft)}>
            Caption {captionLen.toLocaleString()} / {meta.limit.toLocaleString()} characters
          </p>
          <label className={cn('flex min-h-11 items-center gap-3 text-sm', tone.ink)}>
            <input type="checkbox" className="h-5 w-5 accent-[#0B1957]" checked={form.isTemplate} onChange={(e) => set('isTemplate', e.target.checked)} />
            Keep as a reusable template in the Library
          </label>
        </Card>

        {form.format === 'carousel' ? (
          <CarouselEditor
            slides={form.slides.length ? form.slides : [{ heading: form.hook, text: '' }]}
            onChange={(s) => set('slides', s)}
          />
        ) : null}
        {form.format === 'video_script' ? <ScriptEditor script={form.script} onChange={(s) => set('script', s)} /> : null}
        {form.format === 'thread' ? <ThreadEditor hook={form.hook} parts={form.threadParts} onChange={(p) => set('threadParts', p)} /> : null}

        <ErrorNote error={err} />
        <div
          className={cn(
            'flex flex-wrap items-center gap-2 rounded-[14px] border p-3',
            tone.line,
            tone.surface,
            dirty ? 'max-md:sticky max-md:bottom-2 max-md:z-20 max-md:shadow-lg' : ''
          )}
        >
          <span className={cn('mr-auto text-sm', dirty ? 'font-semibold text-[#7A4A00] dark:text-[#FFD48A]' : tone.soft)}>
            {dirty ? 'Unsaved changes' : postId ? 'All changes saved' : 'Not saved yet'}
          </span>
          <CsButton variant="primary" busy={create.isPending || update.isPending} disabled={!dirty} onClick={save}>
            <Save className="h-4 w-4" aria-hidden />
            Save
          </CsButton>
          {server ? (
            <>
              <CsButton
                busy={dup.isPending}
                onClick={async () => {
                  try {
                    const copy = await dup.mutateAsync({ id: server.id });
                    push({ variant: 'success', title: 'Duplicated', description: 'Opened the copy.' });
                    onCreated(copy);
                  } catch {
                    /* shown above */
                  }
                }}
              >
                <Copy className="h-4 w-4" aria-hidden />
                Duplicate
              </CsButton>
              <DownloadMenu post={server} size="md" />
              {confirmDelete ? (
                <>
                  <CsButton
                    variant="danger"
                    busy={del.isPending}
                    onClick={async () => {
                      try {
                        await del.mutateAsync(server.id);
                        push({ variant: 'success', title: 'Deleted' });
                        onDone();
                      } catch {
                        /* shown above */
                      }
                    }}
                  >
                    Yes, delete
                  </CsButton>
                  <CsButton variant="ghost" onClick={() => setConfirmDelete(false)}>
                    Keep it
                  </CsButton>
                </>
              ) : (
                <CsButton variant="ghost" aria-label="Delete post" onClick={() => setConfirmDelete(true)} disabled={server.status === 'published'}>
                  <Trash2 className="h-4 w-4" aria-hidden />
                  Delete
                </CsButton>
              )}
            </>
          ) : null}
        </div>
      </div>

      <aside className="flex min-w-0 flex-col gap-4">
        <Card className="flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SectionTitle as="h3">Preview</SectionTitle>
          </div>
          <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Preview as">
            {PLATFORMS.map((p) => {
              const on = (previewOn || form.platform) === p;
              return (
                <button
                  key={p}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setPreviewOn(p === form.platform ? null : p)}
                  className={cn(
                    'min-h-11 min-w-11 shrink-0 rounded-lg px-3 text-sm font-semibold',
                    tone.motion,
                    on ? 'bg-[#0B1957] text-white dark:bg-[#2563EB]' : cn(tone.soft, 'hover:bg-[#ECEEF3] dark:hover:bg-[#18234A]')
                  )}
                >
                  {PLATFORM_META[p].label}
                </button>
              );
            })}
          </div>
          {previewOn && previewOn !== form.platform ? (
            <p className={cn('text-xs', tone.soft)}>How this would look on {PLATFORM_META[previewOn].label}. Duplicate it to post there too.</p>
          ) : null}
          <PlatformPreview post={merged} platform={previewOn || form.platform} />
        </Card>
        {server ? <GradePanel post={server} liveRules={liveRules} dirty={dirty} onNeedBrief={onOpenBrief} /> : null}
        {server ? <SchedulePanel key={`${server.id}-${server.version}`} post={server} channel={channel} dirty={dirty} windowTime={settings?.windows?.[server.platform]} /> : null}
        {server ? <VersionsPanel post={server} dirty={dirty} /> : null}
      </aside>
    </div>
  );
}
