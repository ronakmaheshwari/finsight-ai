import { strict as assert } from "node:assert";
import { PassThrough } from "node:stream";
import { test } from "node:test";
import { inflateSync } from "node:zlib";

import PDFDocument from "pdfkit";

import { addFooter, stampPageNumbers } from "./pdfFooter";

/**
 * Regression tests for the export bug that streamed a 15-byte PDF: the footer
 * and the page number were written below `page.margins.bottom`, so every write
 * added a page, which drew another footer, and so on until the stack blew.
 */
const render = async (): Promise<Buffer> => {
  const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });
  const chunks: Buffer[] = [];
  const sink = new PassThrough();
  sink.on("data", (chunk: Buffer) => chunks.push(chunk));

  const done = new Promise<Buffer>((resolve, reject) => {
    sink.on("end", () => resolve(Buffer.concat(chunks)));
    sink.on("error", reject);
  });

  doc.pipe(sink);
  doc.on("pageAdded", () => addFooter(doc));
  addFooter(doc);

  // Fill past the bottom margin several times so the document really paginates.
  for (let line = 0; line < 400; line += 1) {
    doc
      .font("Helvetica")
      .fontSize(9)
      .text(`Line ${line}: a paragraph of case evidence.`, { lineGap: 2 });
  }

  stampPageNumbers(doc);
  doc.end();

  return done;
};

/** PDFKit writes text as hex strings inside `<…>`, usually deflated. */
const extractText = (pdf: Buffer): string => {
  const parts: string[] = [];

  for (const match of pdf.toString("latin1").matchAll(/stream\r?\n([\s\S]*?)endstream/g)) {
    const raw = Buffer.from(match[1] ?? "", "latin1");
    let content: Buffer;
    try {
      content = inflateSync(raw);
    } catch {
      content = raw;
    }

    for (const hex of content.toString("latin1").matchAll(/<([0-9a-fA-F]+)>/g)) {
      parts.push(Buffer.from(hex[1] ?? "", "hex").toString("latin1"));
    }
  }

  return parts.join("");
};

test("the footer and page numbers do not paginate the document", async () => {
  const pdf = await render();

  assert.ok(pdf.length > 5_000, `expected a full report, got ${pdf.length} bytes`);
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  assert.ok(pdf.includes(Buffer.from("%%EOF")), "the document must be terminated");
});

test("the disclaimer appears on every page and each page is numbered", async () => {
  const pdf = await render();
  const text = extractText(pdf);
  const pages = Number(/\/Count (\d+)/.exec(pdf.toString("latin1"))?.[1] ?? 0);

  assert.ok(pages > 1, `expected multiple pages, got ${pages}`);

  const disclaimers = text.split("Risk indicators identified by automated analysis").length - 1;
  assert.equal(disclaimers, pages, "one standing disclaimer per page");

  for (let page = 1; page <= pages; page += 1) {
    assert.ok(text.includes(`Page ${page} of ${pages}`), `page ${page} is not numbered`);
  }
});
