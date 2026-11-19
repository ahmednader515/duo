# Duo

An Arabic-first commerce workspace built with Next.js App Router, strict TypeScript, Tailwind CSS 4, Prisma 7, Neon PostgreSQL, stable NextAuth (Auth.js) v4, and Cloudflare R2. The original `homepage.jpeg` and `dashboard.jpeg` are retained as design references; every interface is built with React and CSS, including the Duo mascot.

## Local setup

Use Node.js 24 LTS and npm. Dependencies are locked in `package-lock.json`.

```powershell
npm ci
Copy-Item .env.example .env
```

Set `DATABASE_URL` to your Neon **pooled** PostgreSQL URL and `DIRECT_URL` to the **direct** URL for the same database/branch. Keep Neon's TLS parameters on both. The `pg` runtime explicitly normalizes `sslmode=require`, `prefer`, and `verify-ca` to `verify-full`, preserving certificate and hostname verification and avoiding the driver compatibility warning. Explicit local `sslmode=disable` and intentional `uselibpqcompat=true` configurations remain unchanged. Generate a secret with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"` and put it in `AUTH_SECRET`.

```powershell
npx prisma generate
# Review the target Neon branch before applying the checked-in initial migration.
npx prisma migrate deploy
npm run dev
```

Open http://localhost:3000, create an account at `/register`, and use your automatically created workspace. `npx prisma studio` uses the direct URL from `prisma.config.ts`.

`prisma.config.ts` uses `DIRECT_URL`, falling back to `DATABASE_URL`. A nonfunctional localhost placeholder lets client generation and builds run without credentials; it does not provide an operational database. Do not run schema commands until your target URL is set. `npx prisma db push` remains available for disposable development branches, but use checked-in migrations for deployed databases. Existing databases previously initialized with `db push` must have their schema reviewed and baselined before applying the initial migration.

If registration reports that the database schema is not initialized, apply the reviewed migration to the intended database and restart the development server. The SSL compatibility warning alone does not cause this registration failure: an empty database lacks the `RateLimit`, `User`, and workspace tables. API logs include safe Prisma/PostgreSQL error codes without exposing connection strings or query arguments.

## Cloudflare R2

