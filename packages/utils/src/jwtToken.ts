import dotenv from "dotenv"
import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken"
import { env } from "./setting"
import type { Role } from "@prisma/client"

dotenv.config()

interface AuthUser {
    userId: string;
    orgId: string;
    name: string;
    email: string;
    role: Role;
}

const jwtTokenGenerator = (
    userId: string,
    orgId: string,
    name: string,
    email: string,
    role: Role
) => {
    try {
        const token = jwt.sign(
            {
                userId,
                orgId,
                name,
                email,
                role,
            },
            env.JWT_SECRET,
            {
                expiresIn: (env.ACCESS_TTL ?? env.JWT_EXPIRE) as SignOptions["expiresIn"],
            }
        );

        const decoded = jwt.decode(token) as JwtPayload | null;

        if (!decoded?.exp) {
            throw new Error("JWT expiration claim is missing");
        }

        return {
            token,
            expiresAt: new Date(decoded.exp * 1000),
        };

    } catch (error) {
        console.error("Error while creating JWT:", error);
        throw error;
    }
};

const jwtTokenVerifier = (token: string): AuthUser | false => {
    try {
        const decoded = jwt.verify(token, env.JWT_SECRET);

        if (typeof decoded === "string" || !decoded) {
            return false;
        }

        if (
            typeof decoded.userId !== "string" ||
            typeof decoded.orgId !== "string" ||
            typeof decoded.name !== "string" ||
            typeof decoded.email !== "string" ||
            typeof decoded.role !== "string"
        ) {
            return false;
        }

        return {
            userId: decoded.userId,
            orgId: decoded.orgId,
            name: decoded.name,
            email: decoded.email,
            role: decoded.role as Role,
        };
    } catch {
        return false;
    }
};

export {jwtTokenGenerator, jwtTokenVerifier};