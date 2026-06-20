# AllonaHub Homepage Architecture

## Canonical Homepage

The current homepage source of truth is:

- `/index.html`
- `docs/architecture/allonahub-superapp-homepage-canonical.html`
- `docs/architecture/allona-shop-homepage-canonical.html` remains as a compatibility copy for the earlier architecture path.

The canonical homepage was provided as a single-file HTML document and must remain unchanged unless the user explicitly asks to edit it. New system work should adapt around that homepage rather than rewriting the provided code.

## Current Direction

AllonaHub is the public super-app ecosystem homepage. The homepage presents:

- AllonaHub brand identity
- Time-aware hero, location display, and ecosystem greeting
- Live stats, module grid, and service discovery
- Premium membership tiers
- Partner ecosystem call to action
- Company, support, and legal footer links

## File Organization

- `/index.html`: exact provided AllonaHub super-app homepage.
- `/css/allonahub-home.css`: extracted homepage styles.
- `/js/allonahub-home.js`: extracted homepage behavior, search, clock, location, and stat scripts.
- `docs/architecture/allonahub-superapp-homepage-canonical.html`: canonical copy of the current modular homepage HTML.
- `docs/archive/index-before-allona-shop-homepage.html`: previous homepage preserved for reference.
- `docs/archive/index-before-super-app-homepage-*.html`: prior canonical homepage versions preserved before replacement.
- `docs/archive/index-inline-super-app-homepage-*.html`: original inline CSS/JS homepage preserved before modularization.
- `/pages/commerce/odeme.html`: compatibility copy of the existing `/pages/commerce/ode.html` payment page.
- `/pages/commerce/kuponlar.html`, `/pages/legal/kullanım-sartları.html`, `/pages/ecosystem/ayakında.html`, `/pages/account/premium.html`, `/pages/search/arama.html`: compatibility routes used by the provided homepage.
- `/images/modules/muhendislik.png`, `/images/modules/trade.png`, `/images/modules/wallet.png`: compatibility visual assets used by the provided homepage.

## Development Rules

- Do not delete existing GitHub files without explicit permission.
- Keep the provided homepage design and content intact while allowing CSS/JS to live in separate project files.
- Build new features and supporting pages around the AllonaHub homepage contract.
- Preserve payment safety: card data must not be stored in frontend or Supabase tables.
- Legal text pages must be reviewed before live production use.
