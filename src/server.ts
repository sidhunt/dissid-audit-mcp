// server.ts — the dissid-audit MCP server (protocol via the official SDK; we
// hand-roll nothing). Three tools wrap the existing deterministic scripts.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getConfig } from "./config.js";
import { authorizeScan } from "./metering.js";
import { runAuditScript } from "./runner.js";

const DOMAIN_ARG = {
  domain: z
    .string()
    .describe('Domain to audit, e.g. "example.com" (scheme/path are stripped)'),
};

interface ToolSpec {
  name: string;
  description: string;
  script: string;
  notInstalledHint: string;
}

const TOOLS: ToolSpec[] = [
  {
    name: "funnel_audit",
    description:
      "Deterministic marketing-funnel audit of a domain's served homepage HTML " +
      "(analytics, Meta pixel, booking, SMS, reviews, email capture, contact paths, redirect sanity). " +
      "Returns a markdown report. Findings state only what the scan proved; " +
      "UNKNOWN means the static fetch could not tell (e.g. JS-rendered pages) — it is never guessed.",
    script: "funnel-audit.sh",
    notInstalledHint:
      "(funnel-audit.sh should ship with the ~/.claude scripts directory.)",
  },
  {
    name: "a11y_audit",
    description:
      "Deterministic accessibility audit of a domain (DISSID G11 engine). " +
      "Returns a markdown report with FOUND/ABSENT/UNKNOWN findings and evidence. " +
      "May not be installed on every host yet.",
    script: "a11y-audit.sh",
    notInstalledHint:
      "(a11y-audit.sh currently lives on branch feat/g11-a11y-audit of the ~/.claude repo and " +
      "has not been merged to this host's scripts directory.)",
  },
  {
    name: "llm_visibility_audit",
    description:
      "Deterministic LLM-visibility audit of a domain (DISSID G4 engine) — how visible/parseable " +
      "the site is to AI crawlers and answer engines. Returns a markdown report. " +
      "May not be installed on every host yet.",
    script: "llm-visibility-audit.sh",
    notInstalledHint:
      "(llm-visibility-audit.sh currently lives on branch feat/g4-llm-visibility-audit of the " +
      "~/.claude repo and has not been merged to this host's scripts directory.)",
  },
];

function textResult(text: string, isError = false) {
  return { content: [{ type: "text" as const, text }], ...(isError ? { isError: true } : {}) };
}

export function createServer(): McpServer {
  const server = new McpServer({ name: "dissid-audit", version: "0.1.0" });

  for (const tool of TOOLS) {
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: DOMAIN_ARG },
      async ({ domain }) => {
        const cfg = getConfig(); // read env per call — test seam + no stale config

        // 1) Metering gate BEFORE any scan (free counter consumed only if we proceed).
        const ent = await authorizeScan(cfg);
        if (!ent.ok) return textResult(ent.error, true);

        // 2) Shell out to the deterministic script; never fabricate a result.
        const run = await runAuditScript(cfg, tool.script, domain, tool.notInstalledHint);
        if (!run.ok) return textResult(`${run.error}\n\n[${ent.note}]`, true);

        // 3) Return the script's own report verbatim (it carries its own
        //    honesty text: UNKNOWN != ABSENT, static-benchmark labeling, etc.).
        return textResult(`${run.report}\n\n---\n[${ent.note}]`);
      },
    );
  }

  return server;
}
