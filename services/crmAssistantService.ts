type CampaignPayload = Record<string, any>;

export function suggestCampaignTitle(campaignPayload: CampaignPayload) {
  const module = campaignPayload.module === "shop" ? "Allona Shop" : "AllonaHub";
  if (campaignPayload.campaign_type === "abandoned_cart_recovery") return "Sepetindeki firsatlar seni bekliyor";
  if (campaignPayload.campaign_type === "coupon_campaign") return `${module} kupon firsati`;
  if (campaignPayload.campaign_type === "premium_upgrade") return "Yeni avantaj seviyene cok az kaldi";
  return `${module} kampanya duyurusu`;
}

export function suggestCampaignMessage(campaignPayload: CampaignPayload) {
  if (campaignPayload.campaign_type === "hp_bonus") return "HP/XP avantajlarini tamamlayarak indirim haklarini guclendirebilirsin.";
  if (campaignPayload.partner_id) return "Partner kampanyasi admin onayindan sonra hedef kullanicilara gonderilecek.";
  return "Bu kampanya kullanici tercihleri ve gunluk limitler dikkate alinarak gonderilmelidir.";
}

export function suggestTargetSegment(campaignPayload: CampaignPayload) {
  if (campaignPayload.campaign_type === "abandoned_cart_recovery") return "abandoned_cart_users";
  if (campaignPayload.campaign_type === "coupon_campaign") return "coupon_lovers";
  if (campaignPayload.campaign_type === "premium_upgrade") return "premium_candidates";
  if (campaignPayload.campaign_type === "module_launch") return "new_users";
  return "no_order_yet";
}

export function predictBestCampaignType(partnerId: string) {
  return {
    partnerId,
    campaignType: "partner_offer",
    reason: "Partner urunleri favoriye ekleniyor ama sepete az gidiyorsa indirim kampanyasi onceliklidir."
  };
}

export function suggestUserNextBestAction(userId: string) {
  return {
    userId,
    action: "coupon_center",
    label: "Kupon Merkezi'ni ziyaret et",
    reason: "MVP'de kullaniciyi tekrar donuse tasiyan en guvenli avantaj alani Kupon Merkezi'dir."
  };
}

export function summarizeCampaignPerformance(campaignId: string) {
  return {
    campaignId,
    summary: "Teslimat, acilma, tiklama ve donusum kayitlari campaign_deliveries uzerinden izlenir.",
    nextStep: "Dusuk tiklamada baslik ve hedef segment yenilenmeli; yuksek tiklama dusuk satis durumunda kupon kosulu sadeleştirilmeli."
  };
}
