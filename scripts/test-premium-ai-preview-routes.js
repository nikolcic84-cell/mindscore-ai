import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test from "node:test";

const startBackend = async (previewEnabled) => {
  const port = 32_000 + Math.floor(Math.random() * 20_000);
  const env = {
    ...process.env,
    NODE_ENV: "production",
    PORT: String(port),
    OPENAI_API_KEY: "sk-preview-route-test-placeholder",
    STRIPE_SECRET_KEY: "sk_test_preview_route_placeholder",
    STRIPE_WEBHOOK_SECRET: "whsec_preview_route_test_placeholder",
    SMTP_HOST: "localhost",
    SMTP_PORT: "2525",
    SMTP_USER: "route-test",
    SMTP_PASS: "route-test-placeholder",
    SMTP_FROM_EMAIL: "route-test@example.invalid",
    FRONTEND_BASE_URL: "http://localhost:5173",
  };
  if (previewEnabled) env.ENABLE_PREMIUM_AI_PREVIEW = "true";
  else delete env.ENABLE_PREMIUM_AI_PREVIEW;

  const child = spawn(process.execPath, ["server/server.js"], { env, stdio: "ignore" });
  const baseUrl = `http://127.0.0.1:${port}`;
  let healthy = false;
  for (let attempt = 0; attempt < 60 && !healthy && child.exitCode === null; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      healthy = response.ok && (await response.json()).status === "ok";
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  if (!healthy) {
    child.kill();
    throw new Error("Backend failed the local health check.");
  }
  return { child, baseUrl };
};

const stopBackend = async (child) => {
  if (child.exitCode !== null) return;
  child.kill();
  await new Promise((resolve) => child.once("exit", resolve));
};

test("preview API exists only when opted in; checkout route remains on its normal path", async () => {
  for (const enabled of [false, true]) {
    const { child, baseUrl } = await startBackend(enabled);
    try {
      const config = await fetch(`${baseUrl}/api/dev/premium-ai-preview/config`);
      if (enabled) {
        assert.equal(config.status, 200);
        assert.deepEqual(await config.json(), { enabled: true });
        const preview = await fetch(`${baseUrl}/api/dev/premium-ai-preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers: [1, 2] }),
        });
        assert.equal(preview.status, 400);
      } else {
        assert.equal(config.status, 404);
        const preview = await fetch(`${baseUrl}/api/dev/premium-ai-preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers: Array(12).fill(3) }),
        });
        assert.equal(preview.status, 404);
      }

      const checkout = await fetch(`${baseUrl}/api/create-checkout-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      assert.equal(checkout.status, 400);
      assert.match((await checkout.json()).error, /Valid customerEmail is required/);
    } finally {
      await stopBackend(child);
    }
  }
});
