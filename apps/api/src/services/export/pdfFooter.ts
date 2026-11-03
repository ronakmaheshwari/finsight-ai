import type PDFKit from "pdfkit";

/**
 * Page furniture for exported PDFs.
 *
 * PDFKit paginates as soon as a write crosses `page.margins.bottom`. The footer
 * and the page number deliberately live *inside* that band, so writing them with
 * a normal `text()` call added a page, fired `pageAdded`, drew the footer on the
 * new page, added another page… until the stack overflowed and the export
 * streamed a 15-byte stub. Everything that writes into the band goes through
 * `withFooterSpace`.
 */

export const PDF_DISCLAIMER =
  "Risk indicators identified by automated analysis. They are not findings of wrongdoing and require professional review.";

export const withFooterSpace = (doc: PDFKit.PDFDocument, draw: () => void): void => {
  const margin = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  try {
    draw();
  } finally {
    doc.page.margins.bottom = margin;
  }
};

/** Draws the standing disclaimer, then restores the cursor and text style. */
export const addFooter = (doc: PDFKit.PDFDocument): void => {
  const y = doc.y;
  withFooterSpace(doc, () => {
    doc
      .font("Helvetica")
      .fontSize(7)
      .fillColor("#6b7280")
      .text(PDF_DISCLAIMER, 50, doc.page.height - 45, {
        width: doc.page.width - 100,
        align: "center",
      });
  });
  doc.y = y;
  doc.fillColor("#111827").font("Helvetica").fontSize(9);
};

/** Stamps "Page n of m" on every buffered page. Requires `bufferPages: true`. */
export const stampPageNumbers = (doc: PDFKit.PDFDocument): void => {
  const range = doc.bufferedPageRange();

  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    withFooterSpace(doc, () => {
      doc
        .font("Helvetica")
        .fontSize(7)
        .fillColor("#6b7280")
        .text(`Page ${index + 1} of ${range.count}`, 50, doc.page.height - 32, {
          width: doc.page.width - 100,
          align: "right",
        });
    });
  }
};
