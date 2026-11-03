import type { Response } from "express";
import PDFDocument from "pdfkit";
import db from "@repo/db";

const DISCLAIMER =
  "Risk indicators identified by automated analysis. They are not findings of wrongdoing and require professional review.";

const money = (value: unknown): string =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(Number(value ?? 0));

const day = (value: Date | null): string =>
  value ? value.toISOString().slice(0, 10) : "—";

const heading = (doc: PDFKit.PDFDocument, text: string): void => {
  doc.moveDown(0.8);
  doc.font("Helvetica-Bold").fontSize(12).fillColor("#1f2937").text(text);
  doc.moveDown(0.3);
  doc.font("Helvetica").fontSize(9).fillColor("#111827");
};

const paragraph = (doc: PDFKit.PDFDocument, text: string): void => {
  doc.font("Helvetica").fontSize(9).fillColor("#111827").text(text, { lineGap: 2 });
};

const addFooter = (doc: PDFKit.PDFDocument): void => {
  const bottom = doc.page.height - 45;
  doc
    .font("Helvetica")
    .fontSize(7)
    .fillColor("#6b7280")
    .text(DISCLAIMER, 50, bottom, { width: doc.page.width - 100, align: "center" });
};

const tableRow = (
  doc: PDFKit.PDFDocument,
  cells: string[],
  widths: number[],
  bold = false,
): void => {
  const y = doc.y;
  const height = Math.max(
    ...cells.map((cell, index) => doc.heightOfString(cell, { width: widths[index] ?? 100 })),
  );

  if (y + height > doc.page.height - 80) doc.addPage();

  let x = 50;
  cells.forEach((cell, index) => {
    doc
      .font(bold ? "Helvetica-Bold" : "Helvetica")
      .fontSize(8)
      .fillColor("#111827")
      .text(cell, x, doc.y, { width: widths[index] ?? 100 });
    x += (widths[index] ?? 100) + 6;
  });

  doc.y = y + height + 4;
};

/**
 * Streams the case report. Built with pdfkit (no headless browser). The AI text
 * is always labelled with its review state and the disclaimer appears on every
 * page.
 */
