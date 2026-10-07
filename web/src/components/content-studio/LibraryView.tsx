'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ChevronDown, FolderPlus, Pencil, Search, Trash2 } from 'lucide-react';
import type { ContentPost, Platform, PostStatus, StudioSettings } from '@lad/frontend-features/content-studio';
import {
  useEnabledPlatforms,
  STATUSES,
  useBulkUpdate,
  useCreateFolder,
  useDeleteFolder,
  useFolders,
  usePosts,
  useRenameFolder,
} from '@lad/frontend-features/content-studio';
import { useToast } from '@/components/ui/app-toaster';
import { PLATFORM_META, STATUS_META, formatName, postTitle } from '@/lib/content-studio/meta';
import { friendlyTime, localDate, shortDate } from '@/lib/content-studio/time';
import { downloadCalendarCsv } from '@/lib/content-studio/exports';
import { ApprovalChip, Card, CsButton, ErrorNote, Label, PlatformBadge, SampleChip, StatusChip, inputCls, tone } from './ui';
import { cn } from '@/lib/utils';
import { MediaLibrary } from './MediaLibrary';

type Scope = { kind: 'all' } | { kind: 'folder'; id: string } | { kind: 'templates' } | { kind: 'media' };

export function LibraryView({ tz, settings, onEdit }: { tz: string; settings: StudioSettings | undefined; onEdit: (p: ContentPost) => void }) {
  const enabledPlatforms = useEnabledPlatforms();
  // ?view=media opens Images and video directly (Media's Gallery and
  // Reference images tiles link here). Read through the router, not
  // window.location, which lags a client-side navigation.
  const view = useSearchParams().get('view');
  const [scope, setScope] = useState<Scope>(view === 'media' ? { kind: 'media' } : { kind: 'all' });
  useEffect(() => {
    if (view === 'media') setScope({ kind: 'media' });
  }, [view]);
  const [q, setQ] = useState('');
  const [platform, setPlatform] = useState<Platform | ''>('');
  const [status, setStatus] = useState<PostStatus | ''>('');
  const [pillar, setPillar] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [newFolder, setNewFolder] = useState('');
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  // Phones and tablets: the folder list folds into one "Showing …" row so posts come first.
  const [foldersOpen, setFoldersOpen] = useState(false);

  const folders = useFolders();
  const createFolder = useCreateFolder();
  const renameFolder = useRenameFolder();
  const deleteFolder = useDeleteFolder();
  const bulk = useBulkUpdate();
  const { push } = useToast();

  const query = {
    q: q || undefined,
    platform: platform || undefined,
    status: status || undefined,
    pillar: pillar || undefined,
    from: from || undefined,
    to: to || undefined,
    folderId: scope.kind === 'folder' ? scope.id : undefined,
    template: scope.kind === 'templates' ? true : undefined,
    limit: 200,
  };
  const posts = usePosts(query, scope.kind !== 'media');
  const list = useMemo(() => posts.data?.posts || [], [posts.data]);
  const allOn = list.length > 0 && list.every((p) => selected.includes(p.id));
  const chosen = useMemo(() => list.filter((p) => selected.includes(p.id)), [list, selected]);

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const runBulk = async (patch: Parameters<typeof bulk.mutateAsync>[0]['patch'], ok: string) => {
    try {
      const res = await bulk.mutateAsync({ ids: selected, patch });
      push({ variant: 'success', title: ok, description: `${res.updated.length} ${res.updated.length === 1 ? 'post' : 'posts'} updated, each with a new version.` });
    } catch {
      /* shown below */
    }
  };

  const pick = (next: typeof scope) => {
    setScope(next);
    setFoldersOpen(false);
  };
  const scopeName =
    scope.kind === 'all'
      ? 'All posts'
      : scope.kind === 'templates'
        ? 'Templates'
        : scope.kind === 'media'
          ? 'Images and video'
          : (folders.data || []).find((f) => f.id === scope.id)?.name || 'Folder';

  const folderBtn = (active: boolean) =>
    cn('flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-3 text-left text-sm font-semibold', tone.motion, active ? 'bg-[#0B1957] text-white dark:bg-[#2563EB]' : cn(tone.ink, 'hover:bg-[#ECEEF3] dark:hover:bg-[#18234A]'));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start">
      <Card as="aside" className="flex flex-col gap-1 p-3" aria-label="Folders">
        <button
          type="button"
          className={cn('flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-2 text-left text-sm font-semibold lg:hidden', tone.ink)}
          aria-expanded={foldersOpen}
          aria-controls="cs-folder-list"
          onClick={() => setFoldersOpen((o) => !o)}
        >
          <span className="min-w-0 truncate">
            <span className={cn('font-normal', tone.soft)}>Showing </span>
            {scopeName}
          </span>
          <ChevronDown className={cn('h-4 w-4 shrink-0', tone.motion, foldersOpen && 'rotate-180')} aria-hidden />
        </button>
        <div id="cs-folder-list" className={cn('flex-col gap-1 lg:flex', foldersOpen ? 'flex' : 'hidden')}>
          <Label className="px-2 py-1">Folders</Label>
          <button type="button" className={folderBtn(scope.kind === 'all')} onClick={() => pick({ kind: 'all' })} aria-current={scope.kind === 'all' ? 'true' : undefined}>
            All posts
          </button>
          {(folders.data || []).map((f) =>
            renaming?.id === f.id ? (
              <form
                key={f.id}
                className="flex gap-1"
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    await renameFolder.mutateAsync({ id: f.id, name: renaming.name.trim() });
                    setRenaming(null);
                  } catch {
                    /* shown below */
                  }
                }}
              >
                <input aria-label="Folder name" className={inputCls} value={renaming.name} onChange={(e) => setRenaming({ id: f.id, name: e.target.value })} autoFocus />
                <CsButton size="sm" type="submit">
                  Save
                </CsButton>
              </form>
            ) : (
              <div key={f.id} className="flex items-center gap-1">
                <button
                  type="button"
                  className={cn(folderBtn(scope.kind === 'folder' && scope.id === f.id), 'flex-1')}
                  onClick={() => pick({ kind: 'folder', id: f.id })}
                  aria-current={scope.kind === 'folder' && scope.id === f.id ? 'true' : undefined}
                >
                  <span className="min-w-0 truncate">{f.name}</span>
                  <span className="tabular-nums">{f.postCount}</span>
                </button>
                <CsButton size="sm" variant="ghost" className="px-0" aria-label={`Rename ${f.name}`} onClick={() => setRenaming({ id: f.id, name: f.name })}>
                  <Pencil className="h-4 w-4" aria-hidden />
                </CsButton>
                <CsButton
                  size="sm"
                  variant="ghost"
                  className="px-0"
                  aria-label={`Delete folder ${f.name}`}
                  onClick={async () => {
                    try {
                      await deleteFolder.mutateAsync(f.id);
                      if (scope.kind === 'folder' && scope.id === f.id) setScope({ kind: 'all' });
                      push({ variant: 'success', title: 'Folder deleted', description: 'Its posts are still in All posts.' });
                    } catch {
                      /* shown below */
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </CsButton>
              </div>
            )
          )}
          <form
            className="flex gap-1 pt-1"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newFolder.trim()) return;
              try {
                await createFolder.mutateAsync(newFolder.trim());
                setNewFolder('');
              } catch {
                /* shown below */
              }
            }}
          >
            <input aria-label="New folder name" placeholder="New folder" className={inputCls} value={newFolder} onChange={(e) => setNewFolder(e.target.value)} />
            <CsButton size="sm" type="submit" aria-label="Create folder" disabled={!newFolder.trim()}>
              <FolderPlus className="h-4 w-4" aria-hidden />
            </CsButton>
          </form>
          <Label className="px-2 pb-1 pt-3">Reusable</Label>
          <button type="button" className={folderBtn(scope.kind === 'templates')} onClick={() => pick({ kind: 'templates' })} aria-current={scope.kind === 'templates' ? 'true' : undefined}>
            Templates
          </button>
          <button type="button" className={folderBtn(scope.kind === 'media')} onClick={() => pick({ kind: 'media' })} aria-current={scope.kind === 'media' ? 'true' : undefined}>
            Images and video
          </button>
        </div>
        <ErrorNote error={folders.error || createFolder.error || renameFolder.error || deleteFolder.error} />
      </Card>

      {scope.kind === 'media' ? (
        <MediaLibrary />
      ) : (
        <section className="flex min-w-0 flex-col gap-3" aria-label="Posts">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
            <label className={cn('flex min-h-11 items-center gap-2 rounded-[10px] border px-3', tone.line, tone.surface, 'sm:col-span-2 xl:col-span-1')}>
              <Search className={cn('h-4 w-4', tone.soft)} aria-hidden />
              <input type="search" aria-label="Search posts" placeholder="Search hooks, captions, scripts" className={cn('min-w-0 flex-1 bg-transparent text-[15px] outline-none', tone.ink)} value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
            <select aria-label="Platform" className={inputCls} value={platform} onChange={(e) => setPlatform(e.target.value as Platform | '')}>
              <option value="">All platforms</option>
              {enabledPlatforms.map((p) => (
                <option key={p} value={p}>
                  {PLATFORM_META[p].label}
                </option>
              ))}
            </select>
            <select aria-label="Status" className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as PostStatus | '')}>
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_META[s].label}
                </option>
              ))}
            </select>
            <select aria-label="Pillar" className={inputCls} value={pillar} onChange={(e) => setPillar(e.target.value)}>
              <option value="">All pillars</option>
              {(settings?.pillars || []).map((p) => (
                <option key={p.id} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className={cn('flex items-center gap-2 text-sm', tone.soft)}>
              From
              <input type="date" aria-label="From date" className={cn(inputCls, 'w-auto')} value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className={cn('flex items-center gap-2 text-sm', tone.soft)}>
              To
              <input type="date" aria-label="To date" className={cn(inputCls, 'w-auto')} value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
            {q || platform || status || pillar || from || to ? (
              <CsButton size="sm" variant="ghost" onClick={() => { setQ(''); setPlatform(''); setStatus(''); setPillar(''); setFrom(''); setTo(''); }}>
                Clear filters
              </CsButton>
            ) : null}
          </div>

          {selected.length ? (
            <Card className="flex flex-wrap items-center gap-2 border-[#C9D8FF] bg-[#F2F6FF] p-2 dark:border-[#24407A] dark:bg-[#0F1D45] max-md:sticky max-md:bottom-2 max-md:z-20 max-md:shadow-lg" aria-label="Bulk edit">
              <span className={cn('px-2 text-sm font-semibold', tone.ink)}>{selected.length} selected</span>
              <select
                aria-label="Change pillar"
                className={cn(inputCls, 'w-auto')}
                value=""
                onChange={(e) => e.target.value && runBulk({ pillar: e.target.value }, `Pillar set to ${e.target.value}`)}
              >
                <option value="">Change pillar…</option>
                {(settings?.pillars || []).map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
              <select
                aria-label="Move to folder"
                className={cn(inputCls, 'w-auto')}
                value=""
                onChange={(e) => e.target.value && runBulk({ folderId: e.target.value === 'none' ? null : e.target.value }, 'Moved')}
              >
                <option value="">Move to folder…</option>
                <option value="none">No folder</option>
                {(folders.data || []).map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
              <CsButton size="sm" busy={bulk.isPending} onClick={() => runBulk({ shiftMinutes: 24 * 60 }, 'Moved 1 day later')}>
                1 day later
              </CsButton>
              <CsButton size="sm" busy={bulk.isPending} onClick={() => runBulk({ shiftMinutes: -24 * 60 }, 'Moved 1 day earlier')}>
                1 day earlier
              </CsButton>
              <CsButton size="sm" onClick={() => push({ variant: 'success', title: 'Downloaded', description: downloadCalendarCsv(chosen, `selected-${chosen.length}-posts`) })}>
                Download CSV
              </CsButton>
              <CsButton size="sm" variant="ghost" onClick={() => setSelected([])}>
                Clear
              </CsButton>
            </Card>
          ) : null}
          <ErrorNote error={posts.error || bulk.error} />

          {posts.isLoading ? (
            <p className={cn('text-sm', tone.soft)}>Loading your posts…</p>
          ) : !list.length ? (
            <Card className="p-5">
              <p className={cn('text-sm', tone.soft)}>{scope.kind === 'templates' ? 'No templates yet. Tick "Keep as a reusable template" on any post.' : 'No posts match these filters.'}</p>
            </Card>
          ) : (
            <>
              <Card className="hidden overflow-x-auto md:block">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className={cn('text-xs font-semibold uppercase tracking-[0.06em]', tone.soft)}>
                      <th className="w-12 p-2">
                        <input
                          type="checkbox"
                          aria-label="Select all"
                          className="h-5 w-5 accent-[#0B1957]"
                          checked={allOn}
                          onChange={() => setSelected(allOn ? [] : list.map((p) => p.id))}
                        />
                      </th>
                      <th className="p-2">Where</th>
                      <th className="p-2">Post</th>
                      <th className="p-2">Format</th>
                      <th className="p-2">Pillar</th>
                      <th className="p-2">Status</th>
                      <th className="p-2">When</th>
                      <th className="p-2">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((p) => (
                      <tr key={p.id} className={cn('border-t', tone.line)}>
                        <td className="p-2">
                          <input type="checkbox" aria-label={`Select ${postTitle(p)}`} className="h-5 w-5 accent-[#0B1957]" checked={selected.includes(p.id)} onChange={() => toggle(p.id)} />
                        </td>
                        <td className="p-2">
                          <PlatformBadge platform={p.platform} />
                        </td>
                        <td className="max-w-[360px] p-2">
                          <button type="button" onClick={() => onEdit(p)} className={cn('min-h-11 text-left text-sm font-semibold hover:underline', tone.ink)}>
                            {postTitle(p)}
                          </button>
                        </td>
                        <td className={cn('p-2 text-[13px]', tone.ink)}>{formatName(p.platform, p.format)}</td>
                        <td className={cn('p-2 text-[13px]', tone.ink)}>{p.pillar || '—'}</td>
                        <td className="p-2">
                          <span className="flex flex-wrap gap-1">
                            <StatusChip status={p.status} />
                            {p.isSample ? <SampleChip label="Sample" /> : null}
                            <ApprovalChip state={p.approvalState} />
                          </span>
                        </td>
                        <td className={cn('p-2 text-[13px] tabular-nums', tone.ink)}>
                          {p.scheduledAt ? `${shortDate(localDate(p.scheduledAt, tz))} ${friendlyTime(p.scheduledAt, tz)}` : '—'}
                        </td>
                        <td className={cn('p-2 text-[13px] font-semibold tabular-nums', tone.ink)}>{p.score ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
              <ul className="flex flex-col gap-2 md:hidden">
                {list.map((p) => (
                  <li key={p.id}>
                    <Card className="flex items-start gap-3 p-3">
                      <input type="checkbox" aria-label={`Select ${postTitle(p)}`} className="mt-3 h-5 w-5 accent-[#0B1957]" checked={selected.includes(p.id)} onChange={() => toggle(p.id)} />
                      <button type="button" onClick={() => onEdit(p)} className="flex min-h-11 min-w-0 flex-1 flex-col items-start gap-1 text-left">
                        <span className="flex flex-wrap items-center gap-2">
                          <PlatformBadge platform={p.platform} />
                          <StatusChip status={p.status} />
                          {p.isSample ? <SampleChip label="Sample" /> : null}
                          <span className={cn('text-xs tabular-nums', tone.soft)}>
                            {p.scheduledAt ? `${shortDate(localDate(p.scheduledAt, tz))} ${friendlyTime(p.scheduledAt, tz)}` : 'No time'}
                          </span>
                        </span>
                        <span className={cn('text-sm font-semibold', tone.ink)}>{postTitle(p)}</span>
                        <span className={cn('text-xs', tone.soft)}>
                          {formatName(p.platform, p.format)}
                          {p.pillar ? ` · ${p.pillar}` : ''}
                          {p.score != null ? ` · Score ${p.score}` : ''}
                        </span>
                      </button>
                    </Card>
                  </li>
                ))}
              </ul>
              <p className={cn('text-xs tabular-nums', tone.soft)}>
                {list.length} of {posts.data?.total ?? list.length} posts
              </p>
            </>
          )}
        </section>
      )}
    </div>
  );
}
