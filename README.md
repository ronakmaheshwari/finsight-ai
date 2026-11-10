# FinSight AI

FinSight AI helps an audit or finance team look through a company's spending
records and find the transactions that deserve a closer look.

You upload the usual paperwork (invoices, purchase orders, vendors, employees,
bank accounts, payments). FinSight checks it against a fixed set of rules,
groups the suspicious patterns into cases, and puts them in a queue for a person
to review. For each case, an AI assistant can draft an explanation of what the
pattern looks like and what to check next.

> **The one rule FinSight always follows:** it never says that fraud happened.
> It points out **risk indicators** that **need a person to review them**. Every
> AI-written explanation carries that disclaimer and must be accepted, edited or
> rejected by a human before it is used.

---

## What it does, in plain terms

1. **You upload the data.** Six simple spreadsheets or CSV files. FinSight checks
   every row and tells you exactly which rows are wrong before anything is saved.
2. **It checks the rules.** Things like "this employee approved invoices for a
   company they created", "this payment is far larger than usual", or "these
   invoices all end in round numbers". The rules are fixed, so the same data
   always produces the same result.
3. **You get a case list.** Related findings are grouped into one case with a
   score from 0 to 100, a severity, and the money at stake.
4. **You review a case.** You see the evidence, the numbers behind the score, and
   can ask the AI for a written summary of the risk indicators.
5. **You decide, and it is recorded.** You confirm or dismiss the case, and
   FinSight keeps a record of who did what and when. You can download the case as
   a PDF.

---

## Try it in about five minutes

You need Docker installed. Then, in the project folder:

```sh
docker compose up --build
```

When it finishes starting:

- Open the app at <http://localhost:8080>
- Load the demo data (once):

```sh
docker compose run --rm api node apps/api/dist/seed/index.js
```

Then sign in with `admin@demo.com` and the password `Demo@1234`. You will land on
a demo review with 16 cases, including three marked Critical.

To stop everything, press `Ctrl+C`, then run `docker compose down`.

---

## Run it on your own computer

You need Node.js 24 or newer, plus PostgreSQL and Redis (both can run in Docker).

```sh
cp .env.Example .env     # then set DATABASE_URL and REDIS_URL in that file
npm install
npm run db:generate      # prepare the database client
npm run db:migrate       # create the database tables
npm run db:seed          # optional: load the demo review and its 16 cases
npm run dev              # starts the app, the API and the background worker
```

Open <http://localhost:5173>.

Two more things worth knowing:

- **Background work has a worker.** Analysis runs and AI summaries are done in
  the background, and `npm run dev` starts that worker for you. If you want it on
  its own (for example while running the API by hand), use `npm run worker`.
- **No AI key? No problem.** Without a key, FinSight writes the summary itself in
  a fixed, offline way. Everything still works, including the demo data.

---

## Signing in

- **New here?** Open `/signup` and create an account. The first person from a new
  organisation becomes its administrator, and the organisation is created at the
  same time, so nobody ever ends up inside someone else's company by accident.
- **Adding teammates?** An administrator adds them from the Users page. People
  cannot add themselves to an existing organisation.

### Demo accounts

All four demo accounts use the password `Demo@1234`.

| Email              | What they can do                              |
| ------------------ | --------------------------------------------- |
| `admin@demo.com`   | Everything, including users and rule settings |
| `manager@demo.com` | All cases and decisions, rules, the audit log |
| `analyst@demo.com` | Uploads, analyses, cases, AI summaries        |
| `viewer@demo.com`  | Read-only: cases and decisions already made   |

---

## Where the AI comes from

FinSight can use any one of four options. It picks the first one you have
configured, in this order:

| Order | Option                             | What you need                                          |
| ----- | ---------------------------------- | ------------------------------------------------------ |
| 1     | Anthropic Claude                   | `ANTHROPIC_API_KEY`                                    |
| 2     | Ollama (cloud or your own machine) | `OLLAMA_API_KEY`, or `OLLAMA_HOST` for a local install |
| 3     | OpenCode                           | `OPENCODE_API_KEY`                                     |
| 4     | Built-in offline mode              | nothing at all                                         |

