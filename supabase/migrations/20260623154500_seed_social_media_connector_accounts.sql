insert into public.social_media_accounts (platform, display_name, handle, account_url, connector_mode, connection_status, metadata)
values
  ('telegram', 'AllonaHub Telegram', 'allonahub', 'https://t.me/allonahub', 'pending', 'not_connected', '{"default_post_type": "text"}'::jsonb),
  ('whatsapp', 'AllonaHub WhatsApp', 'allonahub', 'https://wa.me/905427781868', 'pending', 'not_connected', '{"default_post_type": "text"}'::jsonb),
  ('google_business', 'AllonaHub Google Business', 'allonahub', 'https://www.google.com/search?q=AllonaHub', 'pending', 'not_connected', '{"default_post_type": "feed"}'::jsonb)
on conflict (platform, handle) do nothing;
