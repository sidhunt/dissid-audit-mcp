// Shared test helpers: fixture scripts dir, isolated state dirs, and an
// in-memory MCP client wired to a fresh server instance.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "../src/server.js";

/** Create a temp scripts dir containing a fake funnel-audit.sh that writes a
 *  deterministic report (no network). Optionally make it sleep first. */
export function makeMockScriptsDir(opts: { sleepSecs?: number } = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "mock-scripts-"));
  const sleep = opts.sleepSecs ? `sleep ${opts.sleepSecs}\n` : "";
  const script = `#!/usr/bin/env bash
set -u
domain=""
out_dir="."
while (($#)); do
  case "$1" in
    --out-dir) out_dir="$2"; shift ;;
    *) domain="$1" ;;
  esac
  shift
done
${sleep}mkdir -p "$out_dir"
cat > "$out_dir/\${domain}-audit.md" <<EOF
# Mock Funnel Audit — \${domain}
analytics: UNKNOWN (mock fixture — not a real scan)
EOF
echo "[out] $out_dir/\${domain}-audit.md" >&2
`;
  const p = join(dir, "funnel-audit.sh");
  writeFileSync(p, script, "utf8");
  chmodSync(p, 0o755);
  return dir;
}

export function makeStateDir(): string {
  return mkdtempSync(join(tmpdir(), "audit-state-"));
}

const ENV_KEYS = [
  "DISSID_SCRIPTS_DIR",
  "DISSID_AUDIT_STATE_DIR",
  "DISSID_AUDIT_FREE_LIMIT",
  "DISSID_AUDIT_TIMEOUT_MS",
  "DISSID_AUDIT_LICENSE_KEY",
  "LEMONSQUEEZY_VALIDATE",
  "LEMONSQUEEZY_VALIDATE_URL",
] as const;

export function setEnv(overrides: Partial<Record<(typeof ENV_KEYS)[number], string>>): void {
  for (const k of ENV_KEYS) delete process.env[k];
  for (const [k, v] of Object.entries(overrides)) process.env[k] = v;
}

export async function connectClient(): Promise<Client> {
  const server = createServer();
  const client = new Client({ name: "test-client", version: "0.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return client;
}

export function writeUsageFile(stateDir: string, contents: string): void {
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(join(stateDir, "usage.json"), contents, "utf8");
}

export interface ToolCallOut {
  text: string;
  isError: boolean;
}

export async function callTool(client: Client, name: string, domain: string): Promise<ToolCallOut> {
  const res = await client.callTool({ name, arguments: { domain } });
  const content = res.content as Array<{ type: string; text?: string }>;
  return {
    text: content.map((c) => c.text ?? "").join("\n"),
    isError: res.isError === true,
  };
}
