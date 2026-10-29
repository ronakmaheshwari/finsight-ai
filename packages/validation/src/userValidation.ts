import z, { email } from "zod"
import {Role, UserStatus} from "@repo/db"

const signupValidation = z.object({
    email: z.email({ pattern: z.regexes.rfc5322Email , error: "Invalid email address format."}).nonempty("Email cant be empty").trim(),
    name: z.string({error: "Name must be provided"}).min(2, {error: "Name must atleast be of 2 characters"}).max(32, {error: "Name cant be more than 32 characters"}).trim(),
    password: z.string().trim().regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/,
    {
        error: "Your password must be strong"
    }).min(8, "Your password must have atleast 8 characters").max(64, {error: "Your password cant be more than 64 characters"}).trim(),
    role: z.enum(Role, {error: "Only allowed roles are Admin, Manager, Viewer, Analyst"})
});

const loginValidation = z.object({
    email: z.email({ pattern: z.regexes.rfc5322Email , error: "Invalid email address format."}).nonempty("Email cant be empty").trim(),
    password: z.string().trim().regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/,
    {
        error: "Your password must be strong"
    }).min(8, "Your password must have atleast 8 characters").max(64, {error: "Your password cant be more than 64 characters"}).trim(),
});

const userQueryValidation = z.object({
    name: z.string().optional(),
    organization: z.string().optional(),
    organizationId: z.string().optional(),
    role: z.enum(Role, {error: "Only allowed roles are Admin, Manager, Viewer, Analyst"}).optional(),
    userStatus: z.enum(UserStatus, {error: "Only allowed status are ACTIVE, INACTIVE, DELETED, DORMANT, UNVERIFIED"}).optional(),
    description: z.string().optional()
});

const idValidation = z.object({
    id: z.string({error: "Id is required"}).nonempty().trim()
});

const editUserValidation = z.object({
    name: z.string().optional(),
    role: z.enum(Role, {error: "Only allowed roles are Admin, Manager, Viewer, Analyst"}).optional(),
    userStatus: z.enum(UserStatus, {error: "Only allowed status are ACTIVE, INACTIVE, DELETED, DORMANT, UNVERIFIED"}).optional(),
    organizationId: z.string().optional(),
});

const otpVerificationValidation = z.object({
    email: z.email({ pattern: z.regexes.rfc5322Email , error: "Invalid email address format."}).trim(),
});

const otpCodeVerificationValidation = z.object({
    email: z.email({pattern: z.regexes.rfc5322Email, error: "Invalid email address format."}).trim(),
    otp: z.string({error: "Invalid OTP format was provided"}).trim(),
    password: z.string().trim().regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/,
    {
        error: "Your password must be strong"
    }).min(8, "Your password must have atleast 8 characters").max(64, {error: "Your password cant be more than 64 characters"}).trim(),
});

const addUserValidation = z.object({
    email: z.email({pattern: z.regexes.rfc5322Email, error: "Invalid email address format."}).trim(),
    role: z.enum(Role, {error: "Only allowed roles are Admin, Manager, Viewer, Analyst"}),
    name: z.string({error: "Name must be provided"}).min(2, {error: "Name must atleast be of 2 characters"}).max(32, {error: "Name cant be more than 32 characters"}).trim(),
})

export type signupValidationType = z.infer<typeof signupValidation>;
export type loginValidationType = z.infer<typeof loginValidation>;
export type userQueryValidationType = z.infer<typeof userQueryValidation>;
export type idValidationType = z.infer<typeof idValidation>;
export type editUserValidationType = z.infer<typeof editUserValidation>;
export type otpVerificationValidationType = z.infer<typeof otpVerificationValidation>;
export type otpCodeVerificationValidationType = z.infer<typeof otpCodeVerificationValidation>;
export type addUserValidationType = z.infer<typeof addUserValidation>;

export {signupValidation, loginValidation, userQueryValidation, idValidation, editUserValidation, otpVerificationValidation, otpCodeVerificationValidation, addUserValidation};