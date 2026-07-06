# Lemon Squeezy setup — DISSID Audit MCP (Sid: ~5 min of clicks)

Status 2026-07-05: LS account exists, API key set, **0 stores / 0 products**. The MCP
license-validate path is wired + tested; it can't earn a dollar until this exists.

## 1. Create store (once)

app.lemonsqueezy.com → Create store
- Name: **DISSID** · URL slug: `dissid` · Currency: **USD** (LS is merchant-of-record;
  handles global tax/VAT — the reason we picked LS over raw Stripe)

## 2. Create product

Products → New product
- **Name:** DISSID Audit MCP — Pro
- **Pricing:** Subscription · **$19/month**
- **License keys: ENABLE** (this is the part the MCP validates) · Activation limit: 3
- **Description (paste):**

> Three website audits as MCP tools your AI agent can call: funnel gaps
> (analytics, booking, contact paths), WCAG accessibility findings, and
> AI-assistant readability (can ChatGPT/Claude actually read your site?).
> Deterministic scans, honest UNKNOWNs, plain-English reports. Free tier: 3
> scans/day. Pro: unlimited scans + priority fixes. Runs locally over MCP —
> your domains never touch our servers.

## 3. Hand the key path to buyers

Buyer gets a license key by email → sets:
```
DISSID_AUDIT_LICENSE_KEY=<key>
LEMONSQUEEZY_VALIDATE=1
```
MCP validates against LS `/v1/licenses/validate` (fail-closed). Nothing else to ship.

## 4. After product exists (JARVIS does)

- Update README pricing section with the real checkout URL
- Stage listing submissions: Smithery, Glama, PulseMCP, mcp.so (drafts below)

## Directory listing blurb (draft, de-slopped)

**Short:** Website audit tools over MCP: funnel scan, WCAG accessibility, and
AI-readability checks. Deterministic, runs locally, honest about what it can't see.
Free 3 scans/day.

**One-liner:** Let your agent audit any website: funnel, accessibility, AI-visibility.
