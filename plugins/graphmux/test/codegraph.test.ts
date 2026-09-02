import { test } from "node:test";
import assert from "node:assert/strict";
import {
  platformKey,
  assetName,
  assetUrl,
  sha256Hex,
  verifySha,
  binPath,
  CODEGRAPH_VERSION,
  CODEGRAPH_SHA256,
  TELEMETRY_OFF,
} from "../src/core/codegraph.js";

test("platformKey maps known platform/arch and rejects unknown", () => {
  assert.equal(platformKey("linux", "x64"), "linux-x64");
  assert.equal(platformKey("darwin", "arm64"), "darwin-arm64");
  assert.throws(() => platformKey("linux", "mips"), /unsupported platform 'linux-mips'/);
  assert.throws(() => platformKey("sunos", "x64"), /unsupported platform/);
});

test("every supported platform has a 64-hex SHA256 pin", () => {
  for (const [key, sha] of Object.entries(CODEGRAPH_SHA256)) {
    assert.match(sha, /^[0-9a-f]{64}$/, `${key} sha must be 64 hex chars`);
  }
});

test("assetName picks .zip for windows, .tar.gz otherwise", () => {
  assert.equal(assetName("linux-x64"), "codegraph-linux-x64.tar.gz");
  assert.equal(assetName("darwin-arm64"), "codegraph-darwin-arm64.tar.gz");
  assert.equal(assetName("win32-x64"), "codegraph-win32-x64.zip");
});

test("assetUrl builds pinned upstream + mirror URLs (distinct tag shapes, no double version)", () => {
  assert.equal(
    assetUrl("linux-x64", "upstream"),
    `https://github.com/colbymchenry/codegraph/releases/download/v${CODEGRAPH_VERSION}/codegraph-linux-x64.tar.gz`,
  );
  assert.equal(
    assetUrl("darwin-arm64", "mirror"),
    `https://github.com/brainmuxhq/brainmux-plugins/releases/download/codegraph-v${CODEGRAPH_VERSION}/codegraph-darwin-arm64.tar.gz`,
  );
  assert.ok(!assetUrl("linux-x64", "mirror").includes("/v" + CODEGRAPH_VERSION + "/codegraph-linux"), "no double-version path");
});

test("binPath points at codegraph(.exe) inside the extracted per-platform dir", () => {
  assert.equal(binPath("/cache", "linux-x64"), "/cache/codegraph-linux-x64/bin/codegraph");
  assert.equal(binPath("/cache", "win32-x64"), "/cache/codegraph-win32-x64/bin/codegraph.exe");
});

test("sha256Hex + verifySha: known vector 'abc'", () => {
  const abc = Buffer.from("abc");
  assert.equal(sha256Hex(abc), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.equal(verifySha(abc, "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"), true);
  assert.equal(verifySha(abc, "0".repeat(64)), false);
  assert.equal(verifySha(abc, "deadbeef"), false); // length mismatch → false, no throw
});

test("telemetry is off by default (all three toggles set)", () => {
  assert.equal(TELEMETRY_OFF.DO_NOT_TRACK, "1");
  assert.equal(TELEMETRY_OFF.CODEGRAPH_TELEMETRY, "0");
  assert.equal(TELEMETRY_OFF.CODEGRAPH_NO_UPDATE_CHECK, "1");
});
