type SupabaseClientLike = {
  from: (table: string) => any;
};

type CampaignPayload = Record<string, any>;

export async function createCampaign(supabase: SupabaseClientLike, payload: CampaignPayload) {
  const status = payload.partner_id ? "pending_review" : (payload.status || "draft");
  const { data, error } = await supabase
    .from("campaigns")
    .insert({ ...payload, status })
    .select("*")
    .single();

  if (error) throw new Error(error.message || "Campaign could not be created");
  return data;
}

export async function approveCampaign(supabase: SupabaseClientLike, campaignId: string, adminId: string) {
  const { data, error } = await supabase
    .from("campaigns")
    .update({ status: "active", metadata: { approved_by: adminId, approved_at: new Date().toISOString() } })
    .eq("id", campaignId)
    .select("*")
    .single();

  if (error) throw new Error(error.message || "Campaign could not be approved");
  return data;
}

export async function pauseCampaign(supabase: SupabaseClientLike, campaignId: string) {
  const { data, error } = await supabase.from("campaigns").update({ status: "paused" }).eq("id", campaignId).select("*").single();
  if (error) throw new Error(error.message || "Campaign could not be paused");
  return data;
}

export async function completeCampaign(supabase: SupabaseClientLike, campaignId: string) {
  const { data, error } = await supabase.from("campaigns").update({ status: "completed" }).eq("id", campaignId).select("*").single();
  if (error) throw new Error(error.message || "Campaign could not be completed");
  return data;
}

export async function getEligibleUsers(supabase: SupabaseClientLike, campaignId: string) {
  const { data: campaign, error } = await supabase
    .from("campaigns")
    .select("id,target_segment_id,status,send_limit")
    .eq("id", campaignId)
    .single();

  if (error || !campaign) throw new Error(error?.message || "Campaign not found");
  if (campaign.status !== "active") return [];

  if (campaign.target_segment_id) {
    const { data, error: membershipError } = await supabase
      .from("user_segment_memberships")
      .select("user_id")
      .eq("segment_id", campaign.target_segment_id)
      .limit(campaign.send_limit || 1000);
    if (membershipError) throw new Error(membershipError.message || "Eligible users could not be loaded");
    return (data || []).map((item: any) => item.user_id);
  }

  const { data: prefs, error: prefsError } = await supabase
    .from("notification_preferences")
    .select("user_id")
    .eq("in_app_enabled", true)
    .eq("partner_campaigns", true)
    .limit(campaign.send_limit || 500);
  if (prefsError) throw new Error(prefsError.message || "Eligible users could not be loaded");
  return (prefs || []).map((item: any) => item.user_id);
}

export async function deliverCampaign(supabase: SupabaseClientLike, campaignId: string) {
  const { data: campaign, error } = await supabase.from("campaigns").select("*").eq("id", campaignId).single();
  if (error || !campaign) throw new Error(error?.message || "Campaign not found");
  if (campaign.status !== "active") throw new Error("Only active campaigns can be delivered");

  const users = await getEligibleUsers(supabase, campaignId);
  const deliveries = [];
  for (const userId of users) {
    const { data: existing } = await supabase
      .from("campaign_deliveries")
      .select("id")
      .eq("campaign_id", campaignId)
      .eq("user_id", userId)
      .maybeSingle();
    if (existing) continue;

    const { data: notification, error: notificationError } = await supabase
      .from("notifications")
      .insert({
        user_id: userId,
        title: campaign.title,
        body: campaign.description || "AllonaHub kampanya firsati seni bekliyor.",
        notification_type: "partner_campaign",
        module: campaign.module || "all",
        entity_type: "campaign",
        entity_id: campaign.id,
        action_url: campaign.coupon_id ? "/pages/commerce/coupon-center.html" : "/pages/search/discover.html",
        priority: campaign.priority > 10 ? "high" : "normal"
      })
      .select("id")
      .single();
    if (notificationError) continue;

    const { data: delivery } = await supabase
      .from("campaign_deliveries")
      .insert({
        campaign_id: campaignId,
        user_id: userId,
        notification_id: notification.id,
        status: "delivered",
        delivered_at: new Date().toISOString()
      })
      .select("*")
      .single();
    if (delivery) deliveries.push(delivery);
  }

  await supabase.from("campaigns").update({ sent_count: deliveries.length }).eq("id", campaignId);
  return deliveries;
}

export async function logCampaignOpen(supabase: SupabaseClientLike, deliveryId: string) {
  const { data, error } = await supabase
    .from("campaign_deliveries")
    .update({ status: "opened", opened_at: new Date().toISOString() })
    .eq("id", deliveryId)
    .select("*")
    .single();
  if (error) throw new Error(error.message || "Campaign open could not be logged");
  return data;
}

export async function logCampaignClick(supabase: SupabaseClientLike, deliveryId: string) {
  const { data, error } = await supabase
    .from("campaign_deliveries")
    .update({ status: "clicked", clicked_at: new Date().toISOString() })
    .eq("id", deliveryId)
    .select("*")
    .single();
  if (error) throw new Error(error.message || "Campaign click could not be logged");
  return data;
}

export async function linkCampaignConversion(supabase: SupabaseClientLike, deliveryId: string, orderId: string) {
  const { data, error } = await supabase
    .from("campaign_deliveries")
    .update({ status: "converted", converted_order_id: orderId })
    .eq("id", deliveryId)
    .select("*")
    .single();
  if (error) throw new Error(error.message || "Campaign conversion could not be linked");
  return data;
}