Create a bucket and a bucket-scoped API token with object read/write access. Configure `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, and an HTTPS `R2_PUBLIC_URL` custom domain pointing to that bucket. A public domain is necessary for image delivery; disable listing and do not store private documents in this image bucket. Browser-to-R2 CORS is unnecessary because uploads go through the authenticated server endpoint.

Uploads support JPEG, PNG, and WebP, at most 5 MB each and 12 images per product. The server checks both content type and file signatures. Images upload after a new product is saved; a failed image upload preserves the saved product and displays a retry message. Keys are scoped to `workspaces/{workspaceId}/products/{productId}/{uuid}.{ext}`. Logo keys use the workspace's `logo/` prefix. Ownership is checked before upload/deletion; no browser receives storage credentials.

R2 and PostgreSQL cannot share a transaction. Product deletion removes objects first, preserving records if storage fails so retry remains possible. Repeated object deletes are idempotent. A rare DB failure after object deletion can leave records referencing missing images; rerun deletion. New uploads are removed on DB failure. Failed orphan/old-logo cleanup is logged and requires operational retry. Configure lifecycle/operations monitoring before a large production rollout. Images use Next Image with explicit dimensions and lazy loading; remote images are unoptimized to avoid an unrestricted remote image proxy. Configure a restricted image CDN/Next image allowlist for your R2 hostname if image transformations are desired.

## Implemented foundation

- Responsive Arabic RTL and English LTR homepage and dashboard, matching the supplied pink/lavender design language. Navigation labels and core forms are translated. Language uses a persisted cookie; profile preferences can also be saved.
- Real email/password registration with a transaction creating the user, workspace, OWNER membership, and initial activity. bcrypt cost 12, 12–72 character passwords, stable Auth.js/NextAuth with Prisma adapter, encrypted JWT cookie sessions (7 days), sign-in/sign-out, protected server layouts and authorization per action/endpoint. Credentials authentication requires JWT sessions; standard account/session/token tables remain available for future providers.
- Workspace switching for existing memberships. OWNER and ADMIN can edit; MEMBER has read-only catalog access. Creating additional workspaces and inviting members are intentionally future work.
- Product CRUD, exact Decimal prices, categories, SKU uniqueness per workspace, status, stock, barcode, weight/dimensions, search, filters, sorting, pagination, image uploads and confirmed deletion. Active status does not publish products.
- Overview and analytics query actual workspace records. No fabricated sales, marketplace performance, or AI responses.
- Functional profile, workspace name, logo, language, and password settings.
- Functional AI Studio using server-side `OPENAI_API_KEY`: product titles, descriptions, SEO keyword suggestions, image generation, and edits using an existing product image. Results are reviewed before applying; text can be edited, keywords copied, and images added explicitly. Generation history stores actual provider model, token usage, and estimated USD cost.
- Separate Amazon, Noon, Salla, and Trendyol service modules with a common interface. Methods explicitly throw unavailable errors; vendor-specific mapping and OAuth are not implemented. No merchant credentials are collected or stored. Future credential persistence must use authenticated envelope encryption/KMS; never write plaintext to `encryptedCredentials`.
- Loading/error/empty states, accessible confirmation dialogs, notifications, toasts, responsive navigation, keyboard focus styles, reduced-motion support.

Password reset is explicitly unavailable; no email or token success is simulated. Before enabling it, implement a verified mail provider and hashed, single-use, expiring reset tokens. Password changes increment the user's session version, immediately invalidating existing sessions and requiring a fresh login. Passwords must fit bcrypt's 72-byte UTF-8 limit. Email verification, MFA, invitations, billing, and automated sales sync are outside this foundation.

## Security and tenancy

Server-only database, storage, authentication, and integration modules. Every dashboard query is scoped to the selected membership's workspace. Each mutation rechecks membership and role. Product/category, AI/product, and listing/product/connection relationships use composite workspace foreign keys to prevent cross-workspace associations at the database level. Account and email identifiers are normalized. Registration/login/password/upload attempts are throttled through an atomic PostgreSQL rate-limit table shared across instances. Place public auth endpoints behind a trusted host/WAF rate limit before internet-scale rollout, and periodically purge expired `RateLimit` records. Explicit Origin checks protect custom mutation endpoints; Next Server Actions and NextAuth provide their own request protections.

Keep `.env` untracked. No keys belong in `NEXT_PUBLIC_*`. R2 public URLs intentionally allow public product imagery; workspace isolation protects mutation permissions, not private image reads. Invite no untrusted users until your application's data policy is set.

## Checks

```powershell
npm run typecheck
npm run lint
npm test
npx prisma validate
npx prisma generate
npm run build
```

The initial migration was applied to the configured Neon database with explicit approval. Live HTTP checks verified registration (201), login, authenticated dashboard access, and creation of the workspace and OWNER membership. The AI approval/R2 workflow test verified edited text approval, real R2 object creation/deletion, image attachment, idempotency, and role/workspace restrictions using disposable fixtures. Temporary test records and R2 objects were removed afterward. A missing-credentials landing/auth page still renders; dashboard routes require a real session and do not have a demo bypass.

The opt-in integration test was run successfully against a disposable PGlite TCP server on loopback. It verifies real HTTP registration/login, schema synchronization, create/edit/delete Server Actions, exact Decimal persistence, categories and filters, cross-workspace reads/mutations, database tenant foreign keys, MEMBER restrictions, upload authentication/ownership/signature rejection, workspace settings, password changes, and session invalidation. Browser QA also covered Arabic/English desktop and 390px mobile layouts, protected redirects, and a real form save. This does not substitute for Neon or R2 acceptance testing.

To repeat isolated integration checks, start a disposable PostgreSQL database (PGlite can be launched with `npx --yes @electric-sql/pglite-socket --port=55432 --host=127.0.0.1 --max-connections=10`; it is a test tool, not an application dependency). Point both the running development app and test process at that database and run the reviewed schema push first. In the test terminal:

```powershell
$env:DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:55432/postgres?sslmode=disable'
$env:DUO_RUN_DB_TESTS='1'
npx tsx --test tests/integration.test.ts
```

The running app must be on port 3000 with `AUTH_URL=http://localhost:3000` and a temporary `AUTH_SECRET`. The integration test only accepts loopback database URLs and deletes only its own generated users/workspaces. It uses Next's development action manifest and must run against `next dev`. Normal `npm test` skips the opt-in integration test. Shut down the disposable database after testing; no test accounts or fallback database are shipped in production views.

Manual acceptance after configuring a development Neon branch:

1. Push the reviewed schema; register two users. Confirm independent OWNER workspaces and valid login/logout.
2. Create/edit/search/filter/sort a product; verify exact price, inventory, status, category, and persistence across reloads. Test a duplicate SKU.
3. As the second user, request the first workspace's product URLs and mutation identifiers: reads must return not found and mutations must fail. Add a MEMBER membership in Studio and confirm mutations are blocked. Create an additional authorized membership to test the workspace selector.
4. With R2 enabled, upload each allowed format; reject invalid signatures and files over 5 MB. Confirm image and product deletion remove objects; verify the second workspace cannot delete another workspace's image ID.
5. Update profile/workspace/password/logo; test Arabic and English at desktop, tablet, and phone widths. Confirm marketplace integrations remain disabled.

