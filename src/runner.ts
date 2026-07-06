// runner.ts — shells out to the EXISTING deterministic audit scripts.
// We never reimplement a scan and never fabricate a result: the returned text
// is the script's own markdown report, or an honest error.
import { execFile } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Config } from "./config.js";

export type RunResult =
  | { ok: true; report: string }
  | { ok: false; error: string };

/** Same normalization the scripts apply: strip scheme + path. */
export function normalizeDomain(input: string): string {
  return input.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").trim();
}

/**
 * Run <scriptsDir>/<scriptName> <domain> --out-dir <tmp> and return the
 * markdown report it wrote. Honest failure modes:
 *  - script missing on this host -> "tool not installed" (never a fake report)
 *  - timeout -> explicit timeout error (a timeout is not a finding)
 *  - non-zero exit -> the script's own stderr, verbatim
 */
export function runAuditScript(
  cfg: Config,
  scriptName: string,
  domainInput: string,
  notInstalledHint: string,
): Promise<RunResult> {
  const scriptPath = join(cfg.scriptsDir, scriptName);
  if (!existsSync(scriptPath)) {
    return Promise.resolve({
      ok: false,
      error:
        `Tool not installed on this host: ${scriptPath} does not exist. ${notInstalledHint} ` +
        `No scan was run and no result exists for this request.`,
    });
  }
  const domain = normalizeDomain(domainInput);
  if (!domain || !/^[a-z0-9.-]+$/i.test(domain)) {
    return Promise.resolve({
      ok: false,
      error: `Invalid domain ${JSON.stringify(domainInput)} — expected e.g. "example.com". No scan was run.`,
    });
  }
  const outDir = mkdtempSync(join(tmpdir(), "dissid-audit-"));

  return new Promise<RunResult>((resolve) => {
    execFile(
      "bash",
      [scriptPath, domain, "--out-dir", outDir],
      { timeout: cfg.timeoutMs, killSignal: "SIGKILL", maxBuffer: 8 * 1024 * 1024 },
      (err, _stdout, stderr) => {
        try {
          if (err && (err as { killed?: boolean }).killed) {
            resolve({
              ok: false,
              error:
                `Scan timed out after ${Math.round(cfg.timeoutMs / 1000)}s and was killed. ` +
                `A timeout is NOT a finding about ${domain} — no result exists for this scan.`,
            });
            return;
          }
          if (err) {
            const tail = (stderr || "").trim().split("\n").slice(-6).join("\n");
            resolve({
              ok: false,
              error: `Scan script exited with an error for ${domain}. Script output (verbatim):\n${tail || "(no stderr)"}`,
            });
            return;
          }
          // Expected report: <outDir>/<domain>-audit.md; fall back to any .md the
          // script wrote into its fresh private out-dir.
          const expected = join(outDir, `${domain}-audit.md`);
          let reportPath: string | undefined = existsSync(expected) ? expected : undefined;
          if (!reportPath) {
            const md = readdirSync(outDir).filter((f) => f.endsWith(".md"));
            if (md.length === 1) reportPath = join(outDir, md[0]!);
          }
          if (!reportPath) {
            resolve({
              ok: false,
              error: `Scan script finished but produced no markdown report in ${outDir} — no result exists.`,
            });
            return;
          }
          resolve({ ok: true, report: readFileSync(reportPath, "utf8") });
        } finally {
          rmSync(outDir, { recursive: true, force: true });
        }
      },
    );
  });
}
