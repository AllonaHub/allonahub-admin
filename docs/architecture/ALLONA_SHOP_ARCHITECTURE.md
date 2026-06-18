# Allona Shop Architecture

## Canonical Homepage

The current homepage source of truth is:

- `index.html`
- `docs/architecture/allona-shop-homepage-canonical.html`

The canonical homepage was provided as a single-file HTML document and must remain unchanged unless the user explicitly asks to edit it. New system work should adapt around that homepage rather than rewriting the provided code.

## Current Direction

Allona Shop is the public commerce storefront for the AllonaHub ecosystem. The homepage presents:

- Allona Shop brand identity
- Secure online shopping promise
- Product categories: Takı & Aksesuar, Tekstil, Kozmetik, Yaşam Ürünleri
- Featured sample products
- Delivery, return, and secure payment trust content
- Company and legal footer links

## File Organization

- `index.html`: exact provided homepage.
- `odeme.html`: compatibility copy of the existing `ode.html` payment page, linked from the homepage product CTAs.
- `hakkimizda.html`, `iletisim.html`, `destek.html`: existing corporate support pages linked from the footer and preserved.
- `mesafeli-satis-sozlesmesi.html`: compatibility copy of the existing `mesafeli-satis.html` legal page, linked from the homepage footer.
- `mesafeli-satis.html`, `gizlilik.html`, `kvkk.html`, `iade-politikasi.html`: existing legal pages preserved.
- `docs/archive/index-before-allona-shop-homepage.html`: previous homepage preserved for reference.

## Development Rules

- Do not delete existing GitHub files without explicit permission.
- Keep the provided homepage unchanged.
- Build new features and supporting pages around the Allona Shop homepage contract.
- Preserve payment safety: card data must not be stored in frontend or Supabase tables.
- Legal text pages are placeholders for structure and must be reviewed before live production use.
