import assert from "node:assert/strict";
import test from "node:test";
import { resolveApiBaseUrl } from "./apiBaseUrl.js";

test("adds the API prefix to a configured service origin", () => {
  assert.equal(
    resolveApiBaseUrl("https://payment-tracker.onrender.com"),
    "https://payment-tracker.onrender.com/api",
  );
});

test("preserves an API prefix and removes trailing slashes", () => {
  assert.equal(
    resolveApiBaseUrl("https://payment-tracker.onrender.com/api/"),
    "https://payment-tracker.onrender.com/api",
  );
});

test("uses the local API URL when no URL is configured", () => {
  assert.equal(resolveApiBaseUrl(), "http://localhost:5000/api");
});
