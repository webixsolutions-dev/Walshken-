# Walshken

Standalone corporate website and staff operations workspace built with Next.js, TypeScript and PostgreSQL. Vercel builds from the repository root. The production domains are configured separately.

## Frontend review

Open the corporate homepage at `/`, the service directory at `/services`, country availability at `/countries`, and the About and Contact pages at `/about` and `/contact`. Every published catalog entry has a division page, and every supported ISO country has a direct availability link. The read-only staff design preview is at `/preview`. The preview has separate Admin and Employee views with sample records and uses no staff APIs. It is enabled on the frontend-only deployment and in local development.

## Local development

1. Run `npm ci` using Node.js 22.
2. Copy `.env.example` to `.env.local`. Set a local administrator email, a unique random setup code of at least 24 characters, and an integration encryption key if you want to test credential storage.
3. Run `npm run dev`. The app creates an isolated PostgreSQL database under `.walshken-data` if `DATABASE_URL` is unset in development.
4. Open `/staff` and set up the first administrator. Use Employees to issue staff activation codes. Use separate browser sessions for role checks.

## Vercel and Supabase

- Create a dedicated PostgreSQL database for Walshken. Keep Preview and Production databases separate.
- Run `npm run db:migrate` with a direct or session-pooler database URL before enabling staff access. Apply migrations using the schema owner.
- Add `DATABASE_URL` to the matching Vercel environment. Use the Supabase transaction pooler for serverless requests. The adapter disables prepared statements.
- Configure `WALSHKEN_ADMIN_EMAIL`, `WALSHKEN_SETUP_CODE`, and a separate 32-byte base64 `WALSHKEN_INTEGRATION_KEY` as protected environment variables. Remove the bootstrap code after initialization and redeploy.
- The company site can render the initial catalog while the database is pending. Staff access and inquiry submissions require the database.
- The Data API can stay disabled. Only the server connects to PostgreSQL. The initial schema enables RLS and revokes Data API role grants on the workspace tables. Review the database runtime grants before handling production records.

## Implemented in this build

- Country autocomplete with ISO codes, market and service availability, configurable destinations, public inquiries and launch interest.
- Account activation, scoped roles, password sign-in, expiring server-side sessions, account suspension and admin-issued reset codes.
- Profiles, organization units, projects, tasks and discussions, work calendars, shifts, attendance and breaks, timesheet submission and review, leave requests, notifications.
- Membership-scoped messages, private file upload and access grants, meeting schedules, a Daily room adapter, encrypted provider settings and administrative audit history.
- Effective-dated pay rates and base hourly estimates from approved time. Estimates omit overtime, holiday pay, taxes and deductions. Overnight attendance is supported and overnight payroll records require separate review.

## Production readiness

Before employee onboarding, verify managed MFA and recovery, database runtime permissions, backup and recovery, retention, and load capacity. The current private document store uses PostgreSQL for files up to 3 MB. Configure production file storage and malware scanning before handling confidential documents. Live Daily calls need a configured account. Twilio, transactional email and compliant payroll workflows need provider wiring and verification. Statutory holiday pay, payroll finalization, approved payslips and payments remain separate work.
