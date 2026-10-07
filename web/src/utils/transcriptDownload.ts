/**
 * Download a call transcript as .txt or .doc.
 *
 * Why no PDF, and no .docx library
 * --------------------------------
 * These transcripts are mostly Telugu. A JS PDF writer (jsPDF, pdfmake) maps
 * characters to glyphs one-to-one out of the embedded font's cmap and does no
 * OpenType shaping, so Indic conjuncts and vowel signs come out reordered or
 * broken — a file that looks fine to an English-reading developer and is
 * mangled to the person it is sent to. Word and the browser both shape text
 * themselves, so handing them markup and letting them do it is the only way to
 * get this right without shipping a shaping engine.
 *
 * The .doc here is therefore Word-flavoured HTML served as application/msword:
 * the long-standing trick, no dependency, and correct Telugu in Word, Google
 * Docs, LibreOffice and Pages. The one cost is that some Word builds show
 * "the file format and extension don't match" on open; the document is fine
 * after clicking through. A true .docx would remove that prompt at the price of
 * a ~200 KB dependency — worth revisiting if anyone complains.
 */

import { saveBlob } from "./audioTrim";

export type TranscriptSegment = {
  time?: string;
  speaker?: string;
  text: string;
};

export type TranscriptMeta = {
  callId?: string | null;
  leadName?: string | null;
  phone?: string | null;
  agentName?: string | null;
  agentId?: number | string | null;
  startedAt?: string | null;
  durationSeconds?: number | null;
  status?: string | null;
};

export type TranscriptFormat = "txt" | "doc";

const isAgent = (speaker?: string) => {
  const s = (speaker || "").toLowerCase();
  return s.includes("agent") || s.includes("assistant") || s.includes("ai") || s.includes("bot");
};

/** Elapsed time from the first segment, which reads better than wall-clock. */
function offsets(segments: TranscriptSegment[]): string[] {
  const times = segments.map((s) => {
    const t = s.time ? Date.parse(s.time) : NaN;
    return Number.isNaN(t) ? null : t;
  });
  const first = times.find((t) => t !== null) ?? null;
  return times.map((t) =>
    t === null || first === null ? "" : `${((t - first) / 1000).toFixed(1)}s`,
  );
}

function header(meta: TranscriptMeta, segments: TranscriptSegment[]) {
  const callers = segments.filter((s) => !isAgent(s.speaker)).length;
  const agents = segments.length - callers;
  const rows: Array<[string, string]> = [];
  if (meta.leadName) rows.push(["Name", meta.leadName]);
  if (meta.phone) rows.push(["Number", meta.phone]);
  if (meta.startedAt) {
    const d = new Date(meta.startedAt);
    rows.push(["Date", Number.isNaN(d.getTime()) ? String(meta.startedAt) : d.toLocaleString()]);
  }
  if (meta.durationSeconds != null) rows.push(["Duration", `${Math.round(meta.durationSeconds)}s`]);
  if (meta.agentName) rows.push(["Agent", meta.agentId ? `${meta.agentName} (id ${meta.agentId})` : meta.agentName]);
  if (meta.status) rows.push(["Status", meta.status]);
  rows.push(["Turns", `${callers} caller / ${agents} agent`]);
  if (meta.callId) rows.push(["Call ID", meta.callId]);
  return rows;
}

export function buildTranscriptText(segments: TranscriptSegment[], meta: TranscriptMeta): string {
  const off = offsets(segments);
  const rows = header(meta, segments);
  const pad = Math.max(...rows.map(([k]) => k.length));
  const bar = "=".repeat(64);
  const lines = [
    "VOICE AGENT CALL TRANSCRIPT",
    bar,
    ...rows.map(([k, v]) => `${k.padEnd(pad)} : ${v}`),
    bar,
    "",
  ];
  segments.forEach((s, i) => {
    const text = (s.text || "").trim();
    if (!text) return;
    const who = isAgent(s.speaker) ? "AGENT " : "CALLER";
    const at = off[i] ? `[${off[i].padStart(7)}]  ` : "";
    lines.push(`${at}${who}:  ${text}`, "");
  });
  lines.push(bar);
  return lines.join("\n");
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function buildTranscriptDoc(segments: TranscriptSegment[], meta: TranscriptMeta): string {
  const off = offsets(segments);
  const rows = header(meta, segments);
  const body = segments
    .map((s, i) => {
      const text = (s.text || "").trim();
      if (!text) return "";
      const agent = isAgent(s.speaker);
      // Inline styles, not a stylesheet: Word's HTML import honours very little
      // CSS, and nothing that depends on cascade or class selectors.
      return `<p style="margin:0 0 10pt 0;">
        <span style="color:#6b7280;font-size:9pt;">${off[i] ? `[${off[i]}] ` : ""}</span>
        <b style="color:${agent ? "#1d4ed8" : "#047857"};">${agent ? "AGENT" : "CALLER"}:</b>
        <span>&nbsp;${escapeHtml(text)}</span>
      </p>`;
    })
    .join("\n");

  // The mso conditional block is what makes Word treat this as a document
  // rather than a web page, and it is what sets the page size and margins.
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>Call transcript${meta.callId ? ` ${escapeHtml(meta.callId)}` : ""}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom>
<w:DoNotOptimizeForBrowser/></w:WordDocument></xml><![endif]-->
<style>
  @page { size: A4; margin: 2cm; }
  body { font-family: "Nirmala UI","Noto Sans Telugu","Gautami",Calibri,Arial,sans-serif;
         font-size: 11pt; line-height: 1.5; color: #111827; }
  h1 { font-size: 15pt; margin: 0 0 12pt 0; }
  td { font-size: 10pt; padding: 1pt 10pt 1pt 0; vertical-align: top; }
</style>
</head>
<body>
<h1>Voice agent call transcript</h1>
<table>${rows
    .map(([k, v]) => `<tr><td style="color:#6b7280;">${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`)
    .join("")}</table>
<hr style="border:none;border-top:1px solid #d1d5db;margin:12pt 0;">
${body}
</body></html>`;
}

/** "ramya_2026-10-05_1215.txt" — safe on every filesystem. */
export function transcriptFilename(meta: TranscriptMeta, format: TranscriptFormat): string {
  const who = (meta.leadName || meta.phone || "call")
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  let when = "";
  if (meta.startedAt) {
    const d = new Date(meta.startedAt);
    if (!Number.isNaN(d.getTime())) {
      const p = (n: number) => String(n).padStart(2, "0");
      when = `_${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
    }
  }
  return `${who || "call"}${when}_transcript.${format}`;
}

export function downloadTranscript(
  segments: TranscriptSegment[],
  meta: TranscriptMeta,
  format: TranscriptFormat,
): void {
  const filename = transcriptFilename(meta, format);
  if (format === "txt") {
    // BOM: Notepad on Windows reads a BOM-less UTF-8 .txt as the local codepage
    // and renders every Telugu character as mojibake.
    const blob = new Blob(["﻿", buildTranscriptText(segments, meta)], {
      type: "text/plain;charset=utf-8",
    });
    saveBlob(blob, filename);
    return;
  }
  const blob = new Blob(["﻿", buildTranscriptDoc(segments, meta)], {
    type: "application/msword;charset=utf-8",
  });
  saveBlob(blob, filename);
}
