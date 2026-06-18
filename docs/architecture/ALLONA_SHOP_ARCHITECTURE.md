# AllonaHub Homepage Architecture

## Canonical Homepage

The current homepage source of truth is:

- `index.html`
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

- `index.html`: exact provided AllonaHub super-app homepage.
- `docs/architecture/allonahub-superapp-homepage-canonical.html`: exact canonical copy of the current homepage.
- `docs/archive/index-before-allona-shop-homepage.html`: previous homepage preserved for reference.
- `docs/archive/index-before-super-app-homepage-*.html`: prior canonical homepage versions preserved before replacement.
- `odeme.html`: compatibility copy of the existing `ode.html` payment page.
- `kuponlar.html`, `kullanım-sartları.html`, `ayakında.html`, `premium.html`, `arama.html`: compatibility routes used by the provided homepage.
- `muhendislik.png`, `trade.png`, `wallet.png`: compatibility visual assets used by the provided homepage.

## Development Rules

- Do not delete existing GitHub files without explicit permission.
- Keep the provided homepage unchanged.
- Build new features and supporting pages around the AllonaHub homepage contract.
- Preserve payment safety: card data must not be stored in frontend or Supabase tables.
- Legal text pages must be reviewed before live production use.
