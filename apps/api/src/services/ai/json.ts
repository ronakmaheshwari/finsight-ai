/**
 * Models that cannot be forced into a tool call (Ollama, OpenCode) are asked
 * for JSON in the prompt. They usually comply, but sometimes wrap it in a
 * fenced block or add a sentence before it, so pull the object out before the
 * schema guardrail sees it.
 */
export const extractJson = (content: string): unknown => {
  const text = content.trim();

  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const candidate = (fenced?.[1] ?? text).trim();

  const attempts = [candidate];

  const first = candidate.indexOf("{");
  const last = candidate.lastIndexOf("}");
  if (first !== -1 && last > first) attempts.push(candidate.slice(first, last + 1));

  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt);
    } catch {
      /* try the next shape */
    }
  }

  throw new Error("The model did not return JSON");
};