export const streamCasePdf = async (
  caseId: string,
  generatedBy: { id: string; name: string },
  res: Response,
): Promise<void> => {
  const riskCase = await db.case.findUnique({
    where: { id: caseId },
    include: {
      engagement: true,
      signals: { orderBy: { weight: "desc" } },
      notes: { orderBy: { createdAt: "asc" }, include: { author: { select: { name: true } } } },
      decidedBy: { select: { name: true } },
      assignedTo: { select: { name: true } },
      ai: { include: { reviewedBy: { select: { name: true } } } },
    },
  });

  if (!riskCase) throw new Error(`Case ${caseId} not found`);

  const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });
  doc.pipe(res);

  doc.on("pageAdded", () => addFooter(doc));
  addFooter(doc);

  doc.font("Helvetica-Bold").fontSize(16).fillColor("#111827").text("FinSight AI — Case report");
  doc.moveDown(0.2);
  doc.font("Helvetica-Bold").fontSize(12).text(`${riskCase.code}: ${riskCase.title}`);
  doc.moveDown(0.4);
  paragraph(
    doc,
    `Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC by ${generatedBy.name}.`,
  );

  heading(doc, "Engagement");
  paragraph(
    doc,
    `${riskCase.engagement.clientName} — ${riskCase.engagement.title}\nPeriod ${day(
      riskCase.engagement.periodStart,
    )} to ${day(riskCase.engagement.periodEnd)}`,
  );

  heading(doc, "Risk summary");
  paragraph(
    doc,
    `Risk score: ${riskCase.riskScore}/100   Severity: ${riskCase.severity}   Exposure: ${money(
      riskCase.exposureAmount,
    )}\nPrimary entity: ${riskCase.primaryEntityLabel}`,
  );

  heading(doc, "Score breakdown");
  tableRow(doc, ["Rule", "Severity", "Signals", "Points"], [260, 100, 70, 70], true);
  const breakdown = Array.isArray(riskCase.scoreBreakdown)
    ? (riskCase.scoreBreakdown as Record<string, unknown>[])
    : [];
  for (const line of breakdown) {
    tableRow(
      doc,
      [
        String(line.ruleKey ?? ""),
        String(line.severity ?? ""),
        String(line.signalCount ?? ""),
        String(line.points ?? ""),
      ],
      [260, 100, 70, 70],
    );
  }

  heading(doc, "Risk signals");
  for (const signal of riskCase.signals) {
    const evidence = (signal.evidence ?? {}) as Record<string, unknown>;
    paragraph(
      doc,
      `• ${signal.ruleKey} (${signal.severity}) — ${signal.title}\n  ${
        typeof evidence.explanation === "string" ? evidence.explanation : ""
      }\n  Observed: ${JSON.stringify(evidence.observed ?? {})}  Threshold: ${JSON.stringify(
        evidence.threshold ?? {},
      )}`,
    );
  }

  if (riskCase.ai && riskCase.ai.status === "COMPLETED" && riskCase.ai.reviewStatus !== "REJECTED") {
    heading(doc, "AI-generated explanation");
    const review = riskCase.ai.reviewedBy
      ? `Reviewed by ${riskCase.ai.reviewedBy.name} (${riskCase.ai.reviewStatus}) on ${day(
          riskCase.ai.reviewedAt,
        )}`
      : "Not yet reviewed by a professional";
    paragraph(doc, `${review}. AI-generated explanation of system-detected risk indicators.`);

    const output = (riskCase.ai.editedOutput ?? riskCase.ai.output) as Record<string, unknown> | null;
    if (output) {
      if (typeof output.summary === "string") paragraph(doc, `Summary: ${output.summary}`);
      if (typeof output.riskNarrative === "string") paragraph(doc, output.riskNarrative);

      const findings = Array.isArray(output.keyFindings) ? output.keyFindings : [];
      for (const finding of findings as Record<string, unknown>[]) {
        paragraph(doc, `• ${String(finding.finding ?? "")}`);
      }

      const alternatives = Array.isArray(output.alternativeExplanations)
        ? output.alternativeExplanations
        : [];
      if (alternatives.length > 0) {
        paragraph(doc, `Alternative explanations: ${alternatives.join("; ")}`);
      }

      const steps = Array.isArray(output.recommendedSteps) ? output.recommendedSteps : [];
      for (const step of steps as Record<string, unknown>[]) {
        paragraph(doc, `Next step (${String(step.priority ?? "")}): ${String(step.step ?? "")}`);
      }

      if (typeof output.limitations === "string") paragraph(doc, `Limitations: ${output.limitations}`);
    }
  }

  if (riskCase.notes.length > 0) {
    heading(doc, "Reviewer notes");
    for (const note of riskCase.notes) {
      paragraph(doc, `${note.author.name} — ${day(note.createdAt)}\n${note.body}`);
    }
  }

  heading(doc, "Decision");
  if (riskCase.decidedAt) {
    paragraph(
      doc,
      `Decision: ${riskCase.status}\nReason: ${riskCase.decisionReason ?? "—"}\nDecided by: ${
        riskCase.decidedBy?.name ?? "—"
      } on ${day(riskCase.decidedAt)}`,
    );
  } else {
    paragraph(doc, `Status: ${riskCase.status}. No final decision recorded.`);
  }

  if (riskCase.assignedTo) paragraph(doc, `Assigned to: ${riskCase.assignedTo.name}`);

  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    doc
      .font("Helvetica")
      .fontSize(7)
      .fillColor("#6b7280")
      .text(`Page ${index + 1} of ${range.count}`, 50, doc.page.height - 32, {
        width: doc.page.width - 100,
        align: "right",
      });
  }

  doc.end();
};
