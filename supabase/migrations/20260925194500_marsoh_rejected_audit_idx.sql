create index if not exists marsoh_audit_rejected_user_recent_idx
  on public.marsoh_audit_events(actor_user_id, created_at desc)
  where action = 'marsoh.message.rejected';
