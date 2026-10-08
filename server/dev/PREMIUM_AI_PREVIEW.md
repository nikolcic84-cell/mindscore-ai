# Premium AI developer preview

This is an opt-in developer tool. From the existing Premium/paywall page it uses the current saved 12 sleep answers; the server recalculates the deterministic profile and dimensions before invoking the existing Premium generator, schema, safety validator, and fallback. Preview does not create payments, send emails, or generate PDFs. It returns only customer-facing fields and never returns prompts, scores, thresholds, credentials, or request headers.

## Local run

1. Set `ENABLE_PREMIUM_AI_PREVIEW=true` in the local server environment.
2. Provide `OPENAI_API_KEY` locally if you want a real response. Without it, the endpoint returns a safe unavailable error; it never displays fallback or mock report content as AI output.
3. Start the backend from `server` and the frontend, complete the sleep assessment, then open the paywall.
4. Click **STAGING: TESTIRAJ PREMIUM AI** below the normal purchase CTA. The preview uses the current assessment answers and shows the validated report inline without redirecting to checkout.

## Isolated Render staging

Enable `ENABLE_PREMIUM_AI_PREVIEW=true` only on the isolated staging service. After the preview code has been intentionally deployed to that staging branch/service, open the staging frontend, complete the sleep assessment, and open the paywall. Click **STAGING: TESTIRAJ PREMIUM AI** below the purchase CTA. The page sends the current raw answers only; the server recalculates the deterministic result. The API is limited to one request per IP per minute and three requests per server process, and responses are not cached. Disable the flag after review. Do not enable it on production.

Each click attempts a real OpenAI request. If generation or validation fails, the existing validated deterministic fallback is used. The result is shown inline with a `STAGING PREVIEW` label, and logging includes only the deterministic profile and safe generation/schema/fallback statuses. The fixed isolated fixture remains available through `server/dev/test-sleep-premium-ai.js` for backend-only testing.
