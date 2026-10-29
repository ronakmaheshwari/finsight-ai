import {Router, type Request, type Response} from "express";
import {addUserValidation, loginValidation, signupValidation} from "../../../../packages/validation/dist/userValidation"
import db, { UserStatus } from "@repo/db";
import { ApiError, hashPassword, jwtTokenGenerator, verifyPassword } from "@repo/utils";
import userMiddleware from "../middleware/userMiddleware";
import { editUserValidation } from "@repo/validation";

const userRouter: Router = Router();

userRouter.post("/signup", async (req: Request, res: Response) => {
    try {
        const parsed = signupValidation.safeParse(req.body);
        if(!parsed.success) {
            throw ApiError.validation({
                error: JSON.stringify(parsed.error.flatten().fieldErrors),
            })
        }

        const {name, email, password, role} = parsed.data;
        const findEmail = await db.user.findUnique({
            where: {
                email: email
            }
        });

        if(findEmail && findEmail.userStatus !== UserStatus.UNVERIFIED) {
            throw ApiError.emailAlreadyExists("Email already exists in the system")
        }

        const hashedPassword = await hashPassword(password);
        const org = await db.organization.findFirst({
            where: {
                name: "gt"
            },
            select: {
                id: true
            },
            orderBy: {
                name: "asc"
            }
        });

        if(!org) {
            throw ApiError.notFound("No Organization in the system")
        };

        const addUser = await db.user.create({
            data: {
                orgId: org.id as string,
                name: name,
                email: email,
                role: role,
                password: hashedPassword,
                userStatus: "ACTIVE"
            }
        })

        const {token, expiresAt} = jwtTokenGenerator(addUser.id, addUser.orgId, addUser.name, addUser.email, addUser.role);
        await db.jWTToken.create({
            data: {
                userId: addUser.id,
                tokenHash: token,
                expiresAt: expiresAt,
                isLatest: true,
            }
        });

        return res.status(201).json({
            success: true,
            message: "User was successfully created",
            token: token,
        })
    } catch (error) {
        console.error(`Error took place while signing up a user: ${error}`);
        throw ApiError.internal();
    }
});

userRouter.post("/login", async(req: Request, res: Response) => {
    try {
        const parsed = loginValidation.safeParse(req.body);

        if(!parsed.success) {
            throw ApiError.validation({
                error: JSON.stringify(parsed.error.flatten().fieldErrors),
            })
        }

        const {email, password} = parsed.data;

        const findEmail = await db.user.findUnique({
            where: {
                email: email
            }
        })

        if(!findEmail) {
            throw ApiError.notFound("No user in the system")
        }

        if(findEmail.userStatus !== "ACTIVE") {
            throw ApiError.forbidden("User is not active, please signup")
        }

        const checkPassword = await verifyPassword(password, findEmail.password);
        if(!checkPassword) {
            throw ApiError.invalidCredentials("Invalid password was provided")
        }

        const {token, expiresAt} = jwtTokenGenerator(findEmail.id, findEmail.orgId, findEmail.name, findEmail.email, findEmail.role);
        await db.jWTToken.create({
            data: {
                userId: findEmail.id,
                tokenHash: token,
                expiresAt: expiresAt,
                isLatest: true,
            }
        });

        return res.status(201).json({
            success: true,
            message: "User successfully logined",
            token: token,
        })
    } catch (error) {
        console.error(`Error took place while logging a user: ${error}`);
        throw ApiError.internal();
    }
});

userRouter.get("/me", userMiddleware , async (req: Request, res: Response) => {
    try {
        if(!req.user) {
            throw ApiError.unauthorized()
        }

        const user = req.user;

        const findUser = await db.user.findUnique({
            where: {
                id: user.userId as string
            },
            select: {
                email: true,
                name: true,
                role: true,
                userStatus: true,
                org: {
                    select: {
                        name: true,
                    }
                },
            }
        });

        if(!findUser) {
            throw ApiError.notFound("The given user details doesnt exist in the system")
        }

        if(findUser.userStatus !== "ACTIVE") {
            throw ApiError.forbidden("The given user is not active in the system. Please contact the admin")
        }

        return res.status(200).json({
            success: true,
            message: "User fetched successfully",
            user: findUser,
        })
    } catch (error) {
        console.error(`Error took place while seeing his data: ${error}`);
        throw ApiError.internal();
    }
})

userRouter.post("/add-user", userMiddleware , async (req: Request, res: Response) => {
    try {
        if(!req.user) {
            throw ApiError.unauthorized()
        }

        const user = req.user;

        if(user.role === "ADMIN") {
            throw ApiError.unauthorized("Only admin users can access these services");
        }

        const parsed = addUserValidation.safeParse(req.body);
        if(!parsed.success) {
            throw ApiError.validation({
                error: JSON.stringify(parsed.error.flatten().fieldErrors),
            })
        } 

        const {email, name, role} = parsed.data;

        const findEmail = await db.user.findUnique({
            where: {
                email: email
            }
        })

        if(findEmail) {
            throw ApiError.emailAlreadyExists();
        }

        const hashedPassword = await hashPassword("Password@123");

        await db.user.create({
            data: {
                name: name,
                email: email,
                password: hashedPassword,
                role: role,
                orgId: user.orgId,
            }
        });

        return res.status(201).json({
            message: "The given user was successfully created",
            success: true,
        })
    } catch (error) {
        console.error(`Error took place while adding user data: ${error}`);
        throw ApiError.internal();
    }
});

userRouter.patch("edit-user/:email", userMiddleware, async(req: Request, res: Response) => {
    try {
        if(!req.user) {
            throw ApiError.unauthorized()
        }

        const user = req.user;

        if(user.role === "ADMIN") {
            throw ApiError.unauthorized("Only admin users can access these services");
        }

        const email = req.params.email;

        if(!email) {
            throw ApiError.badRequest("Please provide the email")
        }

        const parsed = editUserValidation.safeParse(req.body);
        if(!parsed.success) {
            throw ApiError.validation({
                error: JSON.stringify(parsed.error.flatten().fieldErrors),
            })
        } 

        const {name, role, organizationId, userStatus} = parsed.data

        const findEmail = await db.user.findUnique({
            where: {
                email: email as string
            }
        });

        if(!findEmail) {
            throw ApiError.notFound()
        }

        await db.user.update({
            where: {
                email: email as string
            },
            data: {
                name,
                role,
                orgId: organizationId,
                userStatus
            }
        })

        return res.status(200).json({
            message: "The given user details were successfully updated",
            success: true,
        })

    } catch (error) {
        console.error(`Error took place while editing user data: ${error}`);
        throw ApiError.internal();
    }
});

userRouter.patch("/logout", userMiddleware, async(req: Request, res: Response) => {
    try {
        if(!req.user) {
            throw ApiError.unauthorized()
        }

        const user = req.user;

        const findUser = await db.jWTToken.findFirst({
            where: {
                userId: user.userId as string
            }
        })

        if(!findUser) {
            throw ApiError.notFound()
        }

        await db.jWTToken.update({
            where: {
                userId: findUser.id,
                isLatest: true,
            },
            data: {
                isLatest: false,
            }
        })

        return res.status(200).json({
            message: "The given jwt was removed",
            success: true
        })
    } catch (error) {
        console.error(`Error took place while logging user out: ${error}`);
        throw ApiError.internal();
    }
})

export default userRouter;
