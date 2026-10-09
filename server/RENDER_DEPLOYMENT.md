# MindScore AI Backend Deployment on Render

This document covers backend deployment only.

## Backend Location and Entrypoint

- Backend folder: server
- Entrypoint: server.js
- Runtime: Node.js (ESM)

## Required API Routes

The following routes are available and must remain enabled:

- POST /api/create-checkout-session
- GET /api/sleep-content/free-result
- POST /api/stripe/webhook
- GET /api/payment-session/:sessionId/verify
- GET /api/premium-report/download
- POST /api/premium-report/resend-email
- GET /health

## Required Environment Variables

Do not commit real values. Configure these in Render:

- OPENAI_API_KEY
- STRIPE_MODE (`test` or `live`; defaults to `test` when omitted)
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- STRIPE_OWNER_TEST_TOKEN (temporary LIVE owner checkout authorization; keep private and remove after the controlled test)
- SMTP_HOST
- SMTP_PORT
- SMTP_SECURE
- SMTP_USER
- SMTP_PASS
- SMTP_FROM_EMAIL
- BACKEND_BASE_URL
- FRONTEND_BASE_URL
- DOWNLOAD_TOKEN_SECRET
- DATA_DIR
- PORT (optional on Render, Render sets this automatically)

## Render Web Service Settings

- Root Directory: server
- Build Command: npm install
- Start Command: npm run start

## Notes

- The backend listens on process.env.PORT and host 0.0.0.0.
- `STRIPE_MODE` and the `STRIPE_SECRET_KEY` prefix must match. TEST accepts only `sk_test_...`; LIVE accepts only `sk_live_...`. A mismatch or unsupported key prefix stops backend startup. With no key, the server starts but checkout returns a generic 503 configuration error.
- In LIVE mode, `/api/create-checkout-session` denies normal public checkout unless the request includes the private `x-stripe-owner-test-token` header matching `STRIPE_OWNER_TEST_TOKEN`. Leave this token unset to block all LIVE checkout; this temporary gate exists until the complete Premium product is ready.
- The test API host override (`STRIPE_TEST_API_HOST`/`STRIPE_TEST_API_PORT`) is applied only when `STRIPE_MODE=test` and `NODE_ENV` is not `production`; it cannot redirect LIVE-mode API calls.
- BACKEND_BASE_URL should be set to your deployed Render URL, for example:
  https://mindscore-ai-backend.onrender.com
- FRONTEND_BASE_URL must be set to your deployed frontend URL. For this production deployment:
  https://mindscore-ai.onrender.com
- DATA_DIR should point to a persistent disk mount on Render so payment state and generated PDFs survive restarts, for example:
  /var/data/mindscore
- If DATA_DIR is not set, the backend falls back to server/data inside the app container, which is instance-local and can be lost across deploys or restarts.
- Stripe webhook endpoint to register in Stripe Dashboard:
  https://YOUR_RENDER_BACKEND_URL/api/stripe/webhook
- The `sleep-content-unlock` checkout follows the explicit `STRIPE_MODE` configuration and creates a one-time €9.99 card payment; it does not generate or email a PDF.
