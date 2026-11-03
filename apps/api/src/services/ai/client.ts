import Anthropic from "@anthropic-ai/sdk";
import { env } from "@repo/utils";
import { z } from "zod";
import { InvestigationOutputSchema } from "@repo/shared";
import { SYSTEM_PROMPT, buildUserMessage, REMINDER_MESSAGE } from "./prompt";

export interface LlmCallResult {
  output: unknown;
  inputTokens: number;
  outputTokens: number;
}

const TOOL_NAME = "submit_investigation";

const tool = {
  name: TOOL_NAME,
  description: "Submit the structured investigation for this case.",
  input_schema: z.toJSONSchema(InvestigationOutputSchema) as Anthropic.Tool.InputSchema,
};

let client: Anthropic | null = null;

const getClient = (): Anthropic => {
  if (client) return client;
  if (!env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");
  client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return client;
};

/** Deterministic, schema-valid output used for offline demos, tests and CI. */
const mockOutput = (packet: Record<string, unknown>): unknown => {
  const signals = Array.isArray(packet.signals) ? (packet.signals as Record<string, unknown>[]) : [];
  const entities = Array.isArray(packet.entities) ? (packet.entities as Record<string, unknown>[]) : [];
  const firstSignal = signals[0];
  const firstAlias = typeof entities[0]?.alias === "string" ? entities[0].alias : "the primary entity";
  const signalId = typeof firstSignal?.id === "string" ? firstSignal.id : "S1";
  const signalTitle = typeof firstSignal?.title === "string" ? firstSignal.title : "system-generated risk indicators";

  return {
    summary: `The system identified risk indicators for ${firstAlias} that warrant professional review. This is not a determination of wrongdoing.`,
    riskNarrative: `${signalTitle}. The indicators are consistent with a control weakness that requires review; the evidence supplied is limited to the system-generated signals for this case.`,
    keyFindings: [
      {
        finding: `The signal "${signalTitle}" is present and should be verified against source documents.`,
        evidenceSignalIds: [signalId],
      },
    ],
    alternativeExplanations: [
      "The pattern may have a legitimate business explanation that the supporting documents will clarify.",
      "The data may contain a recording or timing error rather than a control failure.",
    ],
    recommendedSteps: [
      { step: "Request the source documents for the flagged transactions.", priority: "HIGH" },
      { step: "Confirm who approved the transactions and under which limit.", priority: "MEDIUM" },
    ],
    documentsToRequest: ["Signed purchase orders", "Approval records", "Vendor onboarding file"],
    confidence: signals.length >= 2 ? "MEDIUM" : "LOW",
    limitations: "This assessment uses only the supplied evidence and must be validated by a professional.",
  };
};

const isRetryable = (error: unknown): boolean => {
  if (error === null || typeof error !== "object") return false;
  const status = (error as { status?: number }).status;
  return status === 429 || (typeof status === "number" && status >= 500);
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const callOnce = async (
  packet: Record<string, unknown>,
  reminder: string | null,
): Promise<LlmCallResult> => {
  const anthropic = getClient();
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: buildUserMessage(packet) },
  ];

  if (reminder) messages.push({ role: "user", content: reminder });

  const response = await anthropic.messages.create(
    {
      model: env.LLM_MODEL,
      temperature: 0,
      max_tokens: env.LLM_MAX_OUTPUT_TOKENS,
      system: SYSTEM_PROMPT,
      tools: [tool],
      tool_choice: { type: "tool", name: TOOL_NAME },
      messages,
    },
    { timeout: 60_000 },
  );

  const block = response.content.find(
    (entry): entry is Anthropic.ToolUseBlock => entry.type === "tool_use" && entry.name === TOOL_NAME,
  );

  if (!block) throw new Error("The model did not call the investigation tool");

  return {
    output: block.input,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
};

/**
 * One LLM call with forced tool use. Retries once on 429/5xx; the caller retries
 * once more on a schema or guardrail violation.
 */
export const generateInvestigation = async (
  packet: Record<string, unknown>,
  options: { reminder?: string | null } = {},
): Promise<LlmCallResult> => {
  if (env.MOCK_LLM) {
    return { output: mockOutput(packet), inputTokens: 0, outputTokens: 0 };
  }

  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await callOnce(packet, options.reminder ?? null);
    } catch (error) {
      lastError = error;
      if (!isRetryable(error) || attempt === 1) throw error;
      await sleep(1_000 * (attempt + 1));
    }
  }

  throw lastError;
};

export { REMINDER_MESSAGE };
