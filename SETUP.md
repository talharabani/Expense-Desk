# Setup Guide — Expense Desk (Business Expense & Cash-Flow Tracker)

End-to-end setup: folders → Supabase → env vars → first run → deploy.
Nothing here assumes prior state. Follow it top to bottom once.

---

## 0. Prerequisites

| Tool | Version | Check |
|---|---|---|
| Node.js | **22+** (24.x verified) — `@supabase/*` requires >=22 | `node -v` |
| npm | 10+ | `npm -v` |
| Git | any | `git --version` |
| Supabase account | free tier is enough | https://supabase.com |
| Vercel account | only needed for deploy | https://vercel.com |

---

## 1. The folder layout (read this first)

The project has a **nested** structure. This is the #1 source of "command not found" and failed builds:

```
D:\expense tracker\               <- outer workspace folder (NOT the app)
├── .kiro\specs\                  <- requirements / design / tasks
├── .vscode\settings.json
└── expense-tracker\              <- THE APP. Git repo root. Run everything here.
    ├── app\                      <- Next.js App Router (pages + API routes)
    ├── components\               <- React components (components/ui = shadcn)
    ├── lib\                      <- supabase clients, auth, services, hooks
    ├── supabase\migrations\      <- SQL schema (run_all.sql = the whole DB)
    ├── tests\
    ├── types\index.ts
    ├── proxy.ts                  <- auth session refresh (Next.js proxy convention)
    ├── package.json
    └── .env.local                <- your secrets (git-ignored, you create this)
```

**Rule: every `npm` command below runs inside `expense-tracker\`, never the outer folder.**

### 1a. Getting the folder

Fresh machine:

```bash
git clone https://github.com/talharabani/Expense-Desk.git
```

Then step into it:

```bash
cd Expense-Desk
```

Already have it at `D:\expense tracker`:

```bash
cd "D:/expense tracker/expense-tracker"
```

### 1b. Adding the folder to your editor

- **Open the app folder directly:** VS Code → `File → Open Folder…` → select `expense-tracker`. Enough if you only want to write code.
- **Add both folders (recommended):** open `expense-tracker` first, then `File → Add Folder to Workspace…` → pick the outer `D:\expense tracker` so `.kiro\specs\` is visible too. Save it with `File → Save Workspace As…`.
- **Terminal / Claude Code:** always `cd` into `expense-tracker` first. The outer folder is not a git repo; the inner one is.

### 1c. Install dependencies

```bash
npm install
```

---

## 2. Create the Supabase project

1. https://supabase.com/dashboard → **New project**.
2. Name it (e.g. `expense-desk`), set a strong DB password, pick the region closest to your users.
3. Wait for provisioning (~2 min).

### 2a. Create the database schema

1. Dashboard → **SQL Editor** → **New query**.
2. Open `supabase/migrations/run_all.sql`, copy the **entire** file, paste it, **Run**.
   - It is idempotent (`CREATE TABLE IF NOT EXISTS`), so re-running is safe.
   - It creates `companies`, `users`, `departments`, the financial tables (expenses, income, payroll, subscriptions, budgets, accounts, advances), the supporting tables (clients, vendors, projects, documents, notifications, audit_logs) and all **RLS policies**.
3. Verify in **Table Editor**: the tables are listed and each shows *RLS enabled*.

> The four numbered files in `supabase/migrations/` are the same schema split by concern, for use with the Supabase CLI. Pasting `run_all.sql` into the SQL Editor is the supported path.

### 2b. Create the storage bucket (the folder receipts go into)

Receipts and attachments go to a **private** bucket named `documents`, keyed per company:

```
documents/<company_id>/<entity_type>/<entity_id>/<timestamp>-<random>.<ext>
```

The app auto-creates this bucket on the first upload **if** `SUPABASE_SERVICE_ROLE_KEY` is set — see `lib/documents/service.ts:43`. To create it by hand instead:

1. Dashboard → **Storage** → **New bucket**.
2. Name: `documents` — **Public: off**.
3. Additional settings → file size limit `10 MB`; allowed MIME types `image/jpeg, image/png, image/webp, application/pdf`.

Files are never served publicly — the app issues 1-hour signed URLs.

### 2c. Auth settings

Dashboard → **Authentication → Sign In / Providers → Email**:

- **Local development:** turn *Confirm email* **off**. Registration then returns a session immediately and you land straight in the app.
- **Production:** leave *Confirm email* **on**.

Dashboard → **Authentication → URL Configuration**:

- Site URL: `http://localhost:3000` for dev, your Vercel domain for production.
- Redirect URLs: add both `http://localhost:3000/**` and `https://<your-app>.vercel.app/**`.

### 2d. Copy your keys

Dashboard → **Project Settings → API**:

| Value | Env var | Exposed to the browser? |
|---|---|---|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` | yes |
| `anon` / publishable key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes |
| `service_role` key | `SUPABASE_SERVICE_ROLE_KEY` | **NO — server only** |

The service role key bypasses RLS. Never put it in a `NEXT_PUBLIC_*` var, never commit it, never send it to the client.

---

## 3. Environment variables

Create `.env.local` inside `expense-tracker\`:

```bash
cp .env.local.example .env.local
```

Fill it in:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...        # ~200+ chars
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...            # server-only; needed for /setup and uploads
```

