# Release — dissid-audit-mcp to public MCP directories (Sid: ~10 min, copy-paste)

Passive discovery: Glama + PulseMCP **auto-crawl public GitHub repos**; the MCP
Registry `server.json` is the canonical record every directory reads from. Get the
repo public + registry record right and the listings populate themselves — no reviewer,
no queue. (Sources: modelcontextprotocol/registry docs; tallyfy MCP-registry guide, 2026.)

Blocker today: this repo has **no git remote** (LIBRARIAN P1, ledger row 141). Everything
below is staged and ready; it needs Sid to create the public repo (an autonomous repo-push
was correctly denied — the destination is Sid's call).

## Step 1 — public GitHub repo (2 min)

```bash
cd ~/dev/dissid-audit-mcp
gh repo create sidhunt/dissid-audit-mcp --public --source=. --remote=origin --push
```
(`server.json` already points at `github.com/sidhunt/dissid-audit-mcp` — if you pick a
different name/owner, update `name` + `repository.url` in server.json first.)

## Step 2 — publish npm package (2 min, enables the `npm` package record)

The registry record + several directories resolve installs via npm. Publish (public):
```bash
cd ~/dev/dissid-audit-mcp
npm publish --access public   # ⚠️ npm is banned for our tooling, but PUBLISHING a
                              # package is the one npm-registry action with no bun equiv;
                              # it only uploads, doesn't install. One-time, your call.
```
If you'd rather not touch npm: skip this and use the source/`bunx` path — set server.json
`packages` to a `mcpb`/source entry instead; Glama/PulseMCP still crawl the repo. (Flag me
and I'll swap the record.)

## Step 3 — MCP Registry record (3 min, the canonical source)

```bash
bunx @modelcontextprotocol/publisher login github   # proves you own the io.github.sidhunt name
bunx @modelcontextprotocol/publisher publish        # reads server.json in cwd
```

## Step 4 — Smithery (1 min) + claim the auto-crawled listings

```bash
bunx @smithery/cli publish https://github.com/sidhunt/dissid-audit-mcp -n sidhunt/dissid-audit-mcp
```
Then within a day Glama + PulseMCP will have auto-crawled the public repo — visit each,
**Claim** the listing (GitHub OAuth) to control the description + move out of the anonymous pile:
- glama.ai/mcp/servers → search "dissid" → Claim
- pulsemcp.com → search "dissid" → Claim

## Listing copy (paste into claim descriptions — de-slopped, honest)

**Name:** DISSID Audit MCP
**Short:** Website audit tools over MCP — funnel-gap scan, WCAG accessibility, and
AI-assistant readability. Deterministic, runs locally, honest about what it can't verify.
Free tier: 3 scans/day.
**Tools:** `funnel_audit`, `a11y_audit`, `llm_visibility_audit`.
**Pro ($19/mo, Lemon Squeezy license key):** unlimited scans. See LEMONSQUEEZY-SETUP.md.

## Why this is the highest-leverage passive rail

No outreach, no replies, no CASL — buyers with an AI agent find it by searching a directory.
It's the one revenue path that earns while you sleep, once the repo is public + the $19/mo
LS product exists. Build order: repo public (this doc) → LS product (LEMONSQUEEZY-SETUP.md) →
listings claimed → passive.
