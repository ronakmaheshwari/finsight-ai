import { rejects } from "node:assert"
import { spawn } from "node:child_process"
import { resolve } from "node:dns"
import path from "node:path";
                
const prismaCliPath = require.resolve("prisma/build/index.js");
const schemaPath = path.resolve(__dirname, "../prisma/schema.prisma");

export async function runDatabaseMigrations(): Promise<void> {
    try {
        console.info("Applying Database migrations")
        await new Promise<void>((resolve, rejects) => {
            const migration = spawn(
                process.execPath,
                [prismaCliPath, "migrate", "deploy", "--config", path.resolve(__dirname, "../prisma7.config.ts"), "--schema", schemaPath],
                {
                    stdio: "inherit",
                    cwd: path.resolve(__dirname, ".."),
                }
            );
            
            migration.once("error", rejects);
            migration.once("exit", (code, signal) => {
                if (code === 0) {
                    resolve();
                    return;
                }

                rejects(
                    new Error(
                        signal 
                        ? `Database migration was terminated by signal ${signal}`
                        : `Database migration failed with exit code ${code ?? "unknown"}`
                    )
                )
            });
        });

        console.info("Database migrations applied");
    } catch (error) {
        console.error(`Error took place while running migrations: ${error}`)
    }
};

export async function runDatabaseReset(): Promise<void> {
    try {
        console.info("Resetting Database")
        await new Promise<void>((resolve, rejects) => {
            const migration = spawn(
                process.execPath,
                [prismaCliPath, "migrate", "reset", "--force", "--config", path.resolve(__dirname, "../prisma7.config.ts"), "--schema", schemaPath],
                {
                    stdio: "inherit",
                    cwd: path.resolve(__dirname, ".."),
                }
            );
            
            migration.once("error", rejects);
            migration.once("exit", (code, signal) => {
                if (code === 0) {
                    resolve();
                    return;
                }

                rejects(
                    new Error(
                        signal 
                        ? `Database migration reset was terminated by signal ${signal}`
                        : `Database migration reset failed with exit code ${code ?? "unknown"}`
                    )
                )
            });
        });

        console.info("Database reset completed");
    } catch (error) {
        console.error(`Error took place while running reset: ${error}`)
    }
};