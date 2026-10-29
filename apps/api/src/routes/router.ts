import { Router } from "express";
import userRouter from "../controller/userController";

interface RouterInterface {
    path: string;
    router: Router;
}

const router: Router = Router();

const allRouters: RouterInterface[] = [
    {
        path: "/user",
        router: userRouter,
    },
]

allRouters.forEach(x => (
    router.use(x.path, x.router)
));

export default router;