import path from "node:path"
import dotenv from "dotenv"

const envFiles = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../../.env"),
    path.resolve(__dirname, "../../../.env"), // <repo>/packages/utils/{src,dist} -> <repo>
    path.resolve(__dirname, "../../.env"),
]

for (const file of envFiles) {
    dotenv.config({ path: file })
}

const requireEnv = (name: string): string => {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`)
    }
    return value;
}

const env = {
    get DATABASE_URL(): string {
        return requireEnv("DATABASE_URL")
    },
    get REDIS_URL(): string {
        return requireEnv("REDIS_URL")
    },
    get RUN_MIGRATION() {
        return process.env.RUN_MIGRATION === "true"
    },
    get RUN_MIGRATION_RESET() {
        return process.env.RUN_MIGRATION_RESET === "true"
    },
    get SALTROUND(): number {
        return Number(process.env.SALTROUND ?? 10)
    },
    get JWT_SECRET(): string {
        return process.env.JWT_SECRET ?? "Ronak@123"
    },
    get JWT_EXPIRE(): string {
        return process.env.JWT_EXPIRE ?? "1d"
    },
    get ENCRYPTION_SECRET(): string {
        return process.env.ENCRYPTION_SECRET ?? "Password@123"
    },
    get VITE_API_URL(): string {
        return requireEnv("VITE_API_URL")
    },
    get VITE_FRONTEND_URL(): string {
        return requireEnv("VITE_FRONTEND_URL")
    },
    get API_BASE_URL(): string {
        return requireEnv("API_BASE_URL")
    },
    get PORT(): number {
        return Number(process.env.PORT ?? 3000)
    },
    get NODE_ENV(): string {
        return process.env.NODE_ENV ?? "development"
    },
    get WEB_ORIGIN(): string {
        const origin = process.env.WEB_ORIGIN ?? process.env.VITE_FRONTEND_URL ?? "http://localhost:5173"
        // Browsers send `Origin` without a trailing slash, so `http://host:5173/`
        // in `.env` would never match and every request would fail CORS.
        return origin.replace(/\/+$/, "")
    },
    get ACCESS_TTL(): string {
        return process.env.ACCESS_TTL ?? "15m"
    },
    get REFRESH_TTL_DAYS(): number {
        return Number(process.env.REFRESH_TTL_DAYS ?? 7)
    },
    get COOKIE_SECURE(): boolean {
        return process.env.COOKIE_SECURE === "true" || process.env.NODE_ENV === "production"
    },
    get ACCOUNT_HASH_SECRET(): string {
        return process.env.ACCOUNT_HASH_SECRET ?? process.env.ENCRYPTION_SECRET ?? "finsight-account-hash"
    },
    get LLM_MODEL(): string {
        return process.env.LLM_MODEL ?? process.env.AI_MODEL ?? "claude-sonnet-4-5"
    },
    get LLM_MAX_OUTPUT_TOKENS(): number {
        return Number(process.env.LLM_MAX_OUTPUT_TOKENS ?? 2000)
    },
    get MOCK_LLM(): boolean {
        const raw = process.env.MOCK_LLM
        if (raw !== undefined) return raw === "true"
        return !process.env.ANTHROPIC_API_KEY && !process.env.OLLAMA_API_KEY && !process.env.OPENCODE_API_KEY
    },
    get ANTHROPIC_API_KEY(): string | undefined {
        return process.env.ANTHROPIC_API_KEY
    },
    /**
     * `anthropic` | `ollama` | `opencode` | `mock`. Leave empty to auto-detect
     * (Claude key, then Ollama key, then OpenCode key).
     */
    get AI_PROVIDER(): string | undefined {
        return process.env.AI_PROVIDER?.trim().toLowerCase() || undefined
    },
    get OLLAMA_API_KEY(): string | undefined {
        return process.env.OLLAMA_API_KEY
    },
    /** `https://ollama.com` for Ollama Cloud, `http://localhost:11434` for a local daemon. */
    get OLLAMA_HOST(): string {
        return (process.env.OLLAMA_HOST ?? "https://ollama.com").replace(/\/+$/, "")
    },
    get OLLAMA_MODEL(): string {
        return process.env.OLLAMA_MODEL ?? "gpt-oss:120b"
    },
    get OPENCODE_API_KEY(): string | undefined {
        return process.env.OPENCODE_API_KEY
    },
    get OPENCODE_BASE_URL(): string {
        return (process.env.OPENCODE_BASE_URL ?? "https://opencode.ai/inference/openai/v1").replace(/\/+$/, "")
    },
    get OPENCODE_MODEL(): string {
        return process.env.OPENCODE_MODEL ?? "deepseek-v4.1-flash"
    },
    get UPLOAD_MAX_MB(): number {
        return Number(process.env.UPLOAD_MAX_MB ?? 10)
    },
}

const REQUIRED_ENV = ["DATABASE_URL", "REDIS_URL", "VITE_API_URL", "VITE_FRONTEND_URL", "API_BASE_URL", "PORT"] as const;

const validateEnv = (): void => {
    const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(", ")}`)
    }
}

export { env, validateEnv }