import { EventItem } from '@/types/event';

export const isEventManager = (event: EventItem | undefined, currentUserId?: string, localProfileName?: string) => {
  const currentMember = currentUserId
    ? event?.participants.find((participant) => participant.id === currentUserId)
    : event?.participants.find((participant) => participant.id === 'me' || participant.name === localProfileName);
  return currentMember?.role === '主催者' || currentMember?.role === '共同主催者';
};
