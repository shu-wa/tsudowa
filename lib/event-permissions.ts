import { EventItem } from '@/types/event';

const currentParticipant = (event: EventItem | undefined, currentUserId?: string, localProfileName?: string) => (
  currentUserId
    ? event?.participants.find((participant) => participant.id === currentUserId)
    : event?.participants.find((participant) => participant.id === 'me' || participant.name === localProfileName)
);

export const isEventManager = (event: EventItem | undefined, currentUserId?: string, localProfileName?: string) => {
  const currentMember = currentParticipant(event, currentUserId, localProfileName);
  return currentMember?.role === '主催者' || currentMember?.role === '共同主催者';
};

export const isEventHost = (event: EventItem | undefined, currentUserId?: string, localProfileName?: string) => (
  currentParticipant(event, currentUserId, localProfileName)?.role === '主催者'
);