Paste hygiene matters — `lib/supabase/env.ts` validates these and reports exactly what is wrong:

- No wrapping quotes, no trailing spaces, no line breaks inside a key.
- Use the dashboard's copy button, not a chat or doc that may substitute smart quotes or zero-width characters.
- The URL must be `https://<project>.supabase.co`; an anon key under 100 characters is treated as truncated.

When something is off, the server logs `Supabase is NOT configured...` naming the failing check, instead of failing later with a confusing DNS error.

`VERCEL_OIDC_TOKEN` in `.env.local` was added by the Vercel CLI. Ignore it — it is not needed locally.

---

## 4. Run it

```bash
npm run dev
```

Open http://localhost:3000.

### First-run flow, in order

1. **`/register`** — create your account (email + password).
   - Confirm-email off → straight into the app. On → click the emailed link first.
2. **`/setup`** — the one-time company bootstrap. Enter your name, company name, base currency (default `PKR`) and industry type (`software_house` / `call_center` / `truck_dispatching` / `general`).
   - This calls `POST /api/setup`, which creates the `companies` row and your `users` row with role **`owner`**. It requires `SUPABASE_SERVICE_ROLE_KEY`; without it you get *"Service role key not configured"*.
3. **`/dashboard`** — you're in. Expenses, income, payroll, projects, approvals and reports are all scoped to your company by RLS.

Roles, highest to lowest: `owner` → `finance_manager` → `manager` → `team_lead` → `employee`, plus `auditor` (read-only). Add further users from **Employees**; the first user is always the owner.

---

## 5. Day-to-day commands

```bash
npm run dev
```

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on :3000 |
| `npm run build` | Production build (Turbopack) |
| `npm run build:webpack` | Production build via webpack — use when Turbopack can't spawn workers locally |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm test` | Vitest watch mode |
| `npm run test:ui` | Vitest interactive UI |
| `npm run test:run` | Single run (CI) |

Testing is dual: Vitest unit tests plus `fast-check` property-based tests (minimum 100 runs per property), both alongside the source as `*.test.ts`.

---

## 6. Deploy to Vercel

1. https://vercel.com/new → import `talharabani/Expense-Desk`.
2. **Root Directory:** leave it at the repo root. The git repo *is* `expense-tracker` — the outer `D:\expense tracker` folder is not tracked. Only set a root directory if you later commit the app under a subfolder.
3. Framework preset: **Next.js** (auto-detected). Build command and output directory stay default.
4. **Environment Variables** — add all three, for **Production, Preview and Development**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
5. **Deploy.**
6. Back in Supabase → **Authentication → URL Configuration**: set the Site URL to your Vercel domain and add `https://<your-app>.vercel.app/**` to the redirect URLs.

**`NEXT_PUBLIC_*` values are baked in at build time.** After changing them in Vercel you must redeploy with **"Use existing Build Cache" unticked**, or the old values stay compiled into the bundle.

---

## 7. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `ERR_NAME_NOT_RESOLVED` on `placeholder.supabase.co` | Env vars missing or invalid at build time | Read the `Supabase is NOT configured` server log — it names the failing check. Fix `.env.local`, restart the dev server |
| `String contains non ISO-8859-1 code point` | Smart quote / ellipsis / zero-width char pasted into a key | Re-copy the key with the dashboard's copy button |
| `Service role key not configured` on `/setup` | `SUPABASE_SERVICE_ROLE_KEY` missing or still a placeholder | Add the real key to `.env.local`, restart |
| Signed up but no data anywhere | `/setup` never completed | Visit `/setup` and finish the company bootstrap |
| `Profile already exists` (409) | Setup ran twice | Expected — go to `/dashboard` |
| Empty tables or permission errors | `run_all.sql` not run, or RLS blocking a user with no `users` row | Re-run `run_all.sql`; confirm your `users` row exists with the right `company_id` |
| Uploads fail | `documents` bucket missing and no service role key | Create the bucket manually (§2b) or add the service key |
| Env change on Vercel had no effect | `NEXT_PUBLIC_*` baked at build time | Redeploy with build cache **off** |
| `Error: spawn EPERM` during build | Intermittent worker-spawn failure on Windows — hits Turbopack *and* webpack, and is unrelated to your code or env vars | Just re-run `npm run build`; it succeeds on retry. If it persists, `npm run build:webpack`. Does not occur on Linux CI |
| Auth redirect loops after deploy | Supabase Site URL / redirect URLs still point at localhost | Update §2c with the production domain |

---

## 8. Specs

Requirements, design and the task list live in the outer workspace folder:

```
D:\expense tracker\.kiro\specs\business-expense-cashflow-tracker\
├── requirements.md   # acceptance criteria
├── design.md         # architecture, correctness properties
└── tasks.md          # implementation checklist
```

Read these before adding a feature — the property-based tests map one-to-one onto the correctness properties in `design.md`.
