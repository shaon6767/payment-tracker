import assert from "node:assert/strict";
import test from "node:test";
import { isSslCommerzLive } from "../utils/sslcommerzConfig.js";

test("sandbox settings select the SSLCommerz sandbox endpoint", () => {
  assert.equal(isSslCommerzLive("true"), false);
  assert.equal(isSslCommerzLive(undefined), false);
});

test("only an explicit false sandbox setting selects the live endpoint", () => {
  assert.equal(isSslCommerzLive("false"), true);
});
