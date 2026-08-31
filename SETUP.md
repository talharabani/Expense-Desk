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

> **Windows: do not commit a lockfile written by a Windows `npm install`.**
> npm resolves the `wasm32-wasi` optional dependencies of `@tailwindcss/oxide`
> only on Linux, so installing on Windows silently strips `@emnapi/core` and
> `@emnapi/runtime` from `package-lock.json` — and CI then fails with
> *Missing: @emnapi/runtime from lock file*. After adding or updating a
> dependency, regenerate the lockfile on Linux before committing:
>
> From `expense-tracker\` in **PowerShell** (`$PWD:` is a parse error there — the
> braces are required):
>
> ```bash
> docker run --rm -v "${PWD}:/app" -w /app node:24 npm install --package-lock-only
> ```
>
> From **Git Bash**, `MSYS_NO_PATHCONV=1` stops the path being mangled:
>
> ```bash
> MSYS_NO_PATHCONV=1 docker run --rm -v "$PWD:/app" -w /app node:24 npm install --package-lock-only
> ```

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

- *Confirm email* **off** — registration returns a session immediately and you land straight in the app. No mail server needed. Fine for development; it also means anyone who can reach the app can create an account.
- *Confirm email* **on** — the account cannot sign in until the emailed link is clicked. This is the right setting for production, but it only works if mail is actually delivered: see §2e.

Dashboard → **Authentication → URL Configuration**:

- Site URL: `http://localhost:3000` for dev, your Vercel domain for production.
- Redirect URLs — the confirmation link is refused if its target is not listed here. Add all of:
  - `http://localhost:3000/**`
  - `https://<your-app>.vercel.app/**`

### 2e. Email confirmation that actually arrives

Keeping *Confirm email* on needs three things. Miss any one and registration ends at a "check your email" screen for a message that never comes, or a link that goes nowhere.

**1. A real mail sender.** Supabase's built-in service is for testing only: a few messages per hour, and on current projects it will only deliver to addresses belonging to project members. Every other address is silently dropped. Configure your own under **Project Settings → Authentication → SMTP Settings**.

Expect friction here. Free tiers are gated to keep spammers out, and each gate bites differently:

| Provider | Host | The catch |
|---|---|---|
| Resend | `smtp.resend.com:465` | Instant signup. Without a **verified domain** it only delivers to the address you registered with — fine for solo testing, useless for real users |
| Mailjet | `in-v3.mailjet.com:587` | 200/day free, any recipient, but sending is blocked pending a **manual business review** that can take days |
| SendGrid | `smtp.sendgrid.net:587` | 100/day, also subject to manual review |
| Brevo | `smtp-relay.brevo.com:587` | SMTP relay is no longer on the free plan |
| Gmail | `smtp.gmail.com:587` | Works with a Google **App Password** (needs 2-Step Verification), no review, no domain. But it throttles: bursts produce `504 Context deadline exceeded` on `/auth/v1/signup`, because GoTrue sends the mail synchronously and Gmail leaves the connection hanging |

**If you own a domain, verify it with Resend and stop here** — that path has no review queue and no recipient restriction. Everything else is a workaround.

Raise **Rate limit for sending emails** under **Authentication → Rate Limits** afterwards; it stays at the built-in value until you do.

**When mail is not working yet**, do not let it block development. Turn *Confirm email* **off** (§2c) and carry on: registration returns a session immediately, and every piece of the confirmation setup — the template, the redirect URLs, `/auth/confirm` — stays in place for when you turn it back on. Just remember the trade-off: with it off, anyone can register with an address they do not own.

**2. The link must point at this app.** `signUp` sends `emailRedirectTo` pointing at `/auth/confirm`, which is a route handler in this repo: it verifies the token, sets the session cookie, and forwards to `/setup`. A failed or expired link lands on `/login` carrying the reason.

**3. The template must carry a token the server can read.** The default `{{ .ConfirmationURL }}` template sends a PKCE `code`, which can only be exchanged in the *same browser* that started the sign-up — the verifier is stored in a cookie there. Someone who registers on a laptop and opens the mail on their phone gets confirmed but not signed in, and lands on the sign-in page instead.

