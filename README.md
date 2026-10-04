# Payment Tracker

Payment Tracker is a React client and Express/MongoDB API for managing invoices and recording full or partial payments through SSLCommerz.

## Run locally

Copy `server/.env.example` to `server/.env`, set a unique `JWT_SECRET` of at least 32 characters and `MONGO_URI` to a reachable MongoDB instance, then run:

```sh
cd server
npm ci
npm run dev
```

In another terminal, install the client dependencies and run `npm run dev` from `client`. The default client API URL is `http://localhost:5000/api`; override it with `VITE_API_URL` when needed.

## Deploy to Render

Deploy the API and client as separate native Render services; Docker is not required.

Create a **Web Service** for the API with:

- Root directory: `server`
- Runtime: `Node`
- Build command: `npm ci`
- Start command: `npm start`

Set these environment variables on the API service: `MONGO_URI` (your Atlas connection string), `JWT_SECRET` (a unique random secret of at least 32 characters), `CLIENT_URL` (the deployed client URL), and `SSLCOMMERZ_STORE_ID`, `SSLCOMMERZ_STORE_PASSWD`, `SSLCOMMERZ_IS_SANDBOX`, and `SSL_BASE_URL` when enabling checkout. `SSL_BASE_URL` must be the public API service URL for gateway callbacks.

Create a **Static Site** for the client with:

- Root directory: `client`
- Build command: `npm ci && npm run build`
- Publish directory: `dist`

Set `VITE_API_URL` on the Static Site to `<API service URL>/api`. After both services deploy, set the API's `CLIENT_URL` to the exact Static Site URL and redeploy the API. Configure Atlas Network Access to permit connections from the API host (for example, Render's outbound IPs or your applicable network policy).

Add a Static Site rewrite rule in Render (`/*` to `/index.html`, action **Rewrite**) so client-side routes continue to work after a browser refresh.

For invoice-only use, valid SSLCommerz credentials are not required. Checkout needs working sandbox or production credentials and a public `SSL_BASE_URL`. Keep credentials in Render environment settings, not in source control.

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
npm run lint
npm run build
```

## Credential hygiene

Never commit `.env` files. Credentials in the repository's prior Git history must be rotated; removing the current `.env` from tracking does not erase old commits. Coordinate any Git-history rewrite with other repository users.
