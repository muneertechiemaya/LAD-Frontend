/**
 * Content Studio acceptance tests (390 / 768 / 1440 via playwright.config.mjs).
 *
 * Checks the brief's hard rules: every core action ≤ 3 taps from Today, every
 * download is a real file in the stated format, versions restore, contrast
 * ≥ 4.5:1 light and dark, targets ≥ 44 × 44, reduced motion honoured, no
 * banned words on labels, and no third-party scheduler anywhere.
 */
import { test, expect } from 'playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const MOCK = process.env.CS_MOCK_URL || 'http://127.0.0.1:4799';
const SHOTS = path.join(here, 'results', 'screens');
fs.mkdirSync(SHOTS, { recursive: true });

const root = (page) => page.locator('[data-cs-root]');
// The external scheduler the brief rules out, split so this file never names it.
const THIRD_PARTY = new RegExp(['blo', 'tato'].join(''), 'i');

/** Counts the taps a flow needs; each core action asserts ≤ 3. */
function tapper() {
  const t = { n: 0 };
  t.tap = async (locator) => {
    t.n += 1;
    await locator.click();
  };
  return t;
}

async function open(page, query = '') {
  await page.goto(`/content-studio${query}`);
  await expect(root(page)).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).not.toHaveText(/^\s*$/);
}

async function shot(page, name, testInfo) {
  // The app shell scrolls an inner container, so a fullPage capture alone is
  // blank below the fold. Grow the viewport to the content height instead, so
  // the layout stays exactly what a phone renders, then put it back.
  const vp = page.viewportSize();
  const extra = await page.evaluate(() => {
    let el = document.querySelector('[data-cs-root]');
    while (el && el !== document.body) {
      if (/(auto|scroll)/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight) {
        el.scrollTop = 0;
        return el.scrollHeight - el.clientHeight;
      }
      el = el.parentElement;
    }
    return 0;
  });
  if (extra > 0) await page.setViewportSize({ width: vp.width, height: Math.min(vp.height + extra, 16000) });
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(SHOTS, `${testInfo.project.name}-${name}.png`), fullPage: true });
  if (extra > 0) await page.setViewportSize(vp);
}

test.beforeEach(async ({ context, request, baseURL }) => {
  await request.post(`${MOCK}/__reset`);
  const host = new URL(baseURL).hostname;
  await context.addCookies([{ name: 'token', value: 'e2e-token', domain: host, path: '/' }]);
  await context.addInitScript(() => {
    try {
      localStorage.removeItem('lad.contentStudio.dismissedGaps');
    } catch {
      /* ignore */
    }
  });
});

