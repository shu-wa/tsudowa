import { CollectionCategory } from '@/types/event';
import { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

export const collectionCategories: {
  value: CollectionCategory;
  label: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  color: string;
  background: string;
}[] = [
  { value: 'entry', label: '参加費', icon: 'people-outline', color: '#173E33', background: '#E8E9E6' },
  { value: 'food', label: '食事代', icon: 'restaurant-outline', color: '#843B2D', background: '#ECE9E6' },
  { value: 'stay', label: '宿泊費', icon: 'bed-outline', color: '#354A59', background: '#E8E9E9' },
  { value: 'transport', label: '交通費', icon: 'car-outline', color: '#6B551D', background: '#EBEAE5' },
  { value: 'ticket', label: 'チケット', icon: 'ticket-outline', color: '#51435D', background: '#EAE8EA' },
  { value: 'other', label: 'その他', icon: 'receipt-outline', color: '#555B57', background: '#E7E8E6' },
];

export function getCollectionCategory(category: CollectionCategory) {
  return collectionCategories.find((item) => item.value === category) ?? collectionCategories[5];
}
