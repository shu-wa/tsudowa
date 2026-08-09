import { CollectionShare, NewCollectionInput } from '@/types/event';

export const buildCollectionShares = (
  input: NewCollectionInput,
  previousShares: CollectionShare[] = [],
): CollectionShare[] => {
  const previousByParticipant = new Map(previousShares.map((share) => [share.participantId, share]));
  const baseAmount = input.participantIds.length ? Math.floor(input.totalAmount / input.participantIds.length) : 0;
  const remainder = input.totalAmount - baseAmount * input.participantIds.length;

  return input.participantIds.map((participantId, index) => {
    const previous = previousByParticipant.get(participantId);
    return {
      participantId,
      amount: input.splitMethod === 'custom'
        ? input.customAmounts?.[participantId] ?? 0
        : baseAmount + (index === 0 ? remainder : 0),
      paid: previous?.paid ?? false,
      paidAt: previous?.paidAt,
    };
  });
};

export const collectionSharesTotal = (shares: CollectionShare[]) => (
  shares.reduce((sum, share) => sum + share.amount, 0)
);
