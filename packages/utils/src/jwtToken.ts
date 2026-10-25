import dotenv from "dotenv"
import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken"
import { env } from "./setting"
import type { Role } from "@prisma/client"

dotenv.config()

const jwtTokenGenerator = (userId: string, orgId: string, name: string, email: string, role: Role) => {
    try {
        const token = jwt.sign({
            userId: userId,
            orgId: orgId,
            name: name,
            email: email,
            role: role,
        }, env.JWT_SECRET, {
            expiresIn: env.JWT_EXPIRE as SignOptions["expiresIn"],
        });
        return token
    } catch (error) {
        console.error(`Error while creating the token: ${error}`)
        throw Error
    }
}

const jwtTokenVerifier = (token: string): {userId: string, orgId: string, name: string, email: string, role: Role} | boolean => {
    try {
        const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
        return {
            userId: decoded.userId,
            orgId: decoded.orgId,
            name: decoded.name,
            email: decoded.email,
            role: decoded.role,
        }
    } catch (error) {
        console.error(`Error while verifing the token: ${error}`)
        return false
    }
}

export {jwtTokenGenerator, jwtTokenVerifier};