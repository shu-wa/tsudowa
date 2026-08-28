import { ChatMessage, Participant } from '@/types/event';

export const CHAT_EDIT_WINDOW_MS = 15 * 60 * 1000;
export const CHAT_DELETE_WINDOW_MS = 24 * 60 * 60 * 1000;

export function canEditChatMessage(message: ChatMessage, now = Date.now()) {
  const createdAt = Date.parse(message.createdAt);
  return Boolean(message.mine && !message.deletedAt && Number.isFinite(createdAt) && now - createdAt <= CHAT_EDIT_WINDOW_MS);
}

export function canDeleteChatMessage(message: ChatMessage, isManager: boolean, now = Date.now()) {
  if (message.deletedAt) return false;
  if (isManager) return true;
  const createdAt = Date.parse(message.createdAt);
  return Boolean(message.mine && Number.isFinite(createdAt) && now - createdAt <= CHAT_DELETE_WINDOW_MS);
}

export function getMessageReadCount(message: ChatMessage, participants: Participant[]) {
  const sentAt = Date.parse(message.createdAt);
  if (!message.mine || !Number.isFinite(sentAt)) return 0;
  return participants.filter((participant) => {
    if (participant.id === message.authorId || !participant.chatReadAt) return false;
    const readAt = Date.parse(participant.chatReadAt);
    return Number.isFinite(readAt) && readAt >= sentAt;
  }).length;
}

export function filterChatMessages(messages: ChatMessage[], query: string) {
  const normalized = query.trim().toLocaleLowerCase('ja-JP');
  if (!normalized) return messages;
  return messages.filter((message) => !message.deletedAt && (
    message.text.toLocaleLowerCase('ja-JP').includes(normalized)
    || message.author.toLocaleLowerCase('ja-JP').includes(normalized)
  ));
}

export function getMentionQuery(text: string) {
  const match = text.match(/(?:^|\s)@([^\s@]*)$/u);
  return match ? match[1] : null;
}

export function insertMention(text: string, displayName: string) {
  return text.replace(/(?:^|\s)@[^\s@]*$/u, (match) => `${match.startsWith(' ') ? ' ' : ''}@${displayName} `);
}
