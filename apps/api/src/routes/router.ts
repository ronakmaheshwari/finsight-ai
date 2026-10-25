import { Router } from "express";

interface RouterInterface {
    path: string;
    router: Router;
}

const router: Router = Router();

const allRouters: RouterInterface[] = [
    {
        path: "/user",
        router: router,
    },
]

allRouters.forEach(x => (
    router.use(x.path, x.router)
));

export default router;