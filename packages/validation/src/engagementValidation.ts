import z from "zod";

const memberValidation = z.object({
    email: z.email({ pattern: z.regexes.rfc5322Email , error: "Invalid email address format."}).nonempty("Email cant be empty").trim(),
});

const createEngagementValidation = z.object({
    clientName: z.string().min(2, {error: "Client Name should have atleast 2 characters"}).max(64, {error: "Client name cannot be more than 64 characters"}).trim(),
    title: z.string().min(2, {error: "Title should atleast have 2 characters"}).max(100, {error: "Client name cannot be more than 100 characters"}).trim(),
    periodStart: z.date({error: "Period start must be a date"}),
    periodEnd: z.date({error: "Period start must be a date"}),
});

const editEngagementValidation = z.object({
    clientName: z.string().min(2, {error: "Client Name should have atleast 2 characters"}).max(64, {error: "Client name cannot be more than 64 characters"}).trim().optional(),
    title: z.string().min(2, {error: "Title should atleast have 2 characters"}).max(100, {error: "Client name cannot be more than 100 characters"}).trim().optional(),
    periodStart: z.date({error: "Period start must be a date"}).optional(),
    periodEnd: z.date({error: "Period start must be a date"}).optional(),
    members: z.array(memberValidation).nullable().optional(),
});

const addMemeberToEngagementValidation = z.object({
    email: z.email({ pattern: z.regexes.rfc5322Email , error: "Invalid email address format."}).nonempty("Email cant be empty").trim(),
});

const addDatasetValidation = z.object({
    name: z.string().min(2, {error: "Dataset Name should have atleast 2 characters"}).max(64, {error: "Dataset name cannot be more than 64 characters"}).trim(),
});

export type createEngagementValidationType = z.infer<typeof createEngagementValidation>;
export type editEngagementValidationType = z.infer<typeof editEngagementValidation>;
export type addMemeberToEngagementValidationType = z.infer<typeof addMemeberToEngagementValidation>;
export type addDatasetValidationType = z.infer<typeof addDatasetValidation>;

export {createEngagementValidation, editEngagementValidation, addDatasetValidation, addMemeberToEngagementValidation};