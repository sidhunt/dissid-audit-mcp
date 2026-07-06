// Network-free tests for the dissid-audit MCP server. The only sockets used
// are loopback (a local mock of the Lemon Squeezy endpoint).
import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { utcDay } from "../src/metering.js";
import {
  callTool,
  connectClient,
  makeMockScriptsDir,
  makeStateDir,
  setEnv,
  writeUsageFile,
} from "./helpers.js";

afterEach(() => setEnv({}));

describe("tool registration", () => {
  test("exposes exactly the 3 audit tools", async () => {
    setEnv({});
    const client = await connectClient();
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual(["a11y_audit", "funnel_audit", "llm_visibility_audit"]);
    for (const t of tools) {
      expect(t.inputSchema.properties).toHaveProperty("domain");
    }
    await client.close();
  });
});

describe("free tier metering", () => {
  test("allows N scans, blocks scan N+1, and persists the counter", async () => {
    const stateDir = makeStateDir();
    setEnv({
      DISSID_SCRIPTS_DIR: makeMockScriptsDir(),
      DISSID_AUDIT_STATE_DIR: stateDir,
      DISSID_AUDIT_FREE_LIMIT: "3",
    });
    const client = await connectClient();
    for (let i = 1; i <= 3; i++) {
      const out = await callTool(client, "funnel_audit", "example.com");
      expect(out.isError).toBe(false);
      expect(out.text).toContain("Mock Funnel Audit — example.com");
      expect(out.text).toContain(`scan ${i}/3`);
    }
    const blocked = await callTool(client, "funnel_audit", "example.com");
    expect(blocked.isError).toBe(true);
    expect(blocked.text).toContain("Free tier limit reached (3/3");
    expect(blocked.text).toContain("No scan was run");

    const usage = JSON.parse(readFileSync(join(stateDir, "usage.json"), "utf8"));
    expect(usage).toEqual({ day: utcDay(), count: 3 });
    await client.close();
  });

  test("UTC day rollover resets the counter", async () => {
    const stateDir = makeStateDir();
    writeUsageFile(stateDir, JSON.stringify({ day: "2020-01-01", count: 3 }));
    setEnv({
      DISSID_SCRIPTS_DIR: makeMockScriptsDir(),
      DISSID_AUDIT_STATE_DIR: stateDir,
      DISSID_AUDIT_FREE_LIMIT: "3",
    });
    const client = await connectClient();
    const out = await callTool(client, "funnel_audit", "example.com");
    expect(out.isError).toBe(false);
    expect(out.text).toContain("scan 1/3");
    const usage = JSON.parse(readFileSync(join(stateDir, "usage.json"), "utf8"));
    expect(usage).toEqual({ day: utcDay(), count: 1 });
    await client.close();
  });

  test.each([
    ["not json at all", "{{{ definitely not json"],
    ["wrong schema", JSON.stringify({ scans: "many" })],
    ["negative count", JSON.stringify({ day: "2026-07-05", count: -2 })],
  ])("fails CLOSED on corrupt usage file (%s)", async (_label, contents) => {
    const stateDir = makeStateDir();
    writeUsageFile(stateDir, contents);
    setEnv({
      DISSID_SCRIPTS_DIR: makeMockScriptsDir(),
      DISSID_AUDIT_STATE_DIR: stateDir,
    });
    const client = await connectClient();
    const out = await callTool(client, "funnel_audit", "example.com");
    expect(out.isError).toBe(true);
    expect(out.text).toContain("corrupt");
    expect(out.text).toContain("failing closed");
    expect(out.text).toContain("No scan was run");
    await client.close();
  });
});

