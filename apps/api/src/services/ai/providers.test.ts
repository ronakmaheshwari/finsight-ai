import { strict as assert } from "node:assert";
import { test } from "node:test";

import { extractJson } from "./json";
import { describeProvider, resolveProvider } from "./providers";

test("a Claude key wins, then Ollama, then OpenCode", () => {
  assert.equal(
    resolveProvider({ ANTHROPIC_API_KEY: "sk-ant", OLLAMA_API_KEY: "ollama", OPENCODE_API_KEY: "zen" }).name,
    "anthropic",
  );
  assert.equal(resolveProvider({ OLLAMA_API_KEY: "ollama", OPENCODE_API_KEY: "zen" }).name, "ollama");
  assert.equal(resolveProvider({ OPENCODE_API_KEY: "zen" }).name, "opencode");
  assert.equal(resolveProvider({}).name, "mock");
});

test("a local Ollama daemon is enough, no cloud key needed", () => {
  const config = resolveProvider({ OLLAMA_HOST: "http://localhost:11434" });

  assert.equal(config.name, "ollama");
  assert.equal(config.baseUrl, "http://localhost:11434");
  assert.equal(config.model, "gpt-oss:120b");
});

test("AI_PROVIDER overrides the detection order", () => {
  const config = resolveProvider({
    AI_PROVIDER: "ollama",
    ANTHROPIC_API_KEY: "sk-ant",
    OLLAMA_API_KEY: "ollama-key",
    OLLAMA_MODEL: "glm-5.3",
  });

  assert.equal(config.name, "ollama");
  assert.equal(config.model, "glm-5.3");
  assert.equal(config.apiKey, "ollama-key");
});

test("MOCK_LLM=true always wins, for the seeder and the tests", () => {
  assert.equal(resolveProvider({ MOCK_LLM: "true", ANTHROPIC_API_KEY: "sk-ant" }).name, "mock");
  assert.equal(resolveProvider({ AI_PROVIDER: "mock", OLLAMA_API_KEY: "x" }).name, "mock");
});

test("an unknown AI_PROVIDER is rejected instead of silently falling back", () => {
  assert.throws(() => resolveProvider({ AI_PROVIDER: "gemini" }), /Unknown AI_PROVIDER/);
});

test("the stored model names the provider, so the UI can show where the text came from", () => {
  assert.equal(
    describeProvider(resolveProvider({ ANTHROPIC_API_KEY: "sk-ant", LLM_MODEL: "claude-sonnet-4-5" })),
    "anthropic:claude-sonnet-4-5",
  );
  assert.equal(describeProvider(resolveProvider({ OLLAMA_API_KEY: "x" })), "ollama:gpt-oss:120b");
  assert.equal(describeProvider(resolveProvider({})), "mock");
});

test("the trailing slash of a configured host is removed", () => {
  assert.equal(
    resolveProvider({ OPENCODE_API_KEY: "zen", OPENCODE_BASE_URL: "https://opencode.ai/inference/openai/v1/" }).baseUrl,
    "https://opencode.ai/inference/openai/v1",
  );
});

test("extractJson accepts plain, fenced and prefixed JSON", () => {
  const expected = { summary: "risk indicators", confidence: "LOW" };

  assert.deepEqual(extractJson('{"summary":"risk indicators","confidence":"LOW"}'), expected);
  assert.deepEqual(extractJson('```json\n{"summary":"risk indicators","confidence":"LOW"}\n```'), expected);
  assert.deepEqual(
    extractJson('Here is the investigation:\n{"summary":"risk indicators","confidence":"LOW"}\nDone.'),
    expected,
  );
});

test("extractJson rejects a prose answer so the guardrail can retry", () => {
  assert.throws(() => extractJson("I cannot help with that."), /did not return JSON/);
});
