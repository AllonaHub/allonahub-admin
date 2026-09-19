begin;

update public.marsoh_topic_cards
set title_i18n = jsonb_set(
      jsonb_set(
        title_i18n,
        '{tr}',
        to_jsonb(U&'Bug\00FCn\00FCn deniz konusu'::text),
        true
      ),
      '{az}',
      to_jsonb(U&'G\00FCn\00FCn d\0259niz m\00F6vzusu'::text),
      true
    ),
    body_i18n = jsonb_set(
      jsonb_set(
        body_i18n,
        '{tr}',
        to_jsonb(U&'Uzun vardiyalarda ekip i\00E7i ileti\015Fimi g\00FC\00E7lendiren en iyi al\0131\015Fkanl\0131k nedir?'::text),
        true
      ),
      '{az}',
      to_jsonb(U&'Uzun n\00F6vb\0259l\0259rd\0259 ekip \00FCnsiyy\0259tini g\00FCcl\0259ndir\0259n \0259n yax\015F\0131 v\0259rdi\015F n\0259dir?'::text),
      true
    )
where status = 'active';

commit;
