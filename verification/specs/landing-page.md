# Verification spec: Landing page that converts

Challenge: "Build a marketing landing page with hero, features, CTA, pricing section" (SPE-55 #4).

## What "working" means

A submission passes when **all required checks below pass** against the live URL. HTTP-level checks run without a browser first, then Playwright renders the page and checks the visible content.

## The contract (discovery rules)

- The root URL must serve **HTML over HTTP 200**.
- **Hero**: a visible, non-empty `<h1>`.
- **Features**: a heading (h1-h4 or role=heading) mentioning "feature(s)", OR at least 3 feature-like headings (h2/h3 blocks).
- **CTA**: a visible button or link with action-oriented copy (e.g. "Get started", "Sign up", "Try it", "Join now", "Start free", "Book a demo", "Contact us").
- **Pricing**: rendered copy mentioning pricing / price / plans.
- **Mobile-readiness**: a `<meta name="viewport">` tag.

## Required checks

| id | passes when |
|---|---|
| `land-http-ok-html` | HTTP 200 with an HTML body |
| `land-title` | Non-empty `<title>` element |
| `land-viewport-meta` | Viewport meta tag present |
| `land-hero-h1` | Visible non-empty `<h1>` (hero) |
| `land-features` | Features section identified |
| `land-cta` | Visible CTA control identified |
| `land-pricing` | Pricing content present in rendered page |
| `land-no-console-errors` | Zero `console.error` / uncaught page errors while rendering |

## Bonus checks (do not affect the verdict)

| id | passes when |
|---|---|
| `land-mobile-no-overflow` | At a 375px viewport the page has no horizontal overflow |
