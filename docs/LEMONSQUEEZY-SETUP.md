# Lemon Squeezy setup — DISSID products (Sid: ~5 min of clicks)

Status 2026-07-06: **DONE — store `dissid` (CAD) live, all 3 products PUBLISHED, wired into
dissid.ai and deployed.** Buy buttons render live on https://dissid.ai. Checkout URLs recorded
in `~/.claude/salesman/ls-checkout-urls.md`. Live checkout URLs:
- Website Triple-Audit Bundle — CA$99 — https://dissid.lemonsqueezy.com/checkout/buy/00a6faa1-ff8a-4e75-83cb-d3678bceb189
- DISSID Audit MCP — Pro — CA$19/mo — https://dissid.lemonsqueezy.com/checkout/buy/8eef0432-1923-4a52-90bb-91164d3b1b23
- Fix-Sprint Deposit — CA$500 — https://dissid.lemonsqueezy.com/checkout/buy/2b1b0cca-118c-4ab8-840d-f34a7fd722ef

⚠️ OPEN: (1) LS API key is still a placeholder — the MCP license-validate path needs the REAL
key before Pro subscriptions can be validated. (2) Tax category defaulted to "SaaS - personal use"
on all 3 (accountant's call — likely wrong for a B2B service/report). The MCP license-validate
path is wired + tested; the site renders a buy button per product from its checkout URL in the
site env (Vite build-time).

## 1. Create store (once)

app.lemonsqueezy.com → Create store
- Name: **DISSID** · URL slug: `dissid` · Currency: **USD** (LS is merchant-of-record;
  handles global tax/VAT — the reason we picked LS over raw Stripe)

## 2. Create the 3 products

### Product 1 — Website Triple-Audit Bundle

- **Name:** Website Triple-Audit Bundle
- **Pricing:** Single payment · **$99**
- **Delivery: digital download** (buyer gets the 3 PDFs as files; JARVIS runs the scans
  and uploads within 24h of order)
- **Description (paste):**

> Three automated scans of one domain: funnel gaps (analytics, booking, contact
> paths), WCAG accessibility findings, and AI-readability — can ChatGPT or Claude
> actually read your site? Deterministic checks that report an honest UNKNOWN when
> something can't be verified. You get three plain-English PDF reports, delivered
> as a digital download within 24 hours. Findings are automated checks, not legal
> or compliance advice.

### Product 2 — DISSID Audit MCP — Pro

- **Name:** DISSID Audit MCP — Pro
- **Pricing:** Subscription · **$19/month**
- **License keys: ENABLE** (this is the part the MCP validates) · Activation limit: 3
- **Description (paste):**

> The same three audits as MCP tools your AI agent can call: funnel gaps
> (analytics, booking, contact paths), WCAG accessibility findings, and
> AI-assistant readability (can ChatGPT/Claude actually read your site?).
> Deterministic scans, honest UNKNOWNs, plain-English reports. Free tier: 3
> scans/day. Pro: unlimited scans. Runs locally over MCP — your domains never
> touch our servers. License key arrives by email.

### Product 3 — Fix-Sprint Deposit

- **Name:** Fix-Sprint Deposit
- **Pricing:** Single payment · **$500**
- **Delivery: plain** (no files, no license keys — the order email is the receipt;
  we confirm scope and start date by email within 24 hours)
- **Description (paste):**

> Reserves a fixed-price sprint to fix what an audit found. Total runs
> $500–1,500 per scope, set in writing before work starts — your $500 deposit
> is credited to the total. We confirm scope and start date by email within
> 24 hours.

## 3. Hand the key path to buyers (MCP Pro)

Buyer gets a license key by email → sets:
```
DISSID_AUDIT_LICENSE_KEY=<key>
LEMONSQUEEZY_VALIDATE=1
```
MCP validates against LS `/v1/licenses/validate` (fail-closed). Nothing else to ship.

## 4. Wire the site (after products exist)

Each product page → Share → copy the checkout URL into the dissid-consultancy deploy
env (public URLs, not secrets — see that repo's `.env.example`):

```
VITE_LS_CHECKOUT_URL_AUDIT_BUNDLE=<bundle checkout URL>
VITE_LS_CHECKOUT_URL_MCP_PRO=<pro checkout URL>
VITE_LS_CHECKOUT_URL_SPRINT_DEPOSIT=<deposit checkout URL>
```

Then merge MR !13 and run `scripts/deploy.sh`. Buttons appear only for configured
URLs; lemon.js loads only when at least one is set.

## 5. After products exist (JARVIS does)

- Update README pricing section with the real checkout URL
- Stage listing submissions: Smithery, Glama, PulseMCP, mcp.so (blurbs below)

## Directory listing blurb (draft, de-slopped)

**Short:** Website audit tools over MCP: funnel scan, WCAG accessibility, and
AI-readability checks. Deterministic, runs locally, honest about what it can't see.
Free 3 scans/day.

**One-liner:** Let your agent audit any website: funnel, accessibility, AI-visibility.
