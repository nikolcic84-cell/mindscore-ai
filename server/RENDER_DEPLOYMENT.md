# MindScore AI Backend Deployment on Render

This document covers backend deployment only.

## Backend Location and Entrypoint

- Backend folder: server
- Entrypoint: server.js
- Runtime: Node.js (ESM)

## Required API Routes

The following routes are available and must remain enabled:

- POST /api/create-checkout-session
- POST /api/stripe/webhook
- GET /api/payment-session/:sessionId/verify
- GET /api/premium-report/download
- GET /health

## Required Environment Variables

Do not commit real values. Configure these in Render:

- OPENAI_API_KEY
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
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
- BACKEND_BASE_URL should be set to your deployed Render URL, for example:
  https://mindscore-ai-backend.onrender.com
- FRONTEND_BASE_URL must be set to your deployed frontend URL. For this production deployment:
  https://mindscore-ai.onrender.com
- DATA_DIR should point to a persistent disk mount on Render so payment state and generated PDFs survive restarts, for example:
  /var/data/mindscore
- If DATA_DIR is not set, the backend falls back to server/data inside the app container, which is instance-local and can be lost across deploys or restarts.
- Stripe webhook endpoint to register in Stripe Dashboard:
  https://YOUR_RENDER_BACKEND_URL/api/stripe/webhook
