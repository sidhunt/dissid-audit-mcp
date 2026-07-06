// config.ts — env seam. Read at CALL time (never cached at module load) so tests
// can point DISSID_SCRIPTS_DIR etc. at fixtures per-test.
import { homedir } from "node:os";
import { join } from "node:path";

export interface Config {
  /** Directory holding the deterministic audit scripts we shell out to. */
  scriptsDir: string;
  /** State dir for the free-tier usage counter (usage.json). */
  stateDir: string;
  /** Free-tier scans per UTC day without a license key. */
  freeLimit: number;
  /** Per-scan hard timeout (ms). */
  timeoutMs: number;
  /** Lemon Squeezy license key, if the user set one. */
  licenseKey: string | undefined;
  /** When "1", validate the key against the Lemon Squeezy public API. */
  lemonSqueezyValidate: boolean;
  /** Validation endpoint (overridable ONLY so tests can run network-free). */
  lemonSqueezyValidateUrl: string;
}

export function getConfig(): Config {
  const env = process.env;
  return {
    scriptsDir: env.DISSID_SCRIPTS_DIR || join(homedir(), ".claude", "scripts"),
    stateDir: env.DISSID_AUDIT_STATE_DIR || join(homedir(), ".dissid-audit-mcp"),
    freeLimit: parsePositiveInt(env.DISSID_AUDIT_FREE_LIMIT, 3),
    timeoutMs: parsePositiveInt(env.DISSID_AUDIT_TIMEOUT_MS, 120_000),
    licenseKey: env.DISSID_AUDIT_LICENSE_KEY || undefined,
    lemonSqueezyValidate: env.LEMONSQUEEZY_VALIDATE === "1",
    lemonSqueezyValidateUrl:
      env.LEMONSQUEEZY_VALIDATE_URL ||
      "https://api.lemonsqueezy.com/v1/licenses/validate",
  };
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}
