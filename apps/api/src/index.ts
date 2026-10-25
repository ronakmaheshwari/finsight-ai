import express, { type Express, type Request, type Response } from "express";
import morgan from "morgan";
import cors from "cors";
import { initRedis } from "@repo/cache";
import { env } from "@repo/utils";
import router from "./routes/router";

const app: Express = express();
const port = env.PORT;

app.use(
  cors({
    origin: env.VITE_FRONTEND_URL,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json());
app.use(morgan("dev"));
app.use("/api/v1", router);

app.get("/", async (req: Request, res: Response) => {
    return res.status(200).type("html").send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta name="description" content="Ronak Maheshwari — Software Engineer and Developer">
            <title>Ronak Maheshwari | Developer</title>

            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }

                body {
                    font-family: Arial, sans-serif;
                    background: #0f172a;
                    color: #e2e8f0;
                    line-height: 1.7;
                }

                .container {
                    max-width: 850px;
                    margin: 0 auto;
                    padding: 40px 24px;
                }

                header {
                    padding: 50px 0 35px;
                    border-bottom: 1px solid #334155;
                }

                .tag {
                    color: #38bdf8;
                    font-size: 14px;
                    font-weight: bold;
                    text-transform: uppercase;
                    letter-spacing: 2px;
                }

                h1 {
                    font-size: clamp(36px, 7vw, 56px);
                    color: #f8fafc;
                    margin: 12px 0;
                    line-height: 1.2;
                }

                h2 {
                    color: #f8fafc;
                    font-size: 24px;
                    margin-bottom: 16px;
                }

                p {
                    color: #cbd5e1;
                    margin-bottom: 14px;
                }

                section {
                    padding: 32px 0;
                    border-bottom: 1px solid #334155;
                }

                .card {
                    background: #1e293b;
                    border: 1px solid #334155;
                    padding: 20px;
                    border-radius: 12px;
                    margin: 14px 0;
                }

                .card h3 {
                    color: #7dd3fc;
                    margin-bottom: 8px;
                }

                .skills {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 10px;
                    list-style: none;
                }

                .skills li {
                    background: #1e293b;
                    border: 1px solid #475569;
                    padding: 6px 12px;
                    border-radius: 20px;
                    font-size: 14px;
                }

                a {
                    color: #38bdf8;
                    text-decoration: none;
                }

                a:hover {
                    text-decoration: underline;
                }

                .links {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 18px;
                    margin-top: 18px;
                }

                footer {
                    padding-top: 28px;
                    color: #94a3b8;
                    font-size: 14px;
                    text-align: center;
                }

                @media (max-width: 600px) {
                    .container {
                        padding: 24px 18px;
                    }

                    header {
                        padding-top: 30px;
                    }
                }
            </style>
        </head>

        <body>
            <main class="container">
                <header>
                    <span class="tag">Software Engineer & Developer</span>
                    <h1>Ronak Maheshwari</h1>

                    <p>
                        I build software, backend systems, APIs, and web applications.
                        I enjoy solving engineering problems, learning new technologies,
                        and turning ideas into useful products.
                    </p>

                    <div class="links">
                        <a href="https://github.com/ronakmaheshwari"
                           target="_blank" rel="noopener noreferrer">GitHub ↗</a>

                        <a href="https://www.linkedin.com/in/rbm77"
                           target="_blank" rel="noopener noreferrer">LinkedIn ↗</a>

                        <a href="https://ronakmaheshwari.tech/"
                           target="_blank" rel="noopener noreferrer">Portfolio ↗</a>
                    </div>
                </header>

                <section>
                    <h2>About Me</h2>
                    <p>
                        I'm a software engineer interested in full-stack development,
                        backend engineering, databases, infrastructure, and system design.
                    </p>
                    <p>
                        I enjoy building reliable applications, designing APIs,
                        optimizing performance, and exploring how software systems
                        work at scale.
                    </p>
                </section>

                <section>
                    <h2>Technical Skills</h2>
                    <ul class="skills">
                        <li>TypeScript</li>
                        <li>JavaScript</li>
                        <li>Node.js</li>
                        <li>Express.js</li>
                        <li>React</li>
                        <li>Python</li>
                        <li>FastAPI</li>
                        <li>PostgreSQL</li>
                        <li>SQLAlchemy</li>
                        <li>Docker</li>
                        <li>Git</li>
                        <li>REST APIs</li>
                    </ul>
                </section>

                <section>
                    <h2>Projects</h2>

                    <article class="card">
                        <h3>Capital</h3>
                        <p>
                            An event ticketing platform exploring scalable architecture
                            and decentralized cryptographic primitives.
                        </p>
                        <a href="https://github.com/ronakmaheshwari/capital"
                           target="_blank" rel="noopener noreferrer">
                            View on GitHub ↗
                        </a>
                    </article>

                    <article class="card">
                        <h3>Terminal Invaders</h3>
                        <p>
                            A terminal-based game project focused on interactive
                            gameplay and command-line development.
                        </p>
                        <a href="https://github.com/Dru-429/Terminal-invaders"
                           target="_blank" rel="noopener noreferrer">
                            View on GitHub ↗
                        </a>
                    </article>

                    <article class="card">
                        <h3>Developer Tools & APIs</h3>
                        <p>
                            Building backend services, REST APIs, database-backed
                            applications, and tools to improve developer workflows.
                        </p>
                    </article>
                </section>

                <section>
                    <h2>What I'm Interested In</h2>
                    <ul>
                        <li>Backend engineering and distributed systems</li>
                        <li>System design and application performance</li>
                        <li>Open-source software and developer tooling</li>
                        <li>Building useful products from scratch</li>
                    </ul>
                </section>

                <section>
                    <h2>Get in Touch</h2>
                    <p>
                        Interested in collaborating on a project or discussing
                        software engineering? Feel free to connect.
                    </p>

                    <div class="links">
                        <a href="https://github.com/ronakmaheshwari"
                           target="_blank" rel="noopener noreferrer">GitHub</a>

                        <a href="https://www.linkedin.com/in/rbm77"
                           target="_blank" rel="noopener noreferrer">LinkedIn</a>
                    </div>
                </section>

                <footer>
                    <p>&copy; ${new Date().getFullYear()} Ronak Maheshwari.
                       Built with HTML, CSS, and Express.</p>
                </footer>
            </main>
        </body>
        </html>
    `);
});

app.get("/health", async(req: Request, res: Response) => {
    try {
        return res.status(200).json({
            success: true,
            message: "Server remains active and healthy"
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error,
            message: "Internal error occured"
        })
    }
})

const startServer = async () => {
    try {
        await initRedis();
        app.listen(port, () => {
            console.log(`Server is running on http://localhost:${port}`)
        })
    } catch (error) {
        console.error("Failed to start application:", error);
        process.exit(1);
    }
}

startServer();

export {startServer};
export default app;