import type { Role } from "@prisma/client";
import { jwtTokenVerifier } from "@repo/utils";
import type { NextFunction, Request, Response } from "express";

interface AuthUser {
    userId: string;
    orgId: string;
    name: string;
    email: string;
    role: Role;
}

declare module "express-serve-static-core" {
    interface Request {
        user?: AuthUser;
    }
}

const userMiddleware = async (req: Request, res: Response,next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;
        if(!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "You are unauthorized to access these services"
            })
        };

        const token = authHeader.split(" ")[1] as string;
        const decoded = jwtTokenVerifier(token);
        if (!decoded || typeof decoded === "boolean") {
            return res.status(401).json({
                success: false,
                message: "Invalid or expired token",
            });
        }

        req.user = decoded;
        next();
    } catch (error) {
        return res.status(500).json({
            message: "Internal server error",
            success: false,
            error: error
        });
    }
};

export default userMiddleware;