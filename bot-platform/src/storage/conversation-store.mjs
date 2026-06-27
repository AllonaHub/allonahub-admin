import { createId, nowIso } from '../core/ids.mjs';

export class ConversationStore {
  constructor({ eventStore }) {
    this.eventStore = eventStore;
    this.conversations = new Map();
  }

  async touch(input) {
    const conversationId = input.conversationId || createId('conv');
    const existing =
      this.conversations.get(conversationId) ??
      {
        conversationId,
        channel: input.channel || 'web',
        user: input.user ?? {},
        status: 'open',
        createdAt: nowIso(),
        lastMessageAt: nowIso(),
        smartContext: {
          slots: {},
          intentHistory: []
        },
        turns: []
      };

    existing.lastMessageAt = nowIso();
    existing.channel = input.channel || existing.channel;
    existing.user = { ...existing.user, ...(input.user ?? {}) };
    this.conversations.set(conversationId, existing);
    return existing;
  }

  async addTurn(conversationId, turn) {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return;
    conversation.turns.push({ ...turn, createdAt: nowIso() });
    conversation.lastMessageAt = nowIso();
    await this.eventStore.append('conversation-events', {
      conversationId,
      ...turn,
      createdAt: conversation.lastMessageAt
    });
  }

  get(conversationId) {
    return this.conversations.get(conversationId);
  }
}