Switching the template to `{{ .TokenHash }}` removes that constraint entirely: the token is verified server-side, needs no cookie, and works from any browser or device. **This is the recommended setting.** Edit **Authentication → Emails → Confirm signup** and use:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/setup">
  Confirm your email
</a>
```

`/auth/confirm` accepts both shapes, so either template works.

**Verifying it end to end:** register with a real address, confirm the message arrives, click the link, and check you land on `/setup` already signed in. If the link errors, the message on `/login` says why — an expired or already-used link offers to send a new one.

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
| `npm run dev:webpack` | Dev server without Turbopack — use when Turbopack cannot spawn its worker (see the `Access is denied` row below) |
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
| Registered, but no confirmation email arrives | Supabase's built-in mailer only delivers to project members and is rate limited | Configure your own SMTP (§2e) |
| Confirmation link errors or does nothing | The target is not in **Redirect URLs**, or the link expired | Add the URL patterns in §2c; use the resend option offered on /login |
| Signed up but no data anywhere | `/setup` never completed | Visit `/setup` and finish the company bootstrap |
| `Profile already exists` (409) | Setup ran twice | Expected — go to `/dashboard` |
| Empty tables or permission errors | `run_all.sql` not run, or RLS blocking a user with no `users` row | Re-run `run_all.sql`; confirm your `users` row exists with the right `company_id` |
| Uploads fail | `documents` bucket missing and no service role key | Create the bucket manually (§2b) or add the service key |
| CI fails with `Missing: @emnapi/runtime from lock file` | `package-lock.json` was last written by `npm install` on Windows | Regenerate it on Linux (see §1c for the PowerShell and Git Bash forms), then commit |
| Env change on Vercel had no effect | `NEXT_PUBLIC_*` baked at build time | Redeploy with build cache **off** |
| `Access is denied. (os error 5)` compiling `globals.css`, every page 500s | Security software is blocking Turbopack from spawning its PostCSS worker. 360 Total Security does this; Defender's real-time protection being off is a sign another product has taken over | Whitelist the project folder and `node.exe` in that product, or uninstall it. Workaround meanwhile: `npm run dev:webpack` |
| `Error: spawn EPERM` during build | Intermittent worker-spawn failure on Windows — hits Turbopack *and* webpack, and is unrelated to your code or env vars | Just re-run `npm run build`; it succeeds on retry. If it persists, `npm run build:webpack`. Does not occur on Linux CI |
| Auth redirect loops after deploy | Supabase Site URL / redirect URLs still point at localhost | Update §2c with the production domain |

---

## 8. Keeping a free project awake

A free Supabase project **pauses after 7 days without database activity**, and unpausing is manual — so the app stays down until someone notices. `.github/workflows/keepalive.yml` prevents that by reading one row from the `health_check` table every Monday and Thursday.

**Setup, once:**

1. Run `supabase/migrations/20240101000006_health_check.sql` in the SQL Editor. It creates a one-row table readable by the anon key and nothing else — no business data, no write policy.
2. GitHub → your repo → **Settings → Secrets and variables → Actions → New repository secret**. Add two:
   - `SUPABASE_URL` → `https://<project>.supabase.co`
   - `SUPABASE_ANON_KEY` → the anon key
3. **Actions** tab → **Supabase keep-alive** → **Run workflow** to test it now rather than waiting for Monday.

Use the **anon** key, not the service role key. The ping needs no more privilege than a page load, and a repository secret is a poor place for a key that bypasses RLS.

Run it locally against your `.env.local` any time:

```bash
npm run keepalive
```

**Two things that will bite you:**

- **GitHub disables scheduled workflows after 60 days without repository activity**, and its own scheduled runs do not count. If the repo goes quiet for two months the keep-alive stops silently — and GitHub emails you before it does, so do not ignore that mail. Any push re-arms it.
- **Scheduled runs are queued, not guaranteed on time.** GitHub can start them an hour or more late under load. Two runs a week leaves plenty of slack against a 7-day timeout; a single weekly run would not.

## 9. Specs

Requirements, design and the task list live in the outer workspace folder:

```
D:\expense tracker\.kiro\specs\business-expense-cashflow-tracker\
├── requirements.md   # acceptance criteria
├── design.md         # architecture, correctness properties
└── tasks.md          # implementation checklist
```

Read these before adding a feature — the property-based tests map one-to-one onto the correctness properties in `design.md`.
