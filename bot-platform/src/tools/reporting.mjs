export async function buildDailyReport({ store }) {
  const events = await store.readAll('conversation-events', { limit: 1000 });
  const tickets = await store.readAll('support-tickets', { limit: 1000 });
  const today = new Date().toISOString().slice(0, 10);

  const todayEvents = events.filter((event) => String(event.createdAt ?? '').startsWith(today));
  const todayTickets = tickets.filter((ticket) => String(ticket.createdAt ?? '').startsWith(today));
  const conversations = new Set(todayEvents.map((event) => event.conversationId).filter(Boolean));
  const intents = new Map();

  for (const event of todayEvents) {
    if (!event.classification?.intent) continue;
    intents.set(event.classification.intent, (intents.get(event.classification.intent) ?? 0) + 1);
  }

  return {
    date: today,
    totalConversations: conversations.size,
    totalTurns: todayEvents.length,
    handoffCount: todayTickets.length,
    criticalTicketCount: todayTickets.filter((ticket) => ticket.priority === 'critical').length,
    topIntents: [...intents.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([intent, count]) => ({ intent, count })),
    openTickets: todayTickets.filter((ticket) => ticket.status === 'open').slice(-20)
  };
}
