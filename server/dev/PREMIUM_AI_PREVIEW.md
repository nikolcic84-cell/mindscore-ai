# Premium AI developer preview

This is an opt-in developer tool. It uses the existing Premium generator and strict validator with the fixed answer fixture from `test-sleep-premium-ai.js`; it does not read customer records, write reports, create payments, send emails, or generate PDFs. The preview endpoint returns only customer-facing fields and never returns prompts, scores, thresholds, credentials, or request headers.

## Local run

1. Set `ENABLE_PREMIUM_AI_PREVIEW=true` in the local server environment.
2. Provide `OPENAI_API_KEY` locally if you want a real response. Without it, the endpoint returns a safe unavailable error; it never displays fallback or mock report content as AI output.
3. Start the backend from `server` and the frontend is not required: open `http://localhost:3001/__dev/premium-ai-preview`.
4. Use the button once to make one validated OpenAI request. The page holds no token in browser storage and does not log or persist the generated report.

## Isolated Render staging

Enable `ENABLE_PREMIUM_AI_PREVIEW=true` only on the isolated staging service. After the preview code has been intentionally deployed to that staging branch/service, open `https://<staging-backend-host>/__dev/premium-ai-preview` and generate the preview. The page sends no credentials or custom headers. The API uses only the fixed synthetic fixture, is limited to one request per IP per minute and three requests per server process, and is not cached. Disable the flag after review. Do not enable it on production.

Each click makes one real OpenAI request using the fixed staging fixture. The generated content is shown in the page only after the existing strict Premium validation passes. If generation or validation fails, the page shows only a safe error and field/constraint diagnostics.
