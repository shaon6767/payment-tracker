# Payment Tracker

Payment Tracker is a React client and Express/MongoDB API for managing invoices and recording full or partial payments through SSLCommerz.

## Run locally

Copy `server/.env.example` to `server/.env`, set a unique `JWT_SECRET` of at least 32 characters and `MONGO_URI` to a reachable MongoDB instance, then run:

```sh
cd server
npm ci
npm run dev
```

In another terminal, install the client dependencies and run `npm run dev` from `client`. The default client API URL is `http://localhost:5000/api`; set `VITE_API_URL` to the API service URL when needed. The client adds the `/api` prefix automatically, so either the service origin or an origin already ending in `/api` is accepted.

## Deploy to Render

Deploy the API and client as separate native Render services; Docker is not required.

Create a **Web Service** for the API with:

- Root directory: `server`
- Runtime: `Node`
- Build command: `npm ci`
- Start command: `npm start`

Set these environment variables on the API service: `MONGO_URI` (your Atlas connection string), `JWT_SECRET` (a unique random secret of at least 32 characters), `CLIENT_URL` (the deployed client URL), and `SSLCOMMERZ_STORE_ID`, `SSLCOMMERZ_STORE_PASSWD`, `SSLCOMMERZ_IS_SANDBOX`, and `SSL_BASE_URL` when enabling checkout. Use matching sandbox credentials with `SSLCOMMERZ_IS_SANDBOX=true` (or unset), or live credentials with `SSLCOMMERZ_IS_SANDBOX=false`. `SSL_BASE_URL` must be the public API service URL for gateway callbacks.

Create a **Static Site** for the client with:

- Root directory: `client`
- Build command: `npm ci && npm run build`
- Publish directory: `dist`

Set `VITE_API_URL` on the Static Site to the API service URL (with or without a trailing `/api`); the client adds the `/api` prefix automatically. After both services deploy, set the API's `CLIENT_URL` to the exact Static Site URL and redeploy the API. Configure Atlas Network Access to permit connections from the API host (for example, Render's outbound IPs or your applicable network policy).

Add a Static Site rewrite rule in Render (`/*` to `/index.html`, action **Rewrite**) so client-side routes continue to work after a browser refresh.

For invoice-only use, valid SSLCommerz credentials are not required. Checkout needs working sandbox or production credentials and a public `SSL_BASE_URL`. Keep credentials in Render environment settings, not in source control.

Registration allows 10 requests per 15 minutes per client IP. Login allows 10
failed attempts in that period; successful logins do not count toward the limit.

## Known limitations

If a payment reservation expires and the customer starts a new checkout, a
payment completed through the old gateway session is rejected. Only the
currently active transaction can be settled.

The automated payment and API route tests stub Mongoose model methods. They do
not use a real MongoDB test database, so database-level behavior still needs
verification in a deployment or a separately configured integration-test
environment.

## Existing database migration

Back up the database before upgrading. Existing invoices store major-unit floating-point amounts; the current schema stores integer minor units. Run a dry run from `server` with a `MONGO_URI` pointing to the database:

```sh
npm run migrate:money
```

If the report is clean, apply the idempotent migration:

```sh
npm run migrate:money -- --apply
```

Do not start the updated API against an existing database until migration is complete. The migration script was not run as part of development.

## Checks

```sh
cd server
npm test

cd ../client
node --test src/utils/invoice.test.js
npm run lint
npm run build
```

## Credential hygiene

Never commit `.env` files. Values in the previously committed `.env` must be treated as compromised: rotate the MongoDB database user's password, the JWT signing secret, and the SSLCommerz store ID/password in their respective provider consoles. Update local and hosted environment variables with the replacements; changing `JWT_SECRET` also invalidates existing login tokens.

Removing the current `.env` from tracking does not erase old commits. After rotating credentials, coordinate a Git-history rewrite across all branches and tags with repository collaborators, then force-push the cleaned history. Keep replacement credentials only in local ignored `.env` files or the hosting provider's secret settings.
