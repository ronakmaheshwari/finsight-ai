import { createClient } from "redis";
import { env } from "@repo/utils"; 

const redis = createClient({
    url: env.REDIS_URL ?? "redis://localhost:6379"
});

redis.on("error", (error) => {
    console.error(`Error took place while connecting with redis: ${error}`)
});

redis.on("connect", () => {
    console.info(`Redis connecting`)
});

redis.on("ready", () => {
    console.info(`Redis client ready`)
});

redis.on("end", () => {
    console.log("Redis connection closed");
});

const initRedis = async () => {
    try {
        if (redis.isOpen) {
            console.info(`Redis client is already open`);
            return;
        }
        await redis.connect();
        console.log(
            "Redis connected:",
            redis.isOpen,
            redis.isReady
        );
    } catch (error) {
        console.error("Redis connection failed:", error);
        throw error;
    }
}

export {
    initRedis,
    redis,
}