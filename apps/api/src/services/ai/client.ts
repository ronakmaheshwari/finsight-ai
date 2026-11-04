import Anthropic from "@anthropic-ai/sdk";
import { env } from "@repo/utils";
import { z } from "zod";
import { InvestigationOutputSchema } from "@repo/shared";
import { extractJson } from "./json";
import {
  JSON_REMINDER_MESSAGE,
  JSON_SYSTEM_PROMPT,
  REMINDER_MESSAGE,
  SYSTEM_PROMPT,
  buildUserMessage,
} from "./prompt";
import { describeProvider, resolveProvider, type ProviderConfig } from "./providers";

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

let anthropicClient: Anthropic | null = null;

const getAnthropic = (config: ProviderConfig): Anthropic => {
  if (anthropicClient) return anthropicClient;
  if (!config.apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");
  anthropicClient = new Anthropic({ apiKey: config.apiKey });
  return anthropicClient;
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

const postJson = async (url: string, body: unknown, apiKey: string | undefined): Promise<unknown> => {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });

  const text = await response.text();

  if (!response.ok) {
    const error = new Error(`Provider request failed with ${response.status}`) as Error & { status?: number };
    error.status = response.status;
    console.error(`AI provider ${url} responded ${response.status}: ${text.slice(0, 300)}`);
    throw error;
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Provider returned a non-JSON response");
  }
};

/** Anthropic: forced tool use, the strongest output contract available. */
const callAnthropic = async (
  config: ProviderConfig,
  packet: Record<string, unknown>,
  reminder: string | null,
): Promise<LlmCallResult> => {
  const anthropic = getAnthropic(config);
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: buildUserMessage(packet) }];

  if (reminder) messages.push({ role: "user", content: reminder });

  const response = await anthropic.messages.create(
    {
      model: config.model,
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

interface OllamaChatResponse {
  message?: { content?: string };
  prompt_eval_count?: number;
  eval_count?: number;
}

/** Ollama Cloud and a local daemon share the native `/api/chat` contract. */
const callOllama = async (
  config: ProviderConfig,
  packet: Record<string, unknown>,
  reminder: string | null,
): Promise<LlmCallResult> => {
  const messages = [
    { role: "system", content: JSON_SYSTEM_PROMPT },
    { role: "user", content: buildUserMessage(packet) },
  ];

  if (reminder) messages.push({ role: "user", content: reminder });

  const body = await postJson(
    `${config.baseUrl ?? "https://ollama.com"}/api/chat`,
    { model: config.model, stream: false, format: "json", options: { temperature: 0 }, messages },
    config.apiKey,
  );

  const response = body as OllamaChatResponse;
  const content = response.message?.content;

  if (typeof content !== "string" || !content.trim()) throw new Error("The model returned an empty response");

  return {
    output: extractJson(content),
    inputTokens: response.prompt_eval_count ?? 0,
    outputTokens: response.eval_count ?? 0,
  };
};

interface OpenAiChatResponse {
  choices?: { message?: { content?: string | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/** OpenCode Console (Zen) exposes an OpenAI-compatible chat completions API. */
const callOpenCode = async (
  config: ProviderConfig,
  packet: Record<string, unknown>,
  reminder: string | null,
): Promise<LlmCallResult> => {
  if (!config.apiKey) throw new Error("OPENCODE_API_KEY is not configured");

  const messages = [
    { role: "system", content: JSON_SYSTEM_PROMPT },
    { role: "user", content: buildUserMessage(packet) },
  ];

  if (reminder) messages.push({ role: "user", content: reminder });

  const body = await postJson(
    `${config.baseUrl ?? "https://opencode.ai/inference/openai/v1"}/chat/completions`,
    {
      model: config.model,
      temperature: 0,
      max_tokens: env.LLM_MAX_OUTPUT_TOKENS,
      response_format: { type: "json_object" },
      messages,
    },
    config.apiKey,
  );

  const response = body as OpenAiChatResponse;
  const content = response.choices?.[0]?.message?.content;

  if (typeof content !== "string" || !content.trim()) throw new Error("The model returned an empty response");

  return {
    output: extractJson(content),
    inputTokens: response.usage?.prompt_tokens ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
  };
};

const callOnce = async (
  config: ProviderConfig,
  packet: Record<string, unknown>,
  reminder: string | null,
): Promise<LlmCallResult> => {
  switch (config.name) {
    case "anthropic":
      return callAnthropic(config, packet, reminder);
    case "ollama":
      return callOllama(config, packet, reminder);
    case "opencode":
      return callOpenCode(config, packet, reminder);
    default:
      return { output: mockOutput(packet), inputTokens: 0, outputTokens: 0 };
  }
};

/**
 * One provider call. Retries once on 429/5xx; the caller retries once more on a
 * schema or guardrail violation, with a reminder that names the broken rule.
 */
export const generateInvestigation = async (
  packet: Record<string, unknown>,
  options: { reminder?: string | null } = {},
): Promise<LlmCallResult> => {
  const config = resolveProvider(process.env);

  if (config.name === "mock") {
    return { output: mockOutput(packet), inputTokens: 0, outputTokens: 0 };
  }

  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await callOnce(config, packet, options.reminder ?? null);
    } catch (error) {
      lastError = error;
      if (!isRetryable(error) || attempt === 1) throw error;
      await sleep(1_000 * (attempt + 1));
    }
  }

  throw lastError;
};

/** Which provider and model the next investigation will use, for logs and the UI. */
export const activeProvider = (): string => describeProvider(resolveProvider(process.env));

/** The reminder has to match the contract the provider was given. */
export const retryReminder = (): string =>
  resolveProvider(process.env).name === "anthropic" ? REMINDER_MESSAGE : JSON_REMINDER_MESSAGE;

export { REMINDER_MESSAGE, JSON_REMINDER_MESSAGE };
