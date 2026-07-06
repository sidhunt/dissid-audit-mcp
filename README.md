# dissid-audit-mcp

DISSID's deterministic audit engine, packaged as an **MCP server** (G3). Three tools wrap the
existing audit scripts — the server shells out to them and returns their markdown reports
verbatim. It never reimplements a scan and never fabricates a result.

| Tool | Wraps | Status on a fresh host |
|---|---|---|
| `funnel_audit(domain)` | `funnel-audit.sh` (G5) | shipped with `~/.claude/scripts` |
| `a11y_audit(domain)` | `a11y-audit.sh` (G11) | on branch `feat/g11-a11y-audit` of the `~/.claude` repo — tool returns an honest "not installed" error if the script is absent |
| `llm_visibility_audit(domain)` | `llm-visibility-audit.sh` (G4) | on branch `feat/g4-llm-visibility-audit` — same honest-error behavior |

## Honesty floors (inherited from the scripts, not weakened here)

- Reports state only what the scan proved; `UNKNOWN != ABSENT` (JS-rendered pages get UNKNOWN).
- Missing script → "tool not installed" error, never a fake report.
- Scan timeout (default 120s) → explicit timeout error; a timeout is not a finding.
- Corrupt usage counter → **fail closed** (treated as limit reached, user told why).
- The server never phones home except the optional Lemon Squeezy license validation below.

## Install

Runtime: [bun](https://bun.sh) (≥1.1). No npm/npx anywhere.

```bash
git clone <this-repo> ~/dev/dissid-audit-mcp
cd ~/dev/dissid-audit-mcp
bun install
bun test          # 11 tests, network-free
```

## Wire into Claude Code

```bash
claude mcp add dissid-audit -- bun run ~/dev/dissid-audit-mcp/src/index.ts
```

Or in `.mcp.json` / `~/.claude.json`:

```json
{
  "mcpServers": {
    "dissid-audit": {
      "command": "bun",
      "args": ["run", "/Users/<you>/dev/dissid-audit-mcp/src/index.ts"]
    }
  }
}
```

## Configuration (env)

| Var | Default | Meaning |
|---|---|---|
| `DISSID_SCRIPTS_DIR` | `~/.claude/scripts` | where the audit scripts live (test seam) |
| `DISSID_AUDIT_STATE_DIR` | `~/.dissid-audit-mcp` | free-tier counter location (`usage.json`) |
| `DISSID_AUDIT_FREE_LIMIT` | `3` | free scans per UTC day |
| `DISSID_AUDIT_TIMEOUT_MS` | `120000` | per-scan hard timeout |
| `DISSID_AUDIT_LICENSE_KEY` | — | Lemon Squeezy license key → unmetered |
| `LEMONSQUEEZY_VALIDATE` | unset | `1` = verify the key against `https://api.lemonsqueezy.com/v1/licenses/validate` (public endpoint, no API auth). Unset = **accept-any-key stub**, clearly labeled unverified in every response |
| `LEMONSQUEEZY_VALIDATE_URL` | LS public endpoint | override exists only so tests run network-free |

## Metering model

- **Free tier:** 3 scans per UTC day, persisted in `usage.json` (`{day, count}`, atomic write,
  UTC rollover). Corrupt file = fail closed.
- **Licensed:** set `DISSID_AUDIT_LICENSE_KEY`. With `LEMONSQUEEZY_VALIDATE=1` the key is
  validated per scan against Lemon Squeezy (invalid/unreachable → fail closed, no scan).
  Without it, the stub accepts any key and says so in the output.

## Pricing plan (sketch)

- **Free:** 3 scans/day — enough to try every tool on your own domain.
- **Pro: $19/mo, unlimited scans** — license key sold via **Lemon Squeezy**
  (merchant-of-record handles global sales tax/VAT).

> ⚠️ **Blocker before any sale:** the DISSID Lemon Squeezy store currently has
> **0 products**. Sid must create the store product (subscription with license keys enabled)
> before a key can ever validate. Until then, paying customers cannot exist; the
> `LEMONSQUEEZY_VALIDATE=1` path is wired and tested against a mock.

## Development

```bash
bun test                 # full suite (registration, metering, license seam, honest errors)
bunx tsc --noEmit        # typecheck
bun run src/index.ts     # serve on stdio
```
