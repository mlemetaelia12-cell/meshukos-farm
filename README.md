# MESHUKO'S S AND G FARM — Sheep & Goat Record Keeping

A responsive farm website plus a private owner/admin workspace for livestock groups, opening stock, daily stock reports, internal/external transfers, live running quantities and movement history. Built with JavaScript/TypeScript, Next.js App Router and Neon PostgreSQL.

## Included

- Public farm website with WhatsApp contact CTA.
- Private admin sign-in; **there is no sign-up page**. Credentials live on the server in `.env` / Vercel environment variables.
- Responsive dashboard with live livestock totals, sheep/goat totals, sick-animal count from the latest finalized report, group register, daily-report history and movement history.
- Group setup with species, breed, sex, category, group name, tip tag / tag colour and one-time opening quantity.
- Daily reports with date, type, breed, sex, category, group, tip tag/colour, current quantity, newborn male, newborn female, new stock, transfers in/out, lost, mortality, sold, slaughter, net quantity and sick count.
- Draft reports do not affect the live stock ledger. Finalization calls a PostgreSQL function which creates the report movements and report snapshot atomically.
- Internal transfers create paired OUT and IN movements with the same transfer ID. External in/out transfers update the farm stock ledger in the correct direction.
- PDF/print layout for daily reports; CSV export for report lines and movement history.
- Audit events, idempotency keys, basic server-side validation, signed HttpOnly session cookie and database-side checks.
- Custom SVG logo, app icon, favicon and local sheep/goat farm illustration.
- Developer credit for **Brell**, `buildwebtz@gmail.com`, WhatsApp `+255 784 452 159`.
- No fake livestock, sample reports or mock transaction data. The DB starts with farm settings only; the owner must add real herd groups/opening balances.

## Requirements

- Node.js 20.9+ (Node 22 LTS recommended).
- npm.
- A Neon PostgreSQL database.
- A Vercel account for deployment.

## 1. Install locally on Windows

1. Extract the ZIP into a folder, for example `C:\Users\YOUR_USER\Documents\meshukos-farm`.
2. Open that folder in VS Code.
3. Copy `.env.example` to a new file named `.env`.
4. In Neon Console, create a PostgreSQL project/database and copy the **pooled connection string** from the Connect dialog. Put it in `DATABASE_URL`.
5. Set the admin email and password in `.env`. This email/password is the only admin login; do not add quotes around values unless needed by dotenv parsing.
6. Generate a strong session secret from PowerShell:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```

   Paste the result into `SESSION_SECRET`.

7. Open a terminal in the project folder and run:

   ```powershell
   npm install
   npm run db:migrate
   npm run lint
   npm run typecheck
   npm run dev
   ```

8. Open `http://localhost:3000`. The public farm website loads first; choose **Admin sign in** to access `/login`.
9. On the first successful login, open **Livestock groups** and enter each real herd group and its opening quantity. The app intentionally contains no seeded animals or made-up reports.

### Example `.env`

```dotenv
DATABASE_URL=postgresql://...your-neon-pooled-connection-string...
ADMIN_EMAIL=owner@example.com
ADMIN_PASSWORD=your-unique-long-password
SESSION_SECRET=paste-a-long-random-secret-here
FARM_WHATSAPP=255783872819
BRELL_EMAIL=buildwebtz@gmail.com
BRELL_WHATSAPP=255784452159
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Do not share the filled `.env` file, commit it to GitHub, or put admin credentials in a `NEXT_PUBLIC_` variable. The `.env.example` file is safe to share; the real `.env` is ignored by Git.

## 2. Neon schema / database migration

`sql/001_init.sql` creates the initial tables, indexes and PostgreSQL functions. `sql/002_newborn_by_sex.sql` adds separate male/female newborn quantities and updates report finalization. `npm run db:migrate` applies numbered migrations in order in a database transaction. The migration seeds only the farm profile, not stock records.

Run `npm run db:migrate` against the intended Neon database. It applies both `001_init.sql` and `002_newborn_by_sex.sql`; it is designed to be re-run for these migrations (`IF NOT EXISTS` / `CREATE OR REPLACE`). Back up the Neon database before applying schema changes anyway. The newborn migration adds columns without deleting or overwriting the original `born_quantity`, so older rows with no sex breakdown remain visible as legacy/unassigned newborn counts.

The application runtime uses Neon's serverless JavaScript driver; the migration helper uses `pg` so it can run the full SQL migration file in a transaction.

## 3. Deploy to Vercel

1. Create a private Git repository from this project, or use Vercel's import flow on your private repository.
2. Do **not** upload `.env`; it contains credentials. Commit `.env.example` only.
3. In Vercel Project → Settings → Environment Variables, add:
   - `DATABASE_URL` — Neon pooled connection string
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD`
   - `SESSION_SECRET` — a random value at least 32 characters long
   - `FARM_WHATSAPP` = `255783872819`
   - `BRELL_EMAIL` = `buildwebtz@gmail.com`
   - `BRELL_WHATSAPP` = `255784452159`
   - `NEXT_PUBLIC_SITE_URL` = your final `https://...` domain
