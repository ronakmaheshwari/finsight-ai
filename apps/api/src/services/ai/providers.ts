/**
 * Which language model writes the investigation narrative.
 *
 * Order of preference (the first configured provider wins):
 *   1. Anthropic Claude  — `ANTHROPIC_API_KEY`
 *   2. Ollama            — `OLLAMA_API_KEY` (Ollama Cloud) or `OLLAMA_HOST` (local daemon)
 *   3. OpenCode          — `OPENCODE_API_KEY` (OpenCode Console / Zen)
 *   4. Mock              — deterministic offline output, no network call
 *
 * `AI_PROVIDER` overrides the order when set to `anthropic`, `ollama`,
 * `opencode` or `mock`. `MOCK_LLM=true` always wins, which is what the seeder
 * and the tests use.
 */

export type AiProviderName = "anthropic" | "ollama" | "opencode" | "mock";

export interface ProviderConfig {
  name: AiProviderName;
  model: string;
  apiKey?: string;
  baseUrl?: string;
}

type Source = Record<string, string | undefined>;

const pick = (source: Source, ...keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = source[key]?.trim();
    if (value) return value;
  }
  return undefined;
};

const stripSlash = (value: string): string => value.replace(/\/+$/, "");

const anthropic = (source: Source): ProviderConfig => ({
  name: "anthropic",
  model: pick(source, "LLM_MODEL", "AI_MODEL") ?? "claude-sonnet-4-5",
  apiKey: pick(source, "ANTHROPIC_API_KEY"),
});

const ollama = (source: Source): ProviderConfig => ({
  name: "ollama",
  model: pick(source, "OLLAMA_MODEL", "LLM_MODEL") ?? "gpt-oss:120b",
  apiKey: pick(source, "OLLAMA_API_KEY"),
  baseUrl: stripSlash(pick(source, "OLLAMA_HOST") ?? "https://ollama.com"),
});

const opencode = (source: Source): ProviderConfig => ({
  name: "opencode",
  model: pick(source, "OPENCODE_MODEL", "LLM_MODEL") ?? "deepseek-v4.1-flash",
  apiKey: pick(source, "OPENCODE_API_KEY"),
  baseUrl: stripSlash(pick(source, "OPENCODE_BASE_URL") ?? "https://opencode.ai/inference/openai/v1"),
});

const mock = (source: Source): ProviderConfig => ({
  name: "mock",
  model: pick(source, "LLM_MODEL") ?? "mock",
});

/**
 * Pure so it can be tested without touching the real environment. Pass
 * `process.env` at runtime.
 */
export const resolveProvider = (source: Source = process.env): ProviderConfig => {
  if (source.MOCK_LLM === "true") return mock(source);

  const explicit = source.AI_PROVIDER?.trim().toLowerCase();

  if (explicit === "mock") return mock(source);
  if (explicit === "anthropic") return anthropic(source);
  if (explicit === "ollama") return ollama(source);
  if (explicit === "opencode") return opencode(source);

  if (explicit) {
    throw new Error(`Unknown AI_PROVIDER "${explicit}". Use anthropic, ollama, opencode or mock.`);
  }

  if (pick(source, "ANTHROPIC_API_KEY")) return anthropic(source);
  // A local Ollama daemon needs no key, so an explicit host is enough.
  if (pick(source, "OLLAMA_API_KEY", "OLLAMA_HOST")) return ollama(source);
  if (pick(source, "OPENCODE_API_KEY")) return opencode(source);

  return mock(source);
};

/** Stored on `AiInvestigation.model` and in the audit row, e.g. `ollama:gpt-oss:120b`. */
export const describeProvider = (config: ProviderConfig): string =>
  config.name === "mock" ? "mock" : `${config.name}:${config.model}`;