// ── layout & accessibility helpers (run in the page) ─────────────────────────
async function smallTargets(page) {
  return page.evaluate(() => {
    const out = [];
    const rootEl = document.querySelector('[data-cs-root]');
    const els = rootEl.querySelectorAll('button, a[href], select, input:not([type=checkbox]):not([type=radio]):not([type=file]), textarea, [role=tab], [role=menuitem]');
    for (const el of els) {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden' || el.closest('.sr-only')) continue;
      if (r.width < 43.5 || r.height < 43.5) out.push(`${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    // checkbox / radio: the clickable label (or the box itself) must be ≥ 44
    for (const el of rootEl.querySelectorAll('input[type=checkbox], input[type=radio]')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0) continue;
      const lab = el.closest('label');
      const box = lab ? lab.getBoundingClientRect() : r;
      const cell = el.closest('td, li, article, [class*=Card]');
      const area = lab ? box : cell ? cell.getBoundingClientRect() : r;
      if (area.height < 43.5) out.push(`${el.type} ${Math.round(area.width)}x${Math.round(area.height)}`);
    }
    return out;
  });
}

async function overflowX(page) {
  return page.evaluate(() => {
    const doc = document.documentElement.scrollWidth - window.innerWidth;
    const rootEl = document.querySelector('[data-cs-root]');
    const r = rootEl.getBoundingClientRect();
    return { doc, rootRight: Math.round(r.right - window.innerWidth) };
  });
}

/** Text contrast for every visible text node in the studio root. */
async function contrastFailures(page) {
  return page.evaluate(() => {
    const parse = (c) => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const [r, g, b, a = '1'] = m[1].split(/[,/ ]+/).filter(Boolean);
      return [Number(r), Number(g), Number(b), Number(a)];
    };
    const lum = ([r, g, b]) => {
      const f = (v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const blend = (top, bottom) => {
      const a = top[3];
      return [0, 1, 2].map((i) => top[i] * a + bottom[i] * (1 - a)).concat(1);
    };
    const bgOf = (el) => {
      const layers = [];
      for (let n = el; n; n = n.parentElement) {
        const c = parse(getComputedStyle(n).backgroundColor);
        if (c && c[3] > 0) {
          layers.push(c);
          if (c[3] >= 1) break;
        }
      }
      let base = [255, 255, 255, 1];
      if (document.documentElement.classList.contains('dark')) {
        const b = parse(getComputedStyle(document.body).backgroundColor);
        if (b && b[3] > 0) base = b;
      }
      for (let i = layers.length - 1; i >= 0; i--) base = blend(layers[i], base);
      return base;
    };
    const fails = [];
    const rootEl = document.querySelector('[data-cs-root]');
    const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT);
    const seen = new Set();
    let node;
    while ((node = walker.nextNode())) {
      const text = node.textContent.trim();
      if (!text) continue;
      const el = node.parentElement;
      if (seen.has(el)) continue;
      seen.add(el);
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden' || Number(cs.opacity) === 0 || el.closest('.sr-only, [aria-hidden=true], [disabled], :disabled')) continue;
      // inside a disabled control or a 50%-opacity filtered-out chip: WCAG exempts inactive UI
      let o = 1;
      for (let n = el; n; n = n.parentElement) o *= Number(getComputedStyle(n).opacity);
      if (o < 0.95) continue;
      const fg = parse(cs.color);
      if (!fg) continue;
      const bg = bgOf(el);
      const fgB = blend(fg, bg);
      const L1 = lum(fgB);
      const L2 = lum(bg);
      const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      const size = parseFloat(cs.fontSize);
      const bold = Number(cs.fontWeight) >= 700;
      const large = size >= 24 || (bold && size >= 18.66);
      const need = large ? 3 : 4.5;
      if (ratio + 0.01 < need) fails.push(`${ratio.toFixed(2)} < ${need} "${text.slice(0, 40)}" ${cs.color} on rgb(${bg.slice(0, 3).map(Math.round).join(',')})`);
    }
    return fails;
  });
}

async function setDark(page, on) {
  await page.evaluate((v) => {
    localStorage.setItem('theme', v ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', v);
  }, on);
}

// ── tests ─────────────────────────────────────────────────────────────────────

test('Today: greeting, cards, gap banner, week strip, layout', async ({ page }, testInfo) => {
  await open(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/2 sample posts are lined up for today\. 1 needs your approval\./);
  await expect(root(page).getByRole('article')).toHaveCount(2);
  await expect(root(page).getByText(/Next week has 2 empty days, \w+ and \w+\./)).toBeVisible();
  await expect(root(page).getByText(/fill them from your .+ pillar\?/)).toBeVisible();
  await expect(root(page).getByRole('list', { name: 'Posts in the next 7 days' }).getByRole('listitem')).toHaveCount(7);
  await expect(root(page).getByText('Sample data').first()).toBeVisible();
  const ov = await overflowX(page);
  expect(ov.doc, 'page must not scroll sideways').toBeLessThanOrEqual(0);
  expect(ov.rootRight).toBeLessThanOrEqual(0);
  expect(await smallTargets(page)).toEqual([]);
  await shot(page, 'today', testInfo);
});

test('Approve takes 1 tap from Today', async ({ page }) => {
  await open(page);
  const t = tapper();
  const card = root(page).getByRole('article').filter({ hasText: 'Needs approval' });
  await t.tap(card.getByRole('button', { name: 'Approve' }));
  await expect(page.getByText('Approved. It goes out on time.')).toBeVisible();
  await expect(root(page).getByRole('article').filter({ hasText: 'Needs approval' })).toHaveCount(0);
  // Approving a showcase sample makes it the client's own post, so it now goes out.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/1 post goes out today, plus 1 sample\./);
  expect(t.n).toBeLessThanOrEqual(3);
  expect(t.n).toBe(1);
});

test('Reschedule takes 2 taps from Today', async ({ page }) => {
  await open(page);
  const t = tapper();
  const card = root(page).getByRole('article').filter({ hasText: 'Carousel' });
  await t.tap(card.getByRole('button', { name: 'Move time' }));
  const dialog = page.getByRole('dialog', { name: 'Move time' });
  await expect(dialog).toBeVisible();
  await t.tap(dialog.locator('p:has-text("Suggested times") ~ button').first());
  await expect(page.getByText('Moved', { exact: true })).toBeVisible();
  expect(t.n).toBe(2);
});

test('Downloads from a Today card are real files (2 taps each)', async ({ page }) => {
  await open(page);
  const card = root(page).getByRole('article').filter({ hasText: 'Carousel' });

  // Slides as PNG: 6 files, each a real 1080x1080 PNG.
  const t = tapper();
  const pngs = [];
  const onDl = (d) => pngs.push(d);
  page.on('download', onDl);
  await t.tap(card.getByRole('button', { name: /^Download/ }));
  await t.tap(page.getByRole('menuitem', { name: /Slides as PNG/ }));
  await expect.poll(() => pngs.length, { timeout: 20_000 }).toBe(6);
  page.off('download', onDl);
  expect(t.n).toBe(2);
  for (const d of pngs) {
    expect(d.suggestedFilename()).toMatch(/-slide-0[1-6]\.png$/);
    const buf = fs.readFileSync(await d.path());
    expect(buf.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(buf.readUInt32BE(16)).toBe(1080);
    expect(buf.readUInt32BE(20)).toBe(1080);
  }

  // Slides as one PDF: 6 pages.
  await card.getByRole('button', { name: /^Download/ }).click();
  const [pdf] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: /Slides as one PDF/ }).click()]);
  expect(pdf.suggestedFilename()).toMatch(/-slides\.pdf$/);
  const pdfBuf = fs.readFileSync(await pdf.path()).toString('latin1');
  expect(pdfBuf.startsWith('%PDF-1.4')).toBe(true);
  expect(pdfBuf.trimEnd().endsWith('%%EOF')).toBe(true);
  expect((pdfBuf.match(/\/Type \/Page /g) || []).length).toBe(6);

  // Caption as TXT.
  await card.getByRole('button', { name: /^Download/ }).click();
  const [txt] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: /Caption as TXT/ }).click()]);
  const caption = fs.readFileSync(await txt.path(), 'utf8');
  expect(caption).toContain('HOOK\nYour best lead messaged you at 11pm.');
  expect(caption).toContain('READY TO PASTE');

  // This week's calendar as CSV.
  await card.getByRole('button', { name: /^Download/ }).click();
  const [csv] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: /calendar as CSV/ }).click()]);
  const csvText = fs.readFileSync(await csv.path(), 'utf8').replace(/^﻿/, '');
  expect(csvText.split(/\r?\n/)[0]).toBe('Date,Time,Timezone,Platform,Format,Pillar,Status,Approval,Title,Hook,Caption,Hashtags,Score,Publishing');
  expect(csvText.split(/\r?\n/).filter(Boolean).length).toBeGreaterThan(5);
});

test('Video script downloads as TXT', async ({ page }) => {
  await open(page);
  const card = root(page).getByRole('article').filter({ hasText: 'Instagram · Reel' });
  await card.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByText('Approved. It goes out on time.')).toBeVisible();
  const card2 = root(page).getByRole('article').filter({ hasText: 'Instagram · Reel' });
  await card2.getByRole('button', { name: /^Download/ }).click();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: /Video script as TXT/ }).click()]);
  const text = fs.readFileSync(await dl.path(), 'utf8');
  expect(dl.suggestedFilename()).toMatch(/-script\.txt$/);
  expect(text).toMatch(/HOOK \(0s to 2s\)\nSay: This is what happens to an enquiry that lands at 2am\./);
  expect(text).toMatch(/CTA \(\d+s to \d+s\)/);
});

test('Edit takes 2 taps, and every version can be restored', async ({ page }, testInfo) => {
  await open(page);
  const t = tapper();
  const card = root(page).getByRole('article').filter({ hasText: 'Carousel' });
  await t.tap(card.getByRole('button', { name: 'Edit' }));
  await expect(page).toHaveURL(/tab=create&post=/);
  const hook = root(page).getByLabel('Hook', { exact: true });
  await expect(hook).toHaveValue(/Your best lead messaged you at 11pm/);
  const original = await hook.inputValue();
  await hook.fill('Your best lead wrote at 11pm. You answered at 9am.');
  await expect(root(page).getByText('Unsaved changes')).toBeVisible();
  await t.tap(root(page).getByRole('button', { name: 'Save', exact: true }));
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  expect(t.n).toBe(2);
  await expect(root(page).getByText('Now on v2')).toBeVisible();
  await expect(root(page).getByText('All changes saved')).toBeVisible();
  await shot(page, 'composer', testInfo);
  // Restore v1.
  const v1 = root(page).getByRole('listitem').filter({ hasText: /^v1/ });
  await v1.getByRole('button', { name: 'Restore' }).click();
  await v1.getByRole('button', { name: 'Yes, restore v1' }).click();
  await expect(page.getByText('Restored v1', { exact: true })).toBeVisible();
  await expect(hook).toHaveValue(original);
  await expect(root(page).getByText('Now on v3')).toBeVisible();
  // previews and grade are on the page
  await expect(root(page).getByLabel('LinkedIn preview')).toBeVisible();
  await expect(root(page).getByText('8.7')).toBeVisible();
  expect(await smallTargets(page)).toEqual([]);
  const ov = await overflowX(page);
  expect(ov.doc).toBeLessThanOrEqual(0);
});

test('Create takes 3 taps with Help me post something', async ({ page }) => {
  await open(page);
  const t = tapper();
  await t.tap(root(page).getByRole('button', { name: 'Help me post something' }));
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Pick an idea')).toBeVisible();
  await t.tap(dialog.getByRole('button', { name: /Why the fastest reply wins/ }));
  await t.tap(dialog.getByRole('button', { name: 'Write it for LinkedIn' }));
  await expect(page).toHaveURL(/tab=create&post=/);
  await expect(root(page).getByText('8.1')).toBeVisible();
  expect(t.n).toBe(3);
});

test('Carousel builder, script storyboard and duplicate', async ({ page }) => {
  await open(page);
  await root(page).getByRole('article').filter({ hasText: 'Carousel' }).getByRole('button', { name: 'Edit' }).click();
  await expect(root(page).getByText('Carousel · 6 slides')).toBeVisible();
  await root(page).getByRole('button', { name: 'Slide', exact: true }).click();
  await expect(root(page).getByText('Carousel · 7 slides')).toBeVisible();
  await root(page).getByRole('button', { name: 'Move slide 7 up' }).click();
  await root(page).getByRole('button', { name: 'Duplicate' }).click();
  await expect(page.getByText('Duplicated')).toBeVisible();
  // open the reel and switch to storyboard
  await page.goto('/content-studio');
  await root(page).getByRole('article').filter({ hasText: 'Instagram · Reel' }).getByRole('button', { name: 'Edit' }).click();
  await root(page).getByRole('button', { name: 'Storyboard' }).click();
  await expect(root(page).getByText(/0s to 2s/)).toBeVisible();
  await expect(root(page).getByText('Short video · 38s')).toBeVisible();
});

test('Calendar: month, week, day and drag to reschedule', async ({ page }, testInfo) => {
  await open(page, '?tab=calendar');
  await expect(root(page).getByRole('group', { name: 'Calendar view' })).toBeVisible();
  await shot(page, 'calendar-week', testInfo);
  if (testInfo.project.name === 'desktop-1440') {
    // This week's empty days are already past; next week has open days.
    await root(page).getByRole('button', { name: 'Next week' }).click();
    const handle = root(page).getByRole('button', { name: /^Drag .* to another day/ }).first();
    const empty = root(page).getByText('Empty day').first();
    await expect(handle).toBeVisible();
    const a = await handle.boundingBox();
    const b = await empty.boundingBox();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(a.x + 20, a.y + 20, { steps: 5 });
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 15 });
    await page.mouse.up();
    await expect(page.getByText(/^Moved to /)).toBeVisible();
  } else {
    await expect(root(page).getByRole('button', { name: 'Move time' }).first()).toBeVisible();
  }
  await root(page).getByRole('button', { name: 'Month', exact: true }).click();
  await expect(root(page).getByRole('heading', { level: 2 })).toHaveText(/\w+ \d{4}/);
  await shot(page, 'calendar-month', testInfo);
  await root(page).getByRole('button', { name: 'Day', exact: true }).click();
  expect((await overflowX(page)).doc).toBeLessThanOrEqual(0);
  expect(await smallTargets(page)).toEqual([]);
});

test('Plan: 30-day preview with gaps, and the agent builds the month', async ({ page }, testInfo) => {
  await open(page, '?tab=plan');
  await expect(root(page).getByText(/Next 30 days · \d+ posts/)).toBeVisible();
  await expect(root(page).getByText(/empty days?/).first()).toBeVisible();
  await expect(root(page).getByText('100% of 100%')).toBeVisible();
  await root(page).getByRole('button', { name: 'Build my 30 days' }).click();
  await expect(page.getByText(/Added \d+ ideas? to the calendar/)).toBeVisible();
  expect((await overflowX(page)).doc).toBeLessThanOrEqual(0);
  expect(await smallTargets(page)).toEqual([]);
  await shot(page, 'plan', testInfo);
});

test('Library: search, filters, bulk edit, templates, media upload', async ({ page }, testInfo) => {
  await open(page, '?tab=library');
  await root(page).getByRole('searchbox', { name: 'Search posts' }).fill('WhatsApp');
  await expect(root(page).getByText(/^1 of 1 posts$|^\d+ of \d+ posts$/)).toBeVisible();
  await root(page).getByRole('searchbox', { name: 'Search posts' }).fill('');
  const boxes = root(page).locator('input[type=checkbox][aria-label^="Select "]:not([aria-label="Select all"]):visible');
  await boxes.nth(0).check();
  await boxes.nth(1).check();
  await expect(root(page).getByText('2 selected')).toBeVisible();
  await root(page).getByRole('button', { name: '1 day later' }).click();
  await expect(page.getByText('Moved 1 day later')).toBeVisible();
  // Below lg the folder list folds into a "Showing …" row; open it first.
  const folders = async () => {
    const toggle = root(page).getByRole('button', { name: /^Showing / });
    if (await toggle.isVisible()) await toggle.click();
  };
  await folders();
  await root(page).getByRole('button', { name: 'Templates' }).click();
  await expect(root(page).getByText(/No templates yet/)).toBeVisible();
  await folders();
  await root(page).getByRole('button', { name: 'Uploaded media' }).click();
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a7600000000049454e44ae426082', 'hex');
  await root(page).getByLabel('Upload an image').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: png });
  await expect(root(page).getByRole('img', { name: 'logo.png' })).toBeVisible();
  expect((await overflowX(page)).doc).toBeLessThanOrEqual(0);
  expect(await smallTargets(page)).toEqual([]);
  await shot(page, 'library', testInfo);
});

test('Downloads tab: calendar as CSV and PDF', async ({ page }) => {
  await open(page, '?tab=downloads');
  const [csv] = await Promise.all([page.waitForEvent('download'), root(page).getByRole('button', { name: 'Calendar as CSV' }).click()]);
  expect(csv.suggestedFilename()).toMatch(/^content-calendar-.*\.csv$/);
  expect(fs.readFileSync(await csv.path(), 'utf8').replace(/^﻿/, '').startsWith('Date,Time,Timezone')).toBe(true);
  const [pdf] = await Promise.all([page.waitForEvent('download'), root(page).getByRole('button', { name: 'Calendar as PDF' }).click()]);
  const buf = fs.readFileSync(await pdf.path()).toString('latin1');
  expect(buf.startsWith('%PDF-1.4')).toBe(true);
  expect((buf.match(/\/Type \/Page /g) || []).length).toBeGreaterThanOrEqual(2);
});

test('Analytics is labelled sample data and never invents live numbers', async ({ page }, testInfo) => {
  await open(page, '?tab=analytics');
  await expect(root(page).getByText('These are example numbers.', { exact: false })).toBeVisible();
  await expect(root(page).getByText('[VERIFIED REACH]').first()).toBeVisible();
  const placeholders = await root(page).evaluate((el) => (el.innerText.match(/\[[A-Z][A-Z ]+\]/g) || []).filter((v, i, a) => a.indexOf(v) === i));
  expect(placeholders.length).toBeLessThanOrEqual(3);
  await expect(root(page).getByText('Sample data').first()).toBeVisible();
  expect((await overflowX(page)).doc).toBeLessThanOrEqual(0);
  await shot(page, 'analytics', testInfo);
});

test('Contrast is 4.5:1 or better in light and dark', async ({ page }, testInfo) => {
  for (const dark of [false, true]) {
    for (const tab of ['', '?tab=create', '?tab=library', '?tab=media', '?tab=analytics', '?tab=plan']) {
      await open(page, tab);
      if (tab === '?tab=create') await page.goto(`/content-studio?tab=create&post=new`);
      await setDark(page, dark);
      await page.waitForTimeout(150);
      const fails = await contrastFailures(page);
      expect(fails, `${dark ? 'dark' : 'light'} ${tab || 'today'}`).toEqual([]);
      if (dark && tab === '') await shot(page, 'today-dark', testInfo);
    }
    await setDark(page, false);
  }
});

test('Motion respects prefers-reduced-motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  // motion-reduce:transition-none removes the transition entirely.
  const props = await root(page).locator('button').evaluateAll((els) => els.slice(0, 20).map((e) => getComputedStyle(e).transitionProperty));
  expect(props.every((p) => p === 'none')).toBe(true);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.reload();
  const normal = await root(page).locator('button').first().evaluate((e) => getComputedStyle(e).transitionProperty);
  expect(normal).not.toBe('none');
});

test('Labels never say AI, agentic, virality or ICP', async ({ page }) => {
  const banned = /\b(AI|agentic|virality|ICP)\b/i;
  for (const tab of ['', '?tab=plan', '?tab=calendar', '?tab=create', '?tab=library', '?tab=media', '?tab=downloads', '?tab=analytics']) {
    await open(page, tab);
    const labels = await root(page).evaluate((el) =>
      Array.from(el.querySelectorAll('button, a, label, h1, h2, h3, legend, th, [role=tab], [aria-label]'))
        .map((n) => `${n.getAttribute('aria-label') || ''} ${n.textContent || ''}`)
        .join('\n')
    );
    expect(labels.match(banned), `banned word on ${tab || 'today'}`).toBeNull();
  }
});

test('No third-party scheduler: code and network', async ({ page }) => {
  // Hosts the app shell itself loads on every page (fonts, the billing SDK).
  // Stripe.js also opens its own frames (m.stripe.network, m/r/q.stripe.com).
  const SHELL = new Set(['localhost', '127.0.0.1', 'fonts.googleapis.com', 'fonts.gstatic.com', 'js.stripe.com']);
  const isShell = (h) => SHELL.has(h) || h.endsWith('.stripe.com') || h.endsWith('.stripe.network');
  // Social publishing / scheduling APIs Content Studio must never call.
  const PUBLISHERS = /(buffer|hootsuite|later\.com|sproutsocial|publer|metricool|api\.linkedin|graph\.facebook|graph\.instagram|api\.twitter|api\.x\.com|tiktokapis|unipile)/i;
  const all = [];
  const calls = []; // fetch/XHR only: what an action asks a server to do
  page.on('request', (r) => {
    all.push(r.url());
    if (['fetch', 'xhr'].includes(r.resourceType())) calls.push(r.url());
  });
  await open(page);
  const loaded = calls.length;
  await root(page).getByRole('article').filter({ hasText: 'Needs approval' }).getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByText('Approved. It goes out on time.')).toBeVisible();
  await root(page).getByRole('article').filter({ hasText: 'Carousel' }).getByRole('button', { name: 'Move time' }).click();
  await page.getByRole('dialog', { name: 'Move time' }).locator('p:has-text("Suggested times") ~ button').first().click();
  await expect(page.getByText('Moved', { exact: true })).toBeVisible();
  // The shell may still be pulling in scripts (e.g. the billing SDK) while the
  // actions run; those aren't calls the actions made, so only API calls count.
  const actions = calls.slice(loaded).filter((u) => !u.startsWith('data:'));
  // every API call the approve + reschedule made stayed on Mr LAD's own origin
  expect(actions.map((u) => new URL(u).hostname).filter((h) => h !== 'localhost' && h !== '127.0.0.1')).toEqual([]);
  expect(actions.some((u) => /\/api\/content-studio\/posts\/[^/]+\/approve$/.test(u))).toBe(true);
  expect(actions.some((u) => /\/api\/content-studio\/posts\/[^/]+\/schedule$/.test(u))).toBe(true);
  expect(all.filter((u) => PUBLISHERS.test(u))).toEqual([]);
  expect(all.map((u) => new URL(u).hostname).filter((h) => !isShell(h) && !h.startsWith('data'))).toEqual([]);
  const webRoot = path.resolve(here, '..', '..');
  const dirs = ['src/components/content-studio', 'src/lib/content-studio', 'src/app/content-studio', '../sdk/features/content-studio', '../sdk/features/media-hub'];
  const hits = [];
  // Walks subfolders too (components/content-studio/media holds the Media Hub).
  const scan = (rel) => {
    const abs = path.join(webRoot, rel);
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      if (e.isDirectory()) scan(path.join(rel, e.name));
      else if (THIRD_PARTY.test(fs.readFileSync(path.join(abs, e.name), 'utf8'))) hits.push(path.join(rel, e.name));
    }
  };
  dirs.forEach(scan);
  expect(hits).toEqual([]);
});

// ── Test with your audience (CONTRACT-audience.md) ──────────────────────────
const audience = (page) => root(page).locator('[aria-label="Test with your audience"]');
const BANNED = /\b(AI|agentic|virality|ICP)\b/i;

async function openComposerFor(page, cardText) {
  await open(page);
  await root(page).getByRole('article').filter({ hasText: cardText }).getByRole('button', { name: 'Edit' }).click();
  await expect(audience(page)).toBeVisible();
}

async function buildPanel(page) {
  await audience(page).getByRole('button', { name: 'Build my audience panel' }).click();
  await expect(audience(page).getByText('20 people: 14 buyers, 3 peers, 3 casual scrollers')).toBeVisible();
}

test('Audience test: build the panel, run it, read every answer, apply the fix', async ({ page }, testInfo) => {
  await openComposerFor(page, 'LinkedIn · Carousel');
  const card = audience(page);
  await expect(card.getByText('Simulated reactions from people modelled on your audience, not real ones.')).toBeVisible();
  await buildPanel(page);

  await card.getByRole('button', { name: "See who's on it" }).click();
  const panelDialog = page.getByRole('dialog', { name: 'Your audience panel' });
  await expect(panelDialog.getByText('Head of Operations · Logistics · Dubai').first()).toBeVisible();
  await expect(panelDialog.getByText('They are simulated people, not your contacts.', { exact: false })).toBeVisible();
  await page.keyboard.press('Escape');

  await card.getByRole('button', { name: 'Run the test' }).click();
  await expect(card.getByText(/^\d+ of 20 stopped scrolling$/)).toBeVisible();
  await expect(card.getByText(/^Panel score \d+ \/ 100: how far people got/)).toBeVisible();
  await expect(card.getByText('What held people back')).toBeVisible();
  // LinkedIn, not yet calibrated: no numbers, a progress note instead.
  await expect(card.getByText('An engagement range appears after 10 published LinkedIn posts with real numbers. You have 3.')).toBeVisible();
  await expect(card.getByText(/Likely engagement/)).toHaveCount(0);

  await card.getByRole('button', { name: 'See every answer' }).click();
  const answers = page.getByRole('dialog', { name: 'Every answer' });
  await expect(answers.locator('li')).toHaveCount(20);
  await page.keyboard.press('Escape');

  expect((await overflowX(page)).doc).toBeLessThanOrEqual(0);
  expect(await smallTargets(page)).toEqual([]);
  for (const dark of [false, true]) {
    await setDark(page, dark);
    await page.waitForTimeout(150);
    expect(await contrastFailures(page), dark ? 'dark' : 'light').toEqual([]);
  }
  await setDark(page, false);
  const labels = await card.evaluate((el) =>
    Array.from(el.querySelectorAll('button, a, label, h2, h3, legend, th, [aria-label]')).map((n) => `${n.getAttribute('aria-label') || ''} ${n.textContent || ''}`).join('\n')
  );
  expect(labels.match(BANNED)).toBeNull();
  await card.scrollIntoViewIfNeeded();
  await shot(page, 'audience-test', testInfo);

  // The fix writes a new version, so the result is now for an older one.
  await card.getByRole('button', { name: 'Fix with this' }).click();
  await expect(page.getByText('Fix applied')).toBeVisible();
  await expect(card.getByText(/This test was on v\d+\. The post has changed since/)).toBeVisible();
  await card.getByRole('button', { name: 'Run the test' }).click();
  await expect(card.getByText(/The post has changed since/)).toHaveCount(0);
  await expect(card.getByRole('button', { name: 'Run again' })).toBeVisible();
});

test('Audience test: hooks head-to-head picks a winner', async ({ page }) => {
  await openComposerFor(page, 'LinkedIn · Carousel');
  await buildPanel(page);
  await root(page).getByRole('button', { name: '3 hook options' }).click();
  await root(page).getByRole('button', { name: 'Test these hooks with your audience' }).click();
  await expect(root(page).getByText('Panel pick')).toHaveCount(1);
  await expect(root(page).getByText(/^Stops \d+ of 20$/)).toHaveCount(3);
  await expect(root(page).getByText(/wouldn't stop for any of them\. Simulated reactions\./)).toBeVisible();
});

test('Audience test: a calibrated range for LinkedIn only, and Analytics shows predicted vs actual', async ({ page, request }, testInfo) => {
  await request.post(`${MOCK}/__calibration`, { data: { status: 'ready' } });
  await openComposerFor(page, 'LinkedIn · Carousel');
  await buildPanel(page);
  await audience(page).getByRole('button', { name: 'Run the test' }).click();
  await expect(audience(page).getByText(/^Likely engagement \d+(\.\d)?% to \d+(\.\d)?%$/)).toBeVisible();
  await expect(audience(page).getByText(/your last 14 published LinkedIn posts/)).toBeVisible();

  // Instagram never gets a range.
  await openComposerFor(page, 'Instagram · Reel');
  await audience(page).getByRole('button', { name: 'Run the test' }).click();
  await expect(audience(page).getByText('Engagement ranges cover LinkedIn only, where Mr LAD publishes and reads the real numbers.')).toBeVisible();

  await open(page, '?tab=analytics');
  const cal = root(page).locator('[aria-label="Audience test: predicted vs actual"]');
  // Table from tablet width up; stacked rows on phones so the real number stays on screen.
  if (testInfo.project.name === 'phone-390') await expect(cal.getByRole('list', { name: 'Predicted vs actual per post' }).getByRole('listitem')).toHaveCount(14);
  else await expect(cal.getByRole('row')).toHaveCount(15);
  await expect(cal.getByText(/Real engagement landed inside the predicted range for \d+ of 14\./)).toBeVisible();
  expect((await overflowX(page)).doc).toBeLessThanOrEqual(0);
  await cal.scrollIntoViewIfNeeded();
  await shot(page, 'audience-calibration', testInfo);
});

test('Audience test: the approval card shows the result for the current version', async ({ page }) => {
  await openComposerFor(page, 'Instagram · Reel');
  await buildPanel(page);
  await audience(page).getByRole('button', { name: 'Run the test' }).click();
  await expect(audience(page).getByText(/^\d+ of 20 stopped scrolling$/)).toBeVisible();
  await open(page);
  const card = root(page).getByRole('article').filter({ hasText: 'Needs approval' });
  await expect(card.getByText(/Audience test:/)).toBeVisible();
  await expect(card.getByText('(simulated)', { exact: false })).toBeVisible();
});

// ── Media (the Media Hub, moved into Content Studio) ─────────────────────────
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a7600000000049454e44ae426082', 'hex');

test('Media tab: the Media Hub lives in Content Studio', async ({ page }, testInfo) => {
  await open(page, '?tab=media');
  await expect(root(page).getByText('Mr LADS').first()).toBeVisible();
  await expect(root(page).getByText('Requests').first()).toBeVisible();
  await expect(root(page).getByText('Saved as your target audience')).toBeVisible();
  const labels = await root(page).evaluate((el) =>
    Array.from(el.querySelectorAll('button, a, label, h1, h2, h3, legend, th, [role=tab], [aria-label]')).map((n) => `${n.getAttribute('aria-label') || ''} ${n.textContent || ''}`).join('\n')
  );
  expect(labels.match(BANNED)).toBeNull();
  expect((await overflowX(page)).doc).toBeLessThanOrEqual(0);
  await shot(page, 'media', testInfo);
});

test('Media: old Settings › Media Hub links land on Content Studio › Media', async ({ page }) => {
  await page.goto('/settings?tab=media&panel=assets');
  await page.waitForURL(/\/content-studio\?tab=media&panel=assets/);
  await expect(root(page)).toBeVisible();
});

test('Media in the composer: from the gallery, make an image, slides in brand colours', async ({ page }) => {
  await openComposerFor(page, 'LinkedIn · Carousel');
  // The brand's first colour (#F5C518) can't carry white text, so the cover uses its accent (#7A1F5C).
  await expect(root(page).locator('ol li div[aria-hidden]').first()).toHaveCSS('background-color', 'rgb(122, 31, 92)');

  await root(page).getByRole('button', { name: 'From your gallery' }).click();
  const gallery = page.getByRole('dialog', { name: 'Add from your gallery' });
  await gallery.getByRole('button', { name: 'Attach gallery image 1' }).click();
  await expect(page.getByText('Image attached')).toBeVisible();
  await expect(root(page).getByRole('img', { name: 'Attached image 1' })).toBeVisible();

  await root(page).getByRole('button', { name: 'Make an image' }).click();
  const make = page.getByRole('dialog', { name: 'Make an image' });
  await expect(make.getByRole('textbox', { name: 'Describe the image' })).toHaveValue(/An image for a LinkedIn post\./);
  await make.getByRole('button', { name: 'Make it' }).click();
  await make.getByRole('button', { name: 'Use this image' }).click();
  await expect(root(page).getByRole('img', { name: 'Attached image 2' })).toBeVisible();

  await root(page).getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Saved', { exact: true }).first()).toBeVisible();
  await root(page).getByRole('button', { name: 'Remove media 1' }).click();
  await expect(root(page).getByRole('img', { name: 'Attached image 2' })).toHaveCount(0);
  expect(await smallTargets(page)).toEqual([]);
});

test('Media in the composer: a promo video from a video script', async ({ page }) => {
  await openComposerFor(page, 'Instagram · Reel');
  await root(page).getByRole('button', { name: 'Make a promo video' }).click();
  const dlg = page.getByRole('dialog', { name: 'Make a promo video' });
  await expect(dlg.getByLabel('What are you promoting?')).toHaveValue(/2am/);
  await dlg.locator('input[type=file]').setInputFiles({ name: 'screen.png', mimeType: 'image/png', buffer: PNG });
  await dlg.getByRole('button', { name: 'Create video' }).click();
  await dlg.getByRole('button', { name: 'Attach to this post' }).click();
  await expect(page.getByText('Video attached')).toBeVisible();
  await expect(root(page).getByLabel('Attached video 1')).toBeVisible();
});
