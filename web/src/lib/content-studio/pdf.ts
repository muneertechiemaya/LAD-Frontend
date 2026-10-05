/**
 * Minimal PDF writer: one full-page JPEG image per page.
 *
 * No PDF library is installed in this app, and the exports (carousel slides,
 * the calendar) are drawn on a canvas anyway, so each page is the canvas as a
 * baseline JPEG embedded with DCTDecode. The output is a standard PDF 1.4 with
 * a correct xref table - it opens in every viewer.
 */

export interface PdfPage {
  /** Baseline JPEG bytes (canvas.toBlob('image/jpeg')). */
  jpeg: Uint8Array;
  /** Image size in pixels. */
  pxWidth: number;
  pxHeight: number;
  /** Page size in PDF points (1/72 inch). The image is fitted inside, centred. */
  ptWidth: number;
  ptHeight: number;
}

const enc = new TextEncoder();

export function buildPdf(pages: PdfPage[], title = 'Mr LAD export'): Blob {
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (b: Uint8Array) => {
    chunks.push(b);
    length += b.length;
  };
  const text = (s: string) => push(enc.encode(s));
  const startObj = (n: number) => {
    offsets[n] = length;
    text(`${n} 0 obj\n`);
  };

  // Object numbering: 1 catalog, 2 pages, 3 info, then 3 objects per page.
  const pageObj = (i: number) => 4 + i * 3;
  const imgObj = (i: number) => 5 + i * 3;
  const contentObj = (i: number) => 6 + i * 3;
  const total = 4 + pages.length * 3;

  text('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

  startObj(1);
  text('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  startObj(2);
  const kids = pages.map((_, i) => `${pageObj(i)} 0 R`).join(' ');
  text(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>\nendobj\n`);

  startObj(3);
  const safeTitle = title.replace(/[()\\]/g, '');
  text(`<< /Title (${safeTitle}) /Producer (Mr LAD Content Studio) >>\nendobj\n`);

  pages.forEach((p, i) => {
    const scale = Math.min(p.ptWidth / p.pxWidth, p.ptHeight / p.pxHeight);
    const w = +(p.pxWidth * scale).toFixed(2);
    const h = +(p.pxHeight * scale).toFixed(2);
    const x = +((p.ptWidth - w) / 2).toFixed(2);
    const y = +((p.ptHeight - h) / 2).toFixed(2);

    startObj(pageObj(i));
    text(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${p.ptWidth} ${p.ptHeight}] ` +
        `/Resources << /XObject << /Im${i} ${imgObj(i)} 0 R >> >> /Contents ${contentObj(i)} 0 R >>\nendobj\n`
    );

    startObj(imgObj(i));
    text(
      `<< /Type /XObject /Subtype /Image /Width ${p.pxWidth} /Height ${p.pxHeight} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`
    );
    push(p.jpeg);
    text('\nendstream\nendobj\n');

    const draw = `q ${w} 0 0 ${h} ${x} ${y} cm /Im${i} Do Q`;
    startObj(contentObj(i));
    text(`<< /Length ${enc.encode(draw).length} >>\nstream\n${draw}\nendstream\nendobj\n`);
  });

  const xrefAt = length;
  let xref = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let n = 1; n < total; n++) xref += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`;
  text(xref);
  text(`trailer\n<< /Size ${total} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`);

  return new Blob(chunks as BlobPart[], { type: 'application/pdf' });
}

export async function canvasToJpeg(canvas: HTMLCanvasElement, quality = 0.92): Promise<Uint8Array> {
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not draw this page.'))), 'image/jpeg', quality)
  );
  return new Uint8Array(await blob.arrayBuffer());
}
