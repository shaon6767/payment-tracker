# Payment Tracker

Payment Tracker is a React client and Express/MongoDB API for managing invoices and recording full or partial payments through SSLCommerz.

## Start with Docker

With Docker Compose installed, run from the repository root:

```sh
docker compose up --build
```

Open the client at `http://localhost:5173` and the API health endpoint at `http://localhost:5000/`. Compose starts MongoDB, waits for it to become healthy, then starts the API and client. Invoice data is stored in the `mongo-data` volume.

Compose uses local-development defaults. Set production-grade values in a root `.env` file before using the stack outside local development. Payment gateway credentials are optional for invoice management, but checkout remains unavailable until valid SSLCommerz credentials and a public `SSL_BASE_URL` are configured.

## Run the server outside Docker

Copy `server/.env.example` to `server/.env`, set a unique `JWT_SECRET` of at least 32 characters and valid gateway credentials if needed, and set `MONGO_URI` to a reachable MongoDB instance. Then run:

```sh
cd server
npm ci
npm run dev
```

In another terminal, install the client dependencies and run `npm run dev` from `client`. The default client API URL is `http://localhost:5000/api`; override it with `VITE_API_URL` when needed.

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

GitHub Actions runs these checks and builds the backend Docker image on pushes and pull requests.

## Credential hygiene

Never commit `.env` files. Credentials in the repository's prior Git history must be rotated; removing the current `.env` from tracking does not erase old commits. Coordinate any Git-history rewrite with other repository users.
