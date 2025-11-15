# M&O Store — Server

This is the Express + MongoDB backend for the M&O Store demo application. It provides APIs for authentication, products, orders, promotions (coupon codes), users, inventory and basic admin operations. The API is mounted under `/api` in `server.js`.

Contents
- `server.js` — app entrypoint and router mounting
- `routes/` — Express routers for resources (orders, products, promotions, users, admins, etc.)
- `controllers/` — request handlers and business logic
- `models/` — Mongoose schemas
- `middleware/` — auth and other helpers

Quick start

1. Copy environment variables into a `.env` file in the `server/` folder. Example:

```
PORT=4000
MONGO_URI=mongodb://localhost:27017/mo-store
JWT_SECRET=your_jwt_secret_here
CLIENT_ORIGIN=http://localhost:3000
NODE_ENV=development
```

2. Install dependencies and start the server (from `server/`):

```bash
cd "c:/Users/moham/Desktop/MO Store/server"
npm install
npm run dev    # or `node server.js` depending on scripts
```

3. The server will run on `http://localhost:<PORT>` (default 3000). API root is `http://localhost:<PORT>/api`.

Security and Auth
- Cookie-based auth: the server uses an httpOnly cookie named `token` for JWTs and a rotating refresh token cookie flow for silently renewing sessions.

Environment variables
- `PORT` — port to run the server on (default 3000)
- `MONGO_URI` — MongoDB connection string
- `JWT_SECRET` — secret used to sign JWT tokens
- `CLIENT_ORIGIN` — comma-separated list of allowed client origins for CORS
- `NODE_ENV` — `development` or `production`

Key endpoints (API root: `/api`)
- `POST /api/auth/login` — login (returns token cookie)
- `POST /api/auth/refresh` — rotate refresh token & receive a new JWT (cookie-aware)

- `GET /api/products` — list products
- `GET /api/products/:id` — product details

- `GET /api/promotions` — list promotions (admin)
- `POST /api/promotions` — create promotion (admin)
- `PUT /api/promotions/:id` — update promotion (admin)
- `DELETE /api/promotions/:id` — delete promotion (admin)
- `GET /api/promotions/validate?code=CODE&total=123.45` — validate a coupon code and compute discount for a given total (public)

- `GET /api/orders` — list orders (supports filters: `status`, `page`, `limit`, `since`, `q`, `user`, `coupon`)
- `GET /api/orders/summary` — quick counts and recent lists for dashboard
- `GET /api/orders/:id` — fetch order (users only fetch their own order; admins can fetch any order)
- `POST /api/orders` — create order (accepts `couponCode` to apply promotions)
- `PUT /api/orders/:id` — update order (admin)
- `POST /api/orders/:id/remove-coupon` — admin endpoint to remove a coupon from an order

- `GET /api/users` — list users (admin)
- `GET /api/users/export` — export users CSV with total spend (admin)

Models & behavior notes
- Orders store coupon metadata: `coupon` (code/type/value), `originalTotalPrice`, and `discountAmount`. When creating an order the server re-validates any provided `couponCode` using the promotions collection.
- Promotions have fields: `code`, `type` (`percent` or `amount`), `value`, `active`, `startsAt`, `endsAt`, `usageLimit`, `usedCount`.

Note: CSRF double-submit was removed; the API no longer issues a non-httpOnly `csrf` cookie nor requires the `X-CSRF-Token` header. Clients should rely on cookie-based authentication and standard CORS protections.

Examples

Validate a promotion (client or curl):

```bash
curl 'http://localhost:3000/api/promotions/validate?code=BLACKFRIDAY&total=150' \
	-H 'Accept: application/json'
```

Create an order with coupon from the client (example JSON payload):

```json
{
	"products": [{ "product": "<productId>", "quantity": 2 }],
	"couponCode": "BLACKFRIDAY",
	"totalPrice": 150
}
```

Troubleshooting
- CORS errors: set `CLIENT_ORIGIN` in `.env` to include the client origin (e.g., `http://localhost:3000`). The server uses credentials-enabled CORS and will reject unknown origins.
- CORS errors: set `CLIENT_ORIGIN` in `.env` to include the client origin (e.g., `http://localhost:3000`). The server uses credentials-enabled CORS and will reject unknown origins.

Development tips
- The admin app and client app expect the API under `/api` and rely on cookies for authentication. During local development run the admin/client dev servers (typically `localhost:3000`) and set `CLIENT_ORIGIN` accordingly.
- For the admin UI to refresh order data and remove coupons properly the `GET /api/orders/:id` route allows admin roles to fetch any order.

If you want me to add examples for testing endpoints with `curl` including cookie handling, or to generate a Postman collection for common flows (auth, create order, apply coupon), tell me which flows you want and I'll add them.

---
Last updated: 2025-11-15
