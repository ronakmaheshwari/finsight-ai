import dotenv from "dotenv";
import bcrypt from "bcrypt"
import { env } from "./setting";

dotenv.config()

const hashPassword = async (plainPassword: string): Promise<string> => {
    try {
        const hash = await bcrypt.hash(plainPassword, env.SALTROUND);
        return hash;
    } catch (error) {
        console.error(`Error while hashing the password: ${error}`)
        throw Error
    }
}

const verifyPassword = async(plainPassword: string, hashedPassword: string): Promise<boolean> => {
    try {
        const checkPassword = await bcrypt.compare(plainPassword, hashedPassword);
        return checkPassword;
    } catch (error) {
        console.error(`Error while verifing the password: ${error}`)
        throw Error
    }
}

export {hashPassword, verifyPassword};