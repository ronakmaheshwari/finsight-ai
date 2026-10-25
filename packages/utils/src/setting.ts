import path from "node:path"
import dotenv from "dotenv"

dotenv.config()
dotenv.config({ path: path.resolve(__dirname, "../../.env") })

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
    }
}

const REQUIRED_ENV = ["DATABASE_URL", "REDIS_URL", "VITE_API_URL", "VITE_FRONTEND_URL", "API_BASE_URL", "PORT"] as const;

const validateEnv = (): void => {
    const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(", ")}`)
    }
}

export { env, validateEnv }
