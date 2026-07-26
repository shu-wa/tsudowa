export type Participant = {
  id: string;
  name: string;
  initials: string;
  role: '主催者' | '共同主催者' | '参加者';
  avatarColor: string;
  attendance: string;
};

export type AttendanceChoice = '参加' | '未定' | '不参加';

export type JoinRequest = {
  userId: string;
  name: string;
  initials: string;
  avatarColor: string;
  requestedAt: string;
};

export type AvailabilityChoice = 'yes' | 'maybe' | 'no';

export type DateCandidateVote = {
  participantId: string;
  choice: AvailabilityChoice;
};

export type DateCandidate = {
  id: string;
  date: string;
  startTime: string;
  note?: string;
  votes: DateCandidateVote[];
};

export type ScheduleItem = {
  id: string;
  day: string;
  time: string;
  title: string;
  note?: string;
  type: 'move' | 'activity' | 'food' | 'stay';
};

export type CollectionCategory = 'entry' | 'food' | 'stay' | 'transport' | 'ticket' | 'other';
export type SplitMethod = 'equal' | 'custom';

export type CollectionShare = {
  participantId: string;
  amount: number;
  paid: boolean;
  paidAt?: string;
};

export type CollectionItem = {
  id: string;
  title: string;
  category: CollectionCategory;
  paidByParticipantId: string;
  totalAmount: number;
  splitMethod: SplitMethod;
  dueDate?: string;
  note?: string;
  shares: CollectionShare[];
};

export type ChatMessage = {
  id: string;
  authorId?: string;
  author: string;
  initials: string;
  text: string;
  time: string;
  createdAt: string;
  mine?: boolean;
  color: string;
  imageUri?: string;
  imagePath?: string;
  imageMimeType?: string;
  imageWidth?: number;
  imageHeight?: number;
};

export type ChatImageInput = {
  uri: string;
  mimeType: string;
  width: number;
  height: number;
  fileSize?: number;
  fileName?: string;
};

export type EventInvitePreview = {
  eventId: string;
  title: string;
  startDate: string;
  endDate: string;
  dateLabel: string;
  timeLabel: string;
};

export type UserProfile = {
  name: string;
  handle: string;
  city: string;
  initials: string;
  avatarColor: string;
  email?: string;
};

export type AppSettings = {
  notificationsEnabled: boolean;
  onboardingCompleted: boolean;
  dateOfBirth?: string;
  termsAcceptedAt?: string;
  privacyAcceptedAt?: string;
  communityAcceptedAt?: string;
  acceptedTermsVersion?: string;
  acceptedPrivacyVersion?: string;
  acceptedCommunityVersion?: string;
};

export type ConsentRecord = {
  id: string;
  document: 'terms' | 'privacy' | 'community' | 'analytics';
  version: string;
  accepted: boolean;
  recordedAt: string;
};

export type SafetyReportReason = 'harassment' | 'hate' | 'sexual' | 'violence' | 'spam' | 'privacy' | 'other';

export type SafetyReport = {
  id: string;
  eventId?: string;
  messageId?: string;
  targetUserName?: string;
  targetUserId?: string;
  reason: SafetyReportReason;
  details?: string;
  createdAt: string;
  status: 'received' | 'reviewing' | 'resolved';
};

export type BlockedUser = {
  key: string;
  userId?: string;
  name: string;
  blockedAt: string;
};

export type OnboardingInput = {
  name: string;
  email: string;
  dateOfBirth: string;
};

export type EventTimeMode = 'start' | 'range';

export type EventDateTimeInput = {
  startDate: string;
  endDate: string;
  startTime: string;
  endTime?: string;
  timeMode: EventTimeMode;
};

export type EventLocationInput = {
  location: string;
  address: string;
  latitude?: number;
  longitude?: number;
};

export type EventItem = {
  id: string;
  title: string;
  category: string;
  tagline: string;
  host: string;
  startDate: string;
  endDate: string;
  dateLabel: string;
  timeLabel: string;
  startTime: string;
  endTime?: string;
  timeMode: EventTimeMode;
  location: string;
  address: string;
  latitude?: number;
  longitude?: number;
  description: string;
  coverColor: string;
  accentColor: string;
  status: '開催中' | '予定' | '終了';
  inviteCode: string;
  capacity: number;
  participants: Participant[];
  joinRequests?: JoinRequest[];
  dateCandidates?: DateCandidate[];
  schedule: ScheduleItem[];
  collections: CollectionItem[];
  messages: ChatMessage[];
  chatLastReadAt?: string;
};

export type NewEventInput = {
  title: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime?: string;
  timeMode: EventTimeMode;
  location: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  description: string;
  initialFee: number;
};

export type NewCollectionInput = {
  title: string;
  category: CollectionCategory;
  paidByParticipantId: string;
  totalAmount: number;
  splitMethod: SplitMethod;
  dueDate?: string;
  note?: string;
  participantIds: string[];
  customAmounts?: Record<string, number>;
};

export type NewScheduleInput = Omit<ScheduleItem, 'id'>;

export type NewDateCandidateInput = Omit<DateCandidate, 'id' | 'votes'>;