## OpenAI / AI Studio

Add `OPENAI_API_KEY` to `.env` on the server and restart development when changing environment settings. No OpenAI SDK dependency or browser key is needed: the server calls the Responses and Images APIs directly. Defaults are `gpt-6.1-terra` for text and `gpt-image-2.6-flare` for images. Model IDs and published standard token-rate estimates are centralized in `src/lib/services/ai/protocol.ts` ([text model](https://developers.openai.com/api/docs/models/gpt-6.1-terra), [image model](https://developers.openai.com/api/docs/models/gpt-image-2.6-flare)). Update the model and pricing together when changing providers/models. Cost figures are estimates, not billing invoices; image cached-input discounts and account-specific discounts are not applied.

Select a product, generation type, Arabic/English, tone, keywords, and additional instructions. Text is structured and validated, saved in generation history, and shown for review. Approving a title or description explicitly replaces that product field. SEO keyword lists remain in history for copying; there is no dedicated SEO product field and no automatic description replacement. Existing product forms link to AI Studio; new products must be saved first.

Image generation creates one 1024×1024 medium-quality WebP. Editing reads an existing authorized image from R2 server-side and submits it to OpenAI. R2 must be configured before image calls are allowed. Images are retained as drafts in the product's `ai-drafts/` storage prefix and added to `ProductImage` only after approval. Source images are not overwritten. Product deletion also cleans up generated draft objects. Establish a retention policy for unused AI drafts if your catalog is large. Image requests can take up to three minutes; configure the hosting request duration to at least 240 seconds, or move long-running image jobs to a durable queue before deploying on a host with shorter request limits.

Every generation and apply endpoint authenticates the session, checks workspace membership and OWNER/ADMIN permissions, validates bounded JSON input, and checks Origin. Limits are 20 generation attempts and 5 image attempts per workspace per 15 minutes. Each client request has a UUID to deduplicate requests; keep `RateLimit` records for in-progress requests and do not purge them until `resetAt`. A provider call is not automatically retried, avoiding accidental duplicate charges. Review generation history before retrying a request interrupted by a network timeout. Prompt and generation data are sent to OpenAI when requested; the Responses API uses `store:false`. The API key and raw provider error messages are never returned to the browser.

The configured key was successfully authenticated, but the live generation test received `credit_balance_exhausted` / `insufficient_quota`. Add API credits or increase the project's billing limit at [OpenAI billing](https://platform.openai.com/settings/organization/billing/overview) before generation can succeed. No live generated content or images are claimed as verified. This is distinct from ChatGPT subscription access. Billing, invalid-key, model-access, moderation, timeouts, and rate-limit failures are shown clearly. Provider protocol tests use mocked network transport only inside tests; production has no fake-provider fallback.

```powershell
# Mocked provider contract tests: no API charges.
npm run test:ai-provider
# Live approval + R2 checks with disposable fixtures, no model calls.
$env:DUO_RUN_AI_WORKFLOW_TESTS='1'
npx tsx --test tests/ai-workflow.test.ts
# Full live generation checks: consumes actual API credits and uses R2.
$env:DUO_RUN_OPENAI_TESTS='1'
npx tsx --test tests/ai-live.test.ts
```

Live tests target the running app at localhost:3000 using the same configured database and bucket; they create temporary accounts/workspaces and remove only their own records and objects. Normal `npm test` skips all live suites.

## Deployment

Deploy as a Node.js Next.js application (Vercel or a Node 24 host), not a static export. Build with `npm ci && npm run build`, run `npm start`, and configure environment variables in the host. For stable NextAuth v4, `AUTH_URL` is mapped to its expected `NEXTAUTH_URL` internally. Set `AUTH_URL` to the canonical HTTPS deployment URL. Use a strong, identical `AUTH_SECRET` on all instances and persistent Neon/R2 services. A trusted reverse proxy must preserve the original Host and Origin. R2 uploads also require your host to accept request bodies up to 6 MB; hosts with lower request limits need a future signed-upload flow.

Review and apply schema changes to a staging Neon branch first; use reviewed migrations (`prisma migrate dev` locally, `prisma migrate deploy` in production) as the schema matures. Never reset a production database. Configure backups, observability, uptime checks, CSP appropriate to your font/CDN domain, retention, and credential encryption before launch. Google Fonts supplies Cairo for interface text and Inter for wordmarks; self-host these fonts when offline operation or strict privacy/CSP is required. Deployment is left to your chosen Node host; this repository was not published to an external service.
