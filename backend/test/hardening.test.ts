import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import type { Express } from "express";

let app: Express;

test.before(async () => {
  // Ensure rate-limit tests don't require a real DB-backed login.
  process.env.AUTH_LOGIN_RATE_LIMIT_MAX = "0";
  process.env.AUTH_REFRESH_RATE_LIMIT_MAX = "0";

  const mod = await import("../src/app");
  app = mod.createApp();
});

test("rate limit: /api/auth/login returns 429 envelope with requestId", async () => {
  const res = await request(app)
    .post("/api/auth/login")
    .set("Origin", "http://localhost:5173")
    .send({ email: "user@example.com", password: "bad" });

  assert.equal(res.status, 429);
  assert.equal(res.headers["content-type"]?.includes("application/json"), true);

  assert.equal(res.body.ok, false);
  assert.equal(res.body.error?.code, "RATE_LIMITED");
  assert.equal(typeof res.body.requestId, "string");
  assert.equal(res.body.requestId.length > 0, true);
});

test("cors: OPTIONS preflight succeeds for allowed origin", async () => {
  const origin = "http://localhost:5173";

  const res = await request(app)
    .options("/api/auth/login")
    .set("Origin", origin)
    .set("Access-Control-Request-Method", "POST")
    .set(
      "Access-Control-Request-Headers",
      "Content-Type, Authorization, X-Request-Id"
    );

  assert.ok(res.status === 204 || res.status === 200);
  assert.equal(res.headers["access-control-allow-origin"], origin);

  const allowMethods = String(res.headers["access-control-allow-methods"] ?? "");
  assert.ok(allowMethods.includes("POST"));

  const allowHeaders = String(res.headers["access-control-allow-headers"] ?? "").toLowerCase();
  assert.ok(allowHeaders.includes("authorization"));
  assert.ok(allowHeaders.includes("content-type"));
  assert.ok(allowHeaders.includes("x-request-id"));

  // Refresh token is in body; credentials should not be enabled.
  assert.equal(res.headers["access-control-allow-credentials"], undefined);
});

test("security headers: baseline helmet headers present", async () => {
  const res = await request(app).get("/api/health");

  assert.equal(res.status, 200);
  assert.equal(res.headers["x-content-type-options"], "nosniff");

  // Safest for APIs.
  assert.equal(res.headers["x-frame-options"], "DENY");
});