4. Run `npm run db:migrate` locally against the same Neon database (or execute `sql/001_init.sql` in the Neon SQL Editor) before testing the deployed site.
5. Set the Vercel build command to `npm run build` (default), then deploy.
6. Test the public homepage, admin login, group creation, reports, transfers, CSV and browser print-to-PDF on the deployed URL.
7. Add your final domain in Vercel after testing; set `NEXT_PUBLIC_SITE_URL` to that exact HTTPS URL if you use it elsewhere later.

## 4. Report and stock rules

- All quantities are non-negative whole numbers. Movements store a positive magnitude plus a movement type that defines whether it adds to or subtracts from stock.
- `Current Quantity` in a report means stock existing before the selected report date. Same-day `OPENING` entries are treated as the initial baseline for that day.
- The closing quantity formula is:

  `Opening + Born + New Stock + Transfer In - Transfer Out - Lost - Mortality - Sold - Slaughter`

- Sick count is a health count and does not subtract stock; it may not exceed the closing count for the group.
- Draft reports do not affect live stock. Finalization snapshots the quantities and inserts report-generated movements exactly once. Transfer fields on a report are read-only totals from the separate transfer register; record the transfer on that report date before finalizing.
- Record the same animal movement only once: use `New Stock` for new stock acquisitions not being tracked as transfers; use external `Transfer In/Out` when the animal is moving between farms. Do not enter the same animals as both `New Stock` and `Transfer In`, or both `Sold` and `Transfer Out` for a single event.
- Transfers to another group within the farm decrease the source and increase the destination in one database function call. Sheep cannot be transferred into a goat group.
- The current implementation blocks finalizing an older-dated report when a later-dated report has already been finalized. This avoids silently rewriting subsequent historical snapshots. For a retroactive correction, the app presently requires an authorised ledger correction workflow to be designed rather than silently allowing backdated edits.
- A report date cannot be in the future. Transfers cannot be posted to a date already finalized.

## 5. Pre-launch limitations / things to verify with the farm owner

- The supplied paper includes both `Lost` and `Mortality`; they remain separate fields in this implementation.
- `Sick` is a current count captured on the daily report; there is not yet an individual treatment/vaccination module because those fields were not supplied on the paper.
- To record newborns by sex, create the relevant livestock group(s) with `Sex = MALE`, `Category = NEWBORN` for males and `Sex = FEMALE`, `Category = NEWBORN` for females. The report editor enables the matching newborn input on those rows only; each newborn count increases the corresponding sex-specific live group.
- The old `born_quantity` database field is retained for backward compatibility. If an older draft/finalized report already used the undivided field, it is displayed separately as `Legacy births (unassigned)`; it is not silently moved into male or female counts.
- Records are grouped by type, breed, sex, category, group name and tag. This version is **group-level inventory**, not individual animal ear-tag tracking.
- Admin password is an environment secret per the requested setup. Use a strong unique password and rotate it through Vercel environment variables when necessary. Sessions expire after eight hours.
- Before handing over, test against the customer's actual sheet and their actual opening balances. Do not enter the example numbers shown in design notes as farm data.
- Configure database backups / restore policy inside Neon before using this as the farm's only operational record.

## 6. Commands

```bash
npm run dev        # Local development server
npm run lint       # ESLint
npm run typecheck  # TypeScript check
npm run build      # Production build
npm start          # Run production build locally
npm run db:migrate # Apply PostgreSQL schema using DATABASE_URL in .env
```

## Branding assets

- `public/logo.svg` — main farm logo lockup
- `public/app-icon.svg` — square app icon
- `public/favicon.svg` — browser favicon
- `public/herd-illustration.svg` — local original vector illustration used in the public page and dashboard

The site is designed mobile-first and supports desktop, tablet and mobile breakpoints. The public WhatsApp button opens the farm's chat at `+255 783 872 819`; developer support is branded as Brell
