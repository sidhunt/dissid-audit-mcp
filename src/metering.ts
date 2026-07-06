// metering.ts — the honest metering seam.
//
// No license key  -> free tier: N scans per UTC day, persisted counter at
//                    <stateDir>/usage.json. Corrupt counter file = FAIL CLOSED
//                    (treated as limit reached; user is told exactly why).
// License key set -> if LEMONSQUEEZY_VALIDATE=1, validate against Lemon Squeezy's
//                    public /v1/licenses/validate endpoint (no auth needed for
//                    validation). Otherwise an ACCEPT-ANY-KEY STUB, clearly
//                    labeled in the output — the key is NOT verified.
// The server never phones home in any other circumstance.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Config } from "./config.js";

export type Entitlement =
  | { ok: true; tier: "free"; used: number; limit: number; note: string }
  | { ok: true; tier: "licensed"; note: string }
  | { ok: false; error: string };

interface Usage {
  day: string; // UTC day, YYYY-MM-DD
  count: number;
}

export function utcDay(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function usagePath(cfg: Config): string {
  return join(cfg.stateDir, "usage.json");
}

/**
 * Read the usage counter. Returns:
 *  - a valid Usage object,
 *  - "missing" when no file exists yet (fresh install),
 *  - "corrupt" when the file exists but cannot be parsed into the expected
 *    schema — callers MUST fail closed on this (CASL-style fail-closed floor:
 *    an unreadable meter is never treated as an empty meter).
 */
export function readUsage(cfg: Config): Usage | "missing" | "corrupt" {
  const p = usagePath(cfg);
  if (!existsSync(p)) return "missing";
  let raw: string;
  try {
    raw = readFileSync(p, "utf8");
  } catch {
    return "corrupt";
  }
  try {
    const parsed = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof parsed.day === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(parsed.day) &&
      Number.isInteger(parsed.count) &&
      parsed.count >= 0
    ) {
      return { day: parsed.day, count: parsed.count };
    }
    return "corrupt";
  } catch {
    return "corrupt";
  }
}

function writeUsage(cfg: Config, usage: Usage): void {
  mkdirSync(cfg.stateDir, { recursive: true });
  const p = usagePath(cfg);
  const tmp = `${p}.tmp`;
  writeFileSync(tmp, JSON.stringify(usage) + "\n", "utf8");
  renameSync(tmp, p); // atomic on the same filesystem
}

/** Lemon Squeezy /v1/licenses/validate response subset we rely on. */
interface LsValidateResponse {
  valid?: boolean;
  error?: string | null;
  license_key?: { status?: string };
}

async function validateLicenseKey(
  cfg: Config,
  fetchImpl: typeof fetch,
): Promise<{ valid: boolean; detail: string }> {
  let res: Response;
  try {
    res = await fetchImpl(cfg.lemonSqueezyValidateUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ license_key: cfg.licenseKey! }).toString(),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    // Fail closed + honest: we could not verify, so we do not grant licensed
    // access — and we say exactly that instead of pretending either way.
    return {
      valid: false,
      detail: `could not reach Lemon Squeezy license API (${e instanceof Error ? e.message : String(e)})`,
    };
  }
  let body: LsValidateResponse;
  try {
    body = (await res.json()) as LsValidateResponse;
  } catch {
    return { valid: false, detail: `Lemon Squeezy API returned non-JSON (HTTP ${res.status})` };
  }
  if (body.valid === true) {
    return { valid: true, detail: `license valid (status: ${body.license_key?.status ?? "unknown"})` };
  }
  return { valid: false, detail: body.error || `license not valid (HTTP ${res.status})` };
}

/**
 * Gate one scan. On the free tier this CONSUMES one unit of today's quota
 * (call it only when a scan is actually about to run).
 */
export async function authorizeScan(
  cfg: Config,
  fetchImpl: typeof fetch = fetch,
): Promise<Entitlement> {
  if (cfg.licenseKey) {
    if (cfg.lemonSqueezyValidate) {
      const r = await validateLicenseKey(cfg, fetchImpl);
      if (r.valid) {
        return { ok: true, tier: "licensed", note: `Licensed tier — ${r.detail} (verified via Lemon Squeezy).` };
      }
      return {
        ok: false,
        error:
          `License key rejected: ${r.detail}. ` +
          `No scan was run. Unset DISSID_AUDIT_LICENSE_KEY to use the free tier (${cfg.freeLimit}/day).`,
      };
    }
    // STUB PATH — clearly marked. Accepts any non-empty key without verification.
    return {
      ok: true,
      tier: "licensed",
      note:
        "Licensed tier — STUB validator accepted the key WITHOUT verification " +
        "(set LEMONSQUEEZY_VALIDATE=1 to verify against Lemon Squeezy).",
    };
  }

  // Free tier: persisted UTC-day counter, fail-closed on corruption.
  const today = utcDay();
  const usage = readUsage(cfg);
  if (usage === "corrupt") {
    return {
      ok: false,
      error:
        `Free-tier usage file is corrupt (${usagePath(cfg)}); failing closed — treating the daily ` +
        `limit as reached. No scan was run. Delete that file to reset the counter (this trusts you ` +
        `not to abuse the free tier), or set a license key.`,
    };
  }
  const current: Usage = usage === "missing" || usage.day !== today ? { day: today, count: 0 } : usage;
  if (current.count >= cfg.freeLimit) {
    return {
      ok: false,
      error:
        `Free tier limit reached (${current.count}/${cfg.freeLimit} scans today, UTC day ${today}). ` +
        `No scan was run. The counter resets at 00:00 UTC. For unlimited scans set ` +
        `DISSID_AUDIT_LICENSE_KEY (license sold via Lemon Squeezy).`,
    };
  }
  const next: Usage = { day: today, count: current.count + 1 };
  writeUsage(cfg, next);
  return {
    ok: true,
    tier: "free",
    used: next.count,
    limit: cfg.freeLimit,
    note: `Free tier — scan ${next.count}/${cfg.freeLimit} for UTC day ${today}.`,
  };
}