If you want to force a particular one, set `AI_PROVIDER` to `anthropic`,
`ollama`, `opencode` or `mock`. The app records which one wrote each summary
(for example `ollama:gpt-oss:120b`) and shows it on the case.

Whichever option you choose, the same safety steps apply:

- Names and account numbers are replaced with neutral labels before anything is
  sent to the AI.
- The answer must follow a fixed structure, and every claim must point to a
  finding that actually exists in the case.
- The wording is checked, so an answer that accuses anyone is thrown away and
  retried.
- A person still has to accept the summary before it counts for anything.

---

## Who can do what

There are four roles: Administrator, Manager, Analyst and Viewer. The app hides
what a role cannot use, and the server refuses the request as well, so the
protection does not depend on the screen alone.

Each organisation's data is completely separate. If someone from another
organisation tries to open a case by its address, they get "not found" rather
than a hint that it exists.

---

## Common problems

| What you see                                            | What to do                                                                                                                   |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| The page loads but nothing happens                      | Make sure the API is running on port 3000 and that `WEB_ORIGIN` matches the address you opened.                              |
| Uploads or AI summaries stay "queued"                   | Make sure the worker is running: `npm run dev` starts it, or run `npm run worker`.                                            |
| "An account with this email already exists" on sign-up  | That email is already registered. Sign in instead, or use a different address.                                               |
| Sign-in works, but the page reloads to the login screen | The refresh cookie was rejected. Check that `WEB_ORIGIN` has no trailing slash and that cookies are allowed for `localhost`. |
| The AI summary fails                                    | Check the provider key, or set `MOCK_LLM=true` to use the offline mode.                                                      |

---

## For developers

The project is a single repository with two apps and a few shared packages.

| Folder               | What lives there                                                                 |
| -------------------- | -------------------------------------------------------------------------------- |
| `apps/api`           | The server: rules engine, AI summaries, PDF export, background worker, demo data |
| `apps/frontend`      | The web app people use                                                           |
| `packages/db`        | Database schema and migrations                                                   |
| `packages/shared`    | Types, rules and form rules used by both apps                                    |
| `packages/ui`        | Shared buttons, cards, tables and other interface pieces                         |
| `packages/utils`     | Configuration and login helpers                                                  |
| `packages/cache`     | Connection to Redis                                                              |
| `docs/DEVIATIONS.md` | Every place where the build differs from `Format.md`, and why                    |

### Commands

| Command                             | What it does                                             |
| ----------------------------------- | -------------------------------------------------------- |
| `npm run dev`                       | Start the web app, the API and the background worker     |
| `npm run worker`                    | Start only the background worker (analysis and AI jobs)  |
| `npm run build`                     | Build everything                                         |
| `npm test`                          | Run the automated tests                                  |
| `npm run lint`                      | Check the code style                                     |
| `npm run check-types`               | Check the TypeScript types                               |
| `npm run db:migrate`                | Create or update the database tables                     |
| `npm run db:seed`                   | Load the demo review and its cases                       |
| `npm run db:reset`                  | Wipe the database and start again (development only)     |
| `npm run seed:verify`               | Check that every planted demo scenario is still detected |
| `npm run seed:export-demo-workbook` | Write the demo data to an Excel file                     |

### Settings

Every setting is listed with a comment in `.env.Example`. The API checks the
required ones when it starts and stops with a clear message if one is missing.

Never commit a real secret. Bank account numbers are never stored in readable
form: only a one-way fingerprint is kept.

The web app reads its own settings from `apps/frontend/.env`. In development it
falls back to `http://localhost:3000/api/v1`, which is what you want locally.

### Tests

```sh
npm run check-types
npm run lint
npm test
```

The server tests use Node's built-in test runner; the web app uses Vitest with
Testing Library. A few checks need a live database or a real browser and are
described in `docs/DEVIATIONS.md`.

---

## More detail

- `Format.md` is the original specification this project was built from.
- `docs/DEVIATIONS.md` lists every deliberate difference from it, with reasons.
