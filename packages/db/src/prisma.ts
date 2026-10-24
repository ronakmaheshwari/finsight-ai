import { PrismaPg } from "@prisma/adapter-pg";
import { type Prisma, PrismaClient, Role, RunStatus, DatasetStatus, Severity, CaseStatus, EntityType, UserStatus, AiInvestigationStatus} from "@prisma/client";
import { env } from "@repo/utils/setting";

declare global {
    var prisma: PrismaClient | undefined
}

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL })

const db = globalThis.prisma ?? new PrismaClient({
    adapter,
    log: ["warn", "error"]
})

if (process.env.NODE_ENV !== "production") global.prisma = db;

export {Prisma, Role, RunStatus, DatasetStatus, Severity, CaseStatus, EntityType, UserStatus, AiInvestigationStatus}
export default db;
