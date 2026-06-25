type SupabaseClientLike = {
  from: (table: string) => any;
};

function recommendation(score: number) {
  if (score >= 85) return { label: "Sistem onerisi: Blokla", action: "Manuel kontrol ve odeme onayi durdurma" };
  if (score >= 50) return { label: "Sistem onerisi: Inceleme gerekli", action: "Manuel kontrol" };
  return { label: "Sistem onerisi: Normal", action: "Standart akis" };
}

export async function summarizeOrderRisk(supabase: SupabaseClientLike, orderId: string) {
  const { data: events } = await supabase.from("risk_events").select("*").eq("order_id", orderId).order("created_at", { ascending: false });
  const score = Math.max(0, ...(events || []).map((event: any) => Number(event.score || 0)));
  return {
    score,
    events: events || [],
    ...recommendation(score),
    reason: events?.[0]?.message || "Siparis icin acik yuksek risk sinyali bulunmadi."
  };
}

export async function suggestRefundDecision(supabase: SupabaseClientLike, refundRequestId: string) {
  const { data: request } = await supabase.from("refund_requests").select("*").eq("id", refundRequestId).single();
  const { data: past } = await supabase.from("refund_requests").select("id").eq("user_id", request.user_id).gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString());
  if ((past || []).length >= 3) {
    return {
      decision: "under_review",
      reason: "Kullanici son 7 gunde 3 veya daha fazla iade talebi acti.",
      action: "Partner cevabi ve teslimat kaniti kontrol edilmeli."
    };
  }
  return { decision: "review", reason: "Talep standart inceleme icin uygun.", action: "Siparis durumu ve urun teslim kaniti kontrol edilmeli." };
}

export async function detectAbusePatterns(supabase: SupabaseClientLike, userId: string) {
  const since = new Date(Date.now() - 24 * 86400000).toISOString();
  const { data: failedPayments } = await supabase.from("payment_attempts").select("id").eq("user_id", userId).eq("status", "failed").gte("created_at", since);
  const { data: refunds } = await supabase.from("refund_requests").select("id").eq("user_id", userId).gte("created_at", since);
  return {
    multipleFailedPayments: (failedPayments || []).length >= 3,
    repeatedRefundRequests: (refunds || []).length >= 3,
    signals: {
      failedPayments24h: (failedPayments || []).length,
      refundRequests24h: (refunds || []).length
    }
  };
}

export async function summarizePartnerRisk(supabase: SupabaseClientLike, partnerId: string) {
  const { data: riskEvents } = await supabase.from("risk_events").select("*").eq("partner_id", partnerId).eq("status", "open");
  const maxScore = Math.max(0, ...(riskEvents || []).map((event: any) => Number(event.score || 0)));
  return {
    score: maxScore,
    openEvents: riskEvents || [],
    ...recommendation(maxScore),
    reason: riskEvents?.[0]?.message || "Partner icin acik kritik sinyal yok."
  };
}

export async function suggestSupportPriority(supabase: SupabaseClientLike, ticketId: string) {
  const { data: ticket } = await supabase.from("support_tickets").select("*").eq("id", ticketId).single();
  const text = `${ticket.subject || ticket.title || ""} ${ticket.user_message || ticket.message || ""}`.toLowerCase();
  if (/hasar|eksik|guvenlik|odeme|iade|iptal/.test(text)) return { priority: "high", reason: "Talep finans, teslimat veya guvenlik etkisi tasiyor." };
  return { priority: ticket.priority || "normal", reason: "Standart destek akisinda izlenebilir." };
}