describe("license seam", () => {
  test("stub path (LEMONSQUEEZY_VALIDATE unset): any key unlocks, clearly labeled unverified", async () => {
    setEnv({
      DISSID_SCRIPTS_DIR: makeMockScriptsDir(),
      DISSID_AUDIT_STATE_DIR: makeStateDir(),
      DISSID_AUDIT_FREE_LIMIT: "1",
      DISSID_AUDIT_LICENSE_KEY: "any-key-at-all",
    });
    const client = await connectClient();
    // more calls than the free limit — licensed tier is unmetered
    for (let i = 0; i < 3; i++) {
      const out = await callTool(client, "funnel_audit", "example.com");
      expect(out.isError).toBe(false);
      expect(out.text).toContain("STUB validator");
      expect(out.text).toContain("WITHOUT verification");
    }
    await client.close();
  });

  test("validate path: accepts on valid:true, rejects on valid:false, fails closed when API unreachable", async () => {
    let respondValid = true;
    const mock = Bun.serve({
      port: 0,
      fetch: async (req) => {
        const body = await req.text();
        expect(body).toContain("license_key=");
        return Response.json(
          respondValid
            ? { valid: true, license_key: { status: "active" } }
            : { valid: false, error: "license_key not found" },
        );
      },
    });
    const base = {
      DISSID_SCRIPTS_DIR: makeMockScriptsDir(),
      DISSID_AUDIT_STATE_DIR: makeStateDir(),
      DISSID_AUDIT_LICENSE_KEY: "test-key-123",
      LEMONSQUEEZY_VALIDATE: "1",
    };
    try {
      setEnv({ ...base, LEMONSQUEEZY_VALIDATE_URL: `http://127.0.0.1:${mock.port}/v1/licenses/validate` });
      const client = await connectClient();

      const ok = await callTool(client, "funnel_audit", "example.com");
      expect(ok.isError).toBe(false);
      expect(ok.text).toContain("verified via Lemon Squeezy");

      respondValid = false;
      const rejected = await callTool(client, "funnel_audit", "example.com");
      expect(rejected.isError).toBe(true);
      expect(rejected.text).toContain("License key rejected");
      expect(rejected.text).toContain("No scan was run");

      // unreachable endpoint -> fail closed, honest error
      setEnv({ ...base, LEMONSQUEEZY_VALIDATE_URL: "http://127.0.0.1:1/v1/licenses/validate" });
      const unreachable = await callTool(client, "funnel_audit", "example.com");
      expect(unreachable.isError).toBe(true);
      expect(unreachable.text).toContain("could not reach Lemon Squeezy");
      await client.close();
    } finally {
      mock.stop(true);
    }
  });
});

describe("honest failure modes", () => {
  test("missing script (a11y_audit) returns a 'tool not installed' error, never a fabricated report", async () => {
    setEnv({
      DISSID_SCRIPTS_DIR: makeMockScriptsDir(), // only funnel-audit.sh exists here
      DISSID_AUDIT_STATE_DIR: makeStateDir(),
    });
    const client = await connectClient();
    for (const tool of ["a11y_audit", "llm_visibility_audit"]) {
      const out = await callTool(client, tool, "example.com");
      expect(out.isError).toBe(true);
      expect(out.text).toContain("Tool not installed on this host");
      expect(out.text).toContain("No scan was run and no result exists");
    }
    // branch provenance is stated so the user knows where the script lives
    const a11y = await callTool(client, "a11y_audit", "example.com");
    expect(a11y.text).toContain("feat/g11-a11y-audit");
    await client.close();
  });

  test("timeout kills the scan and returns an honest timeout error", async () => {
    setEnv({
      DISSID_SCRIPTS_DIR: makeMockScriptsDir({ sleepSecs: 10 }),
      DISSID_AUDIT_STATE_DIR: makeStateDir(),
      DISSID_AUDIT_TIMEOUT_MS: "500",
    });
    const client = await connectClient();
    const out = await callTool(client, "funnel_audit", "example.com");
    expect(out.isError).toBe(true);
    expect(out.text).toContain("timed out after 1s");
    expect(out.text).toContain("NOT a finding");
    await client.close();
  }, 15_000);

  test("invalid domain is refused without running a scan", async () => {
    setEnv({
      DISSID_SCRIPTS_DIR: makeMockScriptsDir(),
      DISSID_AUDIT_STATE_DIR: makeStateDir(),
    });
    const client = await connectClient();
    const out = await callTool(client, "funnel_audit", "not a domain; rm -rf /");
    expect(out.isError).toBe(true);
    expect(out.text).toContain("Invalid domain");
    await client.close();
  });
});
