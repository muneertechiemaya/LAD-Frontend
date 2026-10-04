/**
 * Content Studio e2e mock backend.
 *
 * Stands in for LAD_backend so the real Next.js app (middleware, the
 * /api/[feature] proxy, the SDK) can be driven by Playwright without the
 * shared dev database. It implements the /api/content-studio contract
 * (CONTRACT.md) in memory, seeded from fixtures/content-studio-seed.json, plus
 * /api/auth/me for a fake owner with the content_studio feature. Writing help
 * (hooks, drafts, grades) returns fixed text: the real copy comes from the
 * backend's prompts; here only the UI flow is under test.
 *
 * Run: node e2e/content-studio/mock-backend.mjs   (port 4799, or MOCK_PORT)
 * Reset state between tests: POST /__reset
 */
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SEED = JSON.parse(fs.readFileSync(path.join(here, 'fixtures', 'content-studio-seed.json'), 'utf8'));
const PORT = Number(process.env.MOCK_PORT || 4799);
const TZ = 'Asia/Dubai';
const WEIGHTS = { hook: 0.5, specificity: 0.1, emotion: 0.1, shareability: 0.1, voice: 0.1, polarity: 0.05, platformFit: 0.05 };

// ── time helpers (same maths as web/src/lib/content-studio/time.ts) ────────
function parts(d, tz) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  const o = {};
  for (const p of f.formatToParts(d)) o[p.type] = p.value;
  return { y: +o.year, m: +o.month, d: +o.day, h: +o.hour, min: +o.minute, s: +o.second };
}
const pad = (n) => String(n).padStart(2, '0');
const localDate = (iso, tz = TZ) => { const p = parts(new Date(iso), tz); return `${p.y}-${pad(p.m)}-${pad(p.d)}`; };
function offsetMs(at, tz) { const p = parts(at, tz); return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - Math.floor(at.getTime() / 1000) * 1000; }
function zoned(date, time, tz = TZ) {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm, 0);
  const first = guess - offsetMs(new Date(guess), tz);
  return new Date(guess - offsetMs(new Date(first), tz)).toISOString();
}
function addDays(date, n) { const [y, m, d] = date.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d + n)); return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`; }
const weekday = (date) => ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(`${date}T00:00:00Z`).getUTCDay()];
const wIdx = (date) => (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7; // Mon=0
const today = () => localDate(new Date());
const round1 = (x) => Math.round((x + Number.EPSILON) * 10) / 10;
const score = (d) => round1(Object.entries(WEIGHTS).reduce((a, [k, w]) => a + w * (d[k] || 0), 0));

// ── state ───────────────────────────────────────────────────────────────────
let S;
function fullGrade(g) {
  if (!g) return null;
  return {
    score: g.score ?? score(g.dimensions),
    dimensions: g.dimensions,
    voiceRules: ['em_dashes', 'contractions', 'numbers_as_digits', 'active_voice', 'filler_words', 'filler_openers', 'hashtag_count'].map((rule) => ({ rule, pass: true })),
    fixes: g.fixes || [],
    gradedAt: new Date().toISOString(),
  };
}
function mkPost(over) {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(), platform: 'linkedin', format: 'post', pillar: null, status: 'draft', approvalState: 'not_required',
    publishMode: 'reminder', title: '', hook: '', body: '', cta: '', hashtags: [], slides: [], script: null, threadParts: [],
    angle: null, hookPattern: null, grade: null, score: null, scheduledAt: null, timezone: TZ, folderId: null, isTemplate: false,
    isSample: false, mediaUrls: [], version: 1, locked: false, publishedAt: null, externalPostId: null, lastError: null,
    remindedAt: null, sourcePostId: null, createdAt: now, updatedAt: now, ...over,
  };
}
const modeFor = (p) => (p.platform === 'linkedin' && (p.format === 'post' || p.format === 'thread') ? 'auto' : 'reminder');

const VOLATILE = ['id', 'version', 'createdAt', 'updatedAt'];
function snapshot(p) {
  const rest = Object.fromEntries(Object.entries(p).filter(([k]) => !VOLATILE.includes(k)));
  return JSON.parse(JSON.stringify(rest));
}
function addVersion(p, reason) {
  S.versions.push({ postId: p.id, version: p.version, reason, createdAt: new Date().toISOString(), createdBy: 'e2e-user', snapshot: snapshot(p) });
}

function reset() {
  S = { settings: { brandBrief: SEED.brandBrief, ...SEED.settings, updatedAt: new Date().toISOString() }, posts: [], versions: [], folders: [], media: [], metrics: {} };
  const t = today();
  // A showcase post for today must still be ahead of us, or it lands as
  // already due. Same rule as the backend seed: keep the seed's time if it is
  // at least an hour away, else move it to the next quarter hour after that.
  const earliest = Date.now() + 60 * 60_000;
  const seedTime = (dayOffset, time, minGapMin = 0) => {
    const iso = zoned(addDays(t, dayOffset), time);
    if (dayOffset !== 0 || new Date(iso).getTime() >= earliest + minGapMin * 60_000) return iso;
    const q = 15 * 60_000;
    return new Date(Math.ceil((earliest + minGapMin * 60_000) / q) * q).toISOString();
  };
  for (const sp of SEED.posts) {
    const iso = seedTime(sp.schedule.dayOffset, sp.schedule.time, sp.schedule.time >= '12:00' ? 120 : 0);
    const p = mkPost({
      platform: sp.platform, format: sp.format, pillar: sp.pillar, status: sp.status, approvalState: sp.approvalState,
      title: sp.title, hook: sp.hook, body: sp.body, cta: sp.cta, hashtags: sp.hashtags, slides: sp.slides, script: sp.script,
      angle: sp.angle, hookPattern: sp.hookPattern, grade: fullGrade(sp.grade), score: sp.grade.score, scheduledAt: iso, isSample: true,
      locked: sp.status !== 'draft', publishedAt: sp.status === 'published' ? iso : null,
    });
    p.publishMode = modeFor(p);
    S.posts.push(p);
    addVersion(p, 'created from the showcase');
    if (sp.sampleMetrics) S.metrics[p.id] = { ...sp.sampleMetrics, source: 'sample' };
  }
  for (const idea of SEED.ideas) {
    const p = mkPost({ platform: idea.platform, format: idea.format, pillar: idea.pillar, status: 'idea', title: idea.title, angle: idea.angle, scheduledAt: zoned(addDays(t, idea.schedule.dayOffset), idea.schedule.time), isSample: true });
    p.publishMode = modeFor(p);
    S.posts.push(p);
    addVersion(p, 'planned');
  }
  const f = { id: crypto.randomUUID(), name: 'October launch' };
  S.folders.push(f);
  S.posts[0].folderId = f.id;
}
reset();

// ── planner (deterministic, CONTRACT §6 in short) ───────────────────────────
const PRIORITY = ['linkedin', 'instagram', 'x', 'facebook', 'tiktok'];
const ROT = { linkedin: ['post', 'carousel', 'post'], instagram: ['carousel', 'video_script'], x: ['post', 'thread'], facebook: ['post'], tiktok: ['video_script'] };
const ANGLES = ['polarizing_opinion', 'receipts_number', 'customer_transformation', 'most_people_wrong', 'vulnerable_confession'];
function planSlots(start, days) {
  const s = S.settings;
  const dates = Array.from({ length: days }, (_, i) => addDays(start, i));
  const weeks = new Map();
  for (const d of dates) { const k = addDays(d, -wIdx(d)); weeks.set(k, [...(weeks.get(k) || []), d]); }
  const slots = [];
  for (const [, wd] of weeks) {
    for (const pf of PRIORITY) {
      const n0 = s.frequency[pf] || 0;
      if (!n0) continue;
      const allowed = ['linkedin', 'x'].includes(pf) ? wd.filter((d) => wIdx(d) < 5) : wd;
      if (!allowed.length) continue;
      const n = Math.max(1, Math.min(allowed.length, Math.round((n0 * wd.length) / 7)));
      const picked = new Set();
      for (let i = 0; i < n; i++) picked.add(allowed[Math.min(allowed.length - 1, Math.round(((i + 0.5) * allowed.length) / n - 0.5))]);
      for (const d of picked) slots.push({ date: d, time: s.windows[pf] || '10:00', platform: pf });
    }
  }
  slots.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const total = slots.length;
  const quota = Object.fromEntries(s.pillars.map((p) => [p.name, Math.floor((total * p.weight) / 100)]));
  let left = total - Object.values(quota).reduce((a, b) => a + b, 0);
  for (const p of [...s.pillars].sort((a, b) => ((total * b.weight) % 100) - ((total * a.weight) % 100))) { if (left-- <= 0) break; quota[p.name]++; }
  const lastBy = {};
  const fmtIdx = {};
  slots.forEach((sl, i) => {
    const pick = Object.entries(quota).filter(([n, q]) => q > 0 && n !== lastBy[sl.platform]).sort((a, b) => b[1] - a[1])[0] || Object.entries(quota).sort((a, b) => b[1] - a[1])[0];
    sl.pillar = pick[0];
    quota[pick[0]]--;
    lastBy[sl.platform] = pick[0];
    fmtIdx[sl.platform] = (fmtIdx[sl.platform] ?? -1) + 1;
    sl.format = ROT[sl.platform][fmtIdx[sl.platform] % ROT[sl.platform].length];
    sl.angle = ANGLES[i % ANGLES.length];
  });
  return slots;
}
const live = () => S.posts.filter((p) => !p.deletedAt);
function gapsFor(slots) {
  const has = new Set(live().filter((p) => p.scheduledAt).map((p) => localDate(p.scheduledAt)));
  const out = new Map();
  for (const sl of slots) if (!has.has(sl.date)) out.set(sl.date, [...(out.get(sl.date) || []), sl.platform]);
  return [...out.entries()].map(([date, plannedPlatforms]) => ({ date, weekday: weekday(date), plannedPlatforms }));
}

// ── canned writing help ─────────────────────────────────────────────────────
const CANNED_GRADE = { score: 8.1, dimensions: { hook: 8.5, specificity: 7.5, emotion: 7.5, shareability: 8, voice: 8, polarity: 7.5, platformFit: 8.5 },
  fixes: [
    { issue: 'Name a real moment', current: 'the body', why: 'A real moment from your story vault reads as yours.', fix: 'Add one sentence from your story vault after the hook.' },
    { issue: 'Sharpen the ask', current: 'the CTA', why: 'One clear ask gets more replies.', fix: 'End with one question readers can answer in a word.' },
    { issue: 'Trim the middle', current: 'paragraph 2', why: 'Shorter lines hold attention on phones.', fix: 'Split paragraph 2 into two short lines.' },
  ] };
function draftFor(topic, platform, format) {
  const hook = `Most founders answer the wrong enquiry first. ${topic ? `Here's ${topic.toLowerCase()}.` : ''}`.trim();
  const base = { hook, body: 'Reply to the newest enquiry first, not the loudest one.\n\nThe newest buyer is still deciding.', cta: "What's your rule for which enquiry gets answered first?" };
  if (format === 'carousel') base.slides = [{ heading: hook, text: '' }, { heading: 'The newest buyer is still deciding.', text: 'Answer them while they are.' }, { heading: 'Save this for your next busy morning.', text: '' }];
  if (format === 'video_script') base.script = { durationSeconds: 21, hook: { spoken: hook, onScreen: 'Answer the newest one first', seconds: 2 }, scenes: [{ seconds: 8, spoken: 'The newest buyer is still deciding.', onScreen: '', visual: 'Selfie to camera' }, { seconds: 8, spoken: 'Answer them while they are.', onScreen: 'Newest first', visual: 'Phone screen' }], cta: { spoken: 'Follow for 1 sales fix a week.', onScreen: 'Follow', seconds: 3 } };
  if (format === 'thread') base.threadParts = ['The newest buyer is still deciding.', 'The loudest one already decided.', 'So answer the newest first.'];
  return { ...base, title: topic || 'New post', platform, format };
}

// ── http ────────────────────────────────────────────────────────────────────
const ok = (res, data, status = 200) => send(res, status, { success: true, data });
const fail = (res, status, error, code) => send(res, status, { success: false, error, code });
function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' });
  res.end(JSON.stringify(body));
}
function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });
}
const find = (id) => live().find((p) => p.id === id);
function patchPost(p, patch, reason) {
  const fields = ['platform', 'format', 'pillar', 'status', 'title', 'hook', 'body', 'cta', 'hashtags', 'slides', 'script', 'threadParts', 'angle', 'hookPattern', 'scheduledAt', 'folderId', 'isTemplate', 'mediaUrls', 'approvalState'];
  for (const f of fields) if (patch[f] !== undefined) p[f] = patch[f];
  p.version += 1;
  p.locked = true;
  p.isSample = false; // acting on a sample makes it the client's own post
  p.updatedAt = new Date().toISOString();
  p.publishMode = modeFor(p);
  addVersion(p, reason || 'edited');
  return p;
}

const USER = {
  id: 'e2e-user', email: 'owner@example.test', name: 'Test Owner', firstName: 'Test', role: 'owner', tenantId: 'e2e-tenant',
  capabilities: ['view_overview', 'view_campaigns', 'view_conversations', 'view_content_studio', 'view_settings'],
  tenantFeatures: ['overview', 'campaigns', 'conversations', 'content_studio'], vertical: null, curatedWorkspace: false,
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const p = url.pathname;
  const m = req.method;
  if (m === 'OPTIONS') return send(res, 204, {});
  if (p === '/__reset' && m === 'POST') { reset(); return ok(res, { reset: true }); }
  if (p === '/api/auth/me') return send(res, 200, { success: true, user: USER });

  if (!p.startsWith('/api/content-studio')) {
    // Everything else the app shell asks for (counts, notifications…): empty but valid.
    return send(res, 200, { success: true, data: [], items: [], count: 0, total: 0 });
  }
  const r = p.replace('/api/content-studio', '') || '/';
  const raw = m === 'GET' || m === 'DELETE' ? Buffer.alloc(0) : await readBody(req);
  let body = {};
  const ctype = req.headers['content-type'] || '';
  if (raw.length && ctype.includes('application/json')) { try { body = JSON.parse(raw.toString('utf8')); } catch { return fail(res, 400, 'Bad JSON', 'VALIDATION'); } }
  const q = Object.fromEntries(url.searchParams.entries());
  let mm;

  // settings & channels
  if (r === '/settings' && m === 'GET') return ok(res, S.settings);
  if (r === '/settings' && m === 'PUT') { S.settings = { ...S.settings, ...body, updatedAt: new Date().toISOString() }; return ok(res, S.settings); }
  if (r === '/channels') return ok(res, [
    { platform: 'linkedin', mode: 'auto', connected: true, note: 'Mr LAD publishes text and single-image posts; carousels and videos get a reminder.' },
    { platform: 'instagram', mode: 'reminder', connected: false, note: 'Mr LAD reminds you until Instagram posting is switched on.' },
    { platform: 'facebook', mode: 'reminder', connected: false, note: 'Mr LAD reminds you at the time with the caption and files ready.' },
    { platform: 'x', mode: 'reminder', connected: false, note: 'Mr LAD reminds you at the time with the caption and files ready.' },
    { platform: 'tiktok', mode: 'reminder', connected: false, note: 'Mr LAD reminds you at the time with the caption and files ready.' },
  ]);

  // today
  if (r === '/today') {
    const t = today();
    const posts = live().filter((x) => x.scheduledAt && localDate(x.scheduledAt) === t).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
    const slots = planSlots(addDays(t, 1), 14);
    const week = Array.from({ length: 7 }, (_, i) => addDays(t, i + 1)).map((d) => ({ date: d, weekday: weekday(d), posts: live().filter((x) => x.scheduledAt && localDate(x.scheduledAt) === d).map((x) => ({ id: x.id, platform: x.platform, status: x.status })) }));
    const gaps = week.filter((w) => !w.posts.length).map((w) => ({ date: w.date, weekday: w.weekday, plannedPlatforms: slots.filter((s) => s.date === w.date).map((s) => s.platform) }));
    const pub = live().filter((x) => x.status === 'published').sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''))[0];
    const met = pub ? S.metrics[pub.id] : null;
    return ok(res, {
      date: t, timezone: TZ, posts,
      goingOut: posts.filter((x) => x.status === 'scheduled').length,
      needsApproval: posts.filter((x) => x.approvalState === 'pending').length,
      gaps, week,
      lastPublished: pub ? { ...pub, metrics: met ? Object.fromEntries(Object.entries(met).filter(([k]) => k !== 'source')) : null, metricsSource: met?.source || null } : null,
    });
  }

  // plan
  if (r === '/plan/preview' && m === 'POST') { const slots = planSlots(body.startDate || today(), body.days || 30); return ok(res, { slots, gaps: gapsFor(slots) }); }
  if (r === '/plan/gaps') { const slots = planSlots(q.from || today(), 14); return ok(res, gapsFor(slots)); }
  if (r === '/plan/generate' && m === 'POST') {
    const slots = planSlots(body.startDate || today(), body.days || 30);
    const created = [];
    let kept = 0;
    for (const sl of slots) {
      const exists = live().some((x) => x.platform === sl.platform && x.scheduledAt && localDate(x.scheduledAt) === sl.date);
      if (exists) { kept++; continue; }
      const np = mkPost({ platform: sl.platform, format: sl.format, pillar: sl.pillar, angle: sl.angle, status: 'idea', title: `${sl.pillar}: idea for ${sl.date}`, scheduledAt: zoned(sl.date, sl.time) });
      np.publishMode = modeFor(np);
      S.posts.push(np);
      addVersion(np, 'planned');
      created.push(np);
    }
    return ok(res, { created, kept, gaps: [] });
  }
  if (r === '/plan/fill-gaps' && m === 'POST') {
    const created = (body.dates || []).map((d, i) => {
      const pf = i % 2 ? 'instagram' : 'linkedin';
      const fmt = pf === 'instagram' ? 'carousel' : 'post';
      const base = body.draft ? draftFor(`Customer story ${i + 1}`, pf, fmt) : { title: `Customer story ${i + 1}` };
      const np = mkPost({ ...base, platform: pf, format: fmt, pillar: body.pillar || 'Customer stories', status: body.draft ? 'draft' : 'idea', scheduledAt: zoned(d, S.settings.windows[pf] || '10:00'), grade: body.draft ? fullGrade(CANNED_GRADE) : null, score: body.draft ? CANNED_GRADE.score : null });
      np.publishMode = modeFor(np);
      S.posts.push(np);
      addVersion(np, 'filled a gap');
      return np;
    });
    return ok(res, { created });
  }

  // posts
  if (r === '/posts' && m === 'GET') {
    let list = live();
    if (q.platform) list = list.filter((x) => x.platform === q.platform);
    if (q.status) list = list.filter((x) => x.status === q.status);
    if (q.pillar) list = list.filter((x) => x.pillar === q.pillar);
    if (q.folderId) list = list.filter((x) => x.folderId === q.folderId);
    if (q.template === 'true') list = list.filter((x) => x.isTemplate);
    if (q.from) list = list.filter((x) => x.scheduledAt && localDate(x.scheduledAt) >= q.from);
    if (q.to) list = list.filter((x) => x.scheduledAt && localDate(x.scheduledAt) <= q.to);
    if (q.q) { const s = q.q.toLowerCase(); list = list.filter((x) => [x.title, x.hook, x.body, x.cta, ...(x.slides || []).map((y) => y.heading)].join(' ').toLowerCase().includes(s)); }
    list = [...list].sort((a, b) => (a.scheduledAt || '9').localeCompare(b.scheduledAt || '9'));
    return ok(res, { posts: list.slice(0, Number(q.limit || 200)), total: list.length });
  }
  if (r === '/posts' && m === 'POST') {
    if (!body.platform) return fail(res, 400, 'Pick a platform.', 'VALIDATION');
    const np = mkPost({ ...body, status: body.status || 'draft' });
    np.publishMode = modeFor(np);
    S.posts.push(np);
    addVersion(np, 'created');
    return ok(res, np, 201);
  }
  if (r === '/posts/bulk' && m === 'POST') {
    const updated = [];
    for (const id of body.ids || []) {
      const x = find(id);
      if (!x) continue;
      const patch = { ...body.patch };
      if (patch.shiftMinutes && x.scheduledAt) patch.scheduledAt = new Date(new Date(x.scheduledAt).getTime() + patch.shiftMinutes * 60000).toISOString();
      delete patch.shiftMinutes;
      updated.push(patchPost(x, patch, 'bulk edit'));
    }
    return ok(res, { updated });
  }
  if ((mm = r.match(/^\/posts\/([^/]+)$/))) {
    const x = find(mm[1]);
    if (!x) return fail(res, 404, "That post wasn't found.", 'NOT_FOUND');
    if (m === 'GET') return ok(res, x);
    if (m === 'PATCH') {
      // Mirrors the backend: a published post keeps its status and time; its words can still be corrected.
      const moves = (body.status !== undefined && body.status !== x.status) || (body.scheduledAt !== undefined && body.scheduledAt !== x.scheduledAt);
      if (x.status === 'published' && moves) return fail(res, 409, 'This post is already published.', 'INVALID_STATE');
      return ok(res, patchPost(x, body, body.reason));
    }
    if (m === 'DELETE') { x.deletedAt = new Date().toISOString(); return ok(res, { id: x.id }); }
  }
  if ((mm = r.match(/^\/posts\/([^/]+)\/(duplicate|versions|schedule|unschedule|approve|mark-posted|retry|grade|apply-fix)$/))) {
    const x = find(mm[1]);
    if (!x) return fail(res, 404, "That post wasn't found.", 'NOT_FOUND');
    const action = mm[2];
    if (action === 'versions')
      return ok(res, S.versions.filter((v) => v.postId === x.id).sort((a, b) => b.version - a.version).map((v) => ({ version: v.version, reason: v.reason, createdAt: v.createdAt, createdBy: v.createdBy, snapshot: v.snapshot })));
    if (action === 'duplicate') {
      const np = mkPost({ ...snapshot(x), platform: body.platform || x.platform, status: x.status === 'published' || x.status === 'scheduled' ? 'ready' : x.status, approvalState: 'not_required', title: `${x.title} (copy)`, sourcePostId: x.id, publishedAt: null, locked: false, isSample: false, scheduledAt: body.scheduledAt || x.scheduledAt });
      np.publishMode = modeFor(np);
      S.posts.push(np);
      addVersion(np, 'duplicated');
      return ok(res, np, 201);
    }
    if (action === 'schedule') {
      if (x.status === 'idea' || !(x.hook || x.body)) return fail(res, 409, 'Write the post first. An idea can’t go on the scheduler.', 'NOT_SCHEDULABLE');
      if (!body.scheduledAt || new Date(body.scheduledAt).getTime() <= Date.now()) return fail(res, 400, 'Pick a time in the future.', 'VALIDATION');
      const text = [x.hook, x.body, x.cta, x.hashtags].filter(Boolean).join('\n\n');
      if (x.platform === 'linkedin' && text.length > 3000) return fail(res, 400, `This post is ${text.length.toLocaleString('en-US')} characters; LinkedIn allows 3,000. Shorten it before scheduling.`, 'TOO_LONG');
      return ok(res, patchPost(x, { status: 'scheduled', scheduledAt: body.scheduledAt, approvalState: S.settings.approvalRequired && x.approvalState === 'not_required' ? 'pending' : x.approvalState }, 'scheduled'));
    }
    if (action === 'unschedule') return ok(res, patchPost(x, { status: 'ready' }, 'unscheduled'));
    if (action === 'approve') return ok(res, patchPost(x, { approvalState: 'approved' }, 'approved'));
    if (action === 'mark-posted') { const out = patchPost(x, { status: 'published' }, 'marked as posted'); out.publishedAt = new Date().toISOString(); return ok(res, out); }
    if (action === 'retry') return ok(res, patchPost(x, { status: 'scheduled', scheduledAt: new Date(Date.now() + 60000).toISOString() }, 'retry'));
    if (action === 'grade') { x.grade = fullGrade(x.grade || CANNED_GRADE); x.score = x.grade.score; return ok(res, x); }
    if (action === 'apply-fix') {
      const fix = x.grade?.fixes?.[body.fixIndex || 0];
      if (!fix) return fail(res, 400, 'There is no fix to apply.', 'VALIDATION');
      const out = patchPost(x, { body: `${x.body}\n\n${fix.fix}` }, `applied fix: ${fix.issue}`);
      out.grade = { ...out.grade, fixes: out.grade.fixes.filter((_, i) => i !== (body.fixIndex || 0)) };
      return ok(res, out);
    }
  }
  if ((mm = r.match(/^\/posts\/([^/]+)\/versions\/(\d+)\/restore$/)) && m === 'POST') {
    const x = find(mm[1]);
    const v = S.versions.find((y) => y.postId === mm[1] && y.version === Number(mm[2]));
    if (!x || !v) return fail(res, 404, "That version wasn't found.", 'NOT_FOUND');
    return ok(res, patchPost(x, JSON.parse(JSON.stringify(v.snapshot)), `restored v${v.version}`));
  }

  // writing help
  if (r === '/generate/hooks' && m === 'POST') {
    const t = (body.topic || 'replies').toLowerCase();
    const hooks = [
      { text: `Most founders get ${t} wrong.`, category: 'Contrarian', pattern: 'Most people think X' },
      { text: `I read last week's enquiries about ${t}. Here's what stood out.`, category: 'Receipt', pattern: 'I did X. Here is what happened' },
      { text: `Here's what nobody tells you about ${t}.`, category: 'Curiosity gap', pattern: "Here's what nobody tells you" },
    ].map((h) => { const w = h.text.split(/\s+/).slice(0, 3).join(' '); return { ...h, first3: w, first3Pass: !/^here's what nobody/i.test(w) }; });
    return ok(res, { hooks });
  }
  if (r === '/generate/ideas' && m === 'POST') {
    if (!S.settings.brandBrief) return fail(res, 409, 'Add your brand brief first so posts sound like your business.', 'BRIEF_REQUIRED');
    return ok(res, { ideas: [
      { title: 'Why the fastest reply wins, not the best pitch', angle: 'polarizing_opinion', why: 'Picks a fight with "perfect pitch" advice, so it draws comments.', platform: 'linkedin' },
      { title: 'The 3 replies that lose a WhatsApp sale', angle: 'most_people_wrong', why: 'Readers recognise their own replies and save it.', platform: 'instagram' },
      { title: 'What happened to the 11pm enquiry', angle: 'customer_transformation', why: 'A before and after people can picture.', platform: 'linkedin' },
      { title: 'The week I answered every enquiry myself', angle: 'vulnerable_confession', why: 'Honest and specific, it earns trust.', platform: 'linkedin' },
      { title: 'Your auto-reply is a countdown', angle: 'polarizing_opinion', why: 'A one-line take built for replies.', platform: 'x' },
    ] });
  }
  if (r === '/generate/draft' && m === 'POST') {
    if (body.postId) {
      const x = find(body.postId);
      if (!x) return fail(res, 404, "That post wasn't found.", 'NOT_FOUND');
      const out = patchPost(x, { ...draftFor(x.title, x.platform, x.format), title: x.title || 'New post', status: 'draft' }, 'written for you');
      out.grade = fullGrade(CANNED_GRADE);
      out.score = CANNED_GRADE.score;
      return ok(res, out);
    }
    const np = mkPost({ ...draftFor(body.topic, body.platform || 'linkedin', body.format || 'post'), pillar: body.pillar || null, angle: body.angle || null, status: 'draft', grade: fullGrade(CANNED_GRADE), score: CANNED_GRADE.score });
    np.publishMode = modeFor(np);
    S.posts.push(np);
    addVersion(np, 'written for you');
    return ok(res, np, 201);
  }
  if (r === '/generate/repurpose' && m === 'POST') {
    if (!body.source || body.source.length < 200) return fail(res, 400, 'Paste a longer piece.', 'VALIDATION');
    const made = [];
    const plan = [['linkedin', 'post', 3], ['x', 'thread', 5], ['instagram', 'video_script', 2]];
    for (const [pf, fmt, n] of plan) for (let i = 0; i < n; i++) {
      const np = mkPost({ ...draftFor(`${body.title || 'Your piece'} part ${i + 1}`, pf, fmt), status: 'draft', grade: fullGrade(CANNED_GRADE), score: CANNED_GRADE.score });
      np.publishMode = modeFor(np);
      S.posts.push(np);
      addVersion(np, 'repurposed');
      made.push(np);
    }
    return ok(res, { posts: made });
  }

  // library
  if (r === '/folders' && m === 'GET') return ok(res, S.folders.filter((f) => !f.deletedAt).map((f) => ({ ...f, postCount: live().filter((x) => x.folderId === f.id).length })));
  if (r === '/folders' && m === 'POST') { const f = { id: crypto.randomUUID(), name: body.name }; S.folders.push(f); return ok(res, { ...f, postCount: 0 }, 201); }
  if ((mm = r.match(/^\/folders\/([^/]+)$/))) {
    const f = S.folders.find((y) => y.id === mm[1]);
    if (!f) return fail(res, 404, "That folder wasn't found.", 'NOT_FOUND');
    if (m === 'PATCH') { f.name = body.name; return ok(res, { ...f, postCount: 0 }); }
    if (m === 'DELETE') { f.deletedAt = true; live().forEach((x) => { if (x.folderId === f.id) x.folderId = null; }); return ok(res, { id: f.id }); }
  }
  if (r === '/media' && m === 'GET') return ok(res, S.media.filter((x) => !x.deletedAt));
  if (r === '/media' && m === 'POST') {
    const boundary = (ctype.match(/boundary=(.+)$/) || [])[1];
    if (!boundary) return fail(res, 400, 'Upload a PNG, JPEG or WebP image.', 'VALIDATION');
    const text = raw.toString('latin1');
    const fname = (text.match(/filename="([^"]+)"/) || [])[1] || 'upload.png';
    const mime = (text.match(/Content-Type: ([^\r\n]+)/) || [])[1] || 'image/png';
    if (!/^image\/(png|jpeg|webp)$/.test(mime)) return fail(res, 400, 'Upload a PNG, JPEG or WebP image.', 'VALIDATION');
    const start = text.indexOf('\r\n\r\n') + 4;
    const end = text.lastIndexOf(`\r\n--${boundary}`);
    const bytes = raw.subarray(start, end);
    const item = { id: crypto.randomUUID(), url: `data:${mime};base64,${bytes.toString('base64')}`, filename: fname, mimeType: mime, sizeBytes: bytes.length, createdAt: new Date().toISOString() };
    S.media.push(item);
    return ok(res, item, 201);
  }
  if ((mm = r.match(/^\/media\/([^/]+)$/)) && m === 'DELETE') { const x = S.media.find((y) => y.id === mm[1]); if (x) x.deletedAt = true; return ok(res, { id: mm[1] }); }

  // analytics
  if (r === '/analytics') {
    const all = live();
    const a = SEED.sampleAnalytics;
    const top = all.filter((x) => S.metrics[x.id]).map((x) => ({ postId: x.id, title: x.title, platform: x.platform, metrics: S.metrics[x.id], leadsCreated: S.metrics[x.id].leadsCreated ?? null, source: 'sample' }));
    const t = today();
    const byPillar = {};
    const byPlatform = {};
    for (const x of all) { if (x.pillar) byPillar[x.pillar] = (byPillar[x.pillar] || 0) + 1; byPlatform[x.platform] = (byPlatform[x.platform] || 0) + 1; }
    return ok(res, {
      source: 'sample', label: 'Sample data', range: { from: addDays(t, -29), to: t },
      totals: { posts: all.length, published: all.filter((x) => x.status === 'published').length, scheduled: all.filter((x) => x.status === 'scheduled').length, reach: a.reach, engagementRate: a.engagementRate, newFollowers: a.newFollowers, leadsFromPosts: a.leadsFromPosts },
      bestTimes: a.bestTimes,
      followerGrowth: a.followerGrowth.map((g) => ({ weekStart: addDays(t, g.weekOffset * 7 - wIdx(t)), followers: g.followers })),
      topPosts: top,
      byPillar: Object.entries(byPillar).map(([pillar, posts]) => ({ pillar, posts })),
      byPlatform: Object.entries(byPlatform).map(([platform, posts]) => ({ platform, posts })),
    });
  }
  if (r === '/seed-showcase' && m === 'POST') { reset(); return ok(res, { created: S.posts.length }); }

  return fail(res, 404, 'Not found', 'NOT_FOUND');
});

server.listen(PORT, '127.0.0.1', () => process.stdout.write(`content-studio mock backend on http://127.0.0.1:${PORT}\n`));
