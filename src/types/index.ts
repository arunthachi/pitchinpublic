export type PitchStage = 'Pre-Seed' | 'Seed' | 'Series A' | 'Series B' | 'Growth';
export type Industry = 'SaaS' | 'FinTech' | 'HealthTech' | 'AI/ML' | 'Consumer' | 'Enterprise' | 'Climate' | 'Web3';
export type FeedbackType = 'roast' | 'toast';
export type ReactionType = 'roast' | 'toast' | 'fire' | 'rocket' | 'eyes' | 'thinking';
export type CompanyStatus = 'active' | 'paused' | 'archived';
export type PitchStatus = 'draft' | 'published' | 'archived';
export type ReviewerRole =
  | 'peer_founder'
  | 'coach'
  | 'mentor'
  | 'judge'
  | 'organizer'
  | 'experienced_reviewer'
  | 'public_reviewer';
export type ReviewAssignmentStatus = 'pending' | 'started' | 'submitted' | 'skipped' | 'expired';
export type FeedbackQualityRating = 'useful' | 'generic' | 'not_helpful';

export interface FeedbackQualityAction {
  href: string;
  method?: 'POST' | 'PUT' | 'PATCH';
}

export interface ReviewQueueItem {
  id: string;
  pitchId: string;
  publicPitchId?: string | null;
  startupName: string;
  hook: string;
  thumbnailUrl?: string | null;
  eventName?: string | null;
  dueAt?: string | null;
  status: ReviewAssignmentStatus;
}

export interface ReviewCreditSummary {
  available: number;
  pending: number;
  earned: number;
  discounted?: number;
  reviewsPerCredit: number;
  progress: number;
  exempt?: boolean;
}

export interface ReviewQueueSummary {
  items: ReviewQueueItem[];
  pendingCount: number;
  credits?: ReviewCreditSummary | null;
}

export interface EventReviewCoverage {
  pitchesSubmitted: number;
  reviewsAssigned: number;
  reviewsCompleted: number;
  usefulReviews?: number | null;
  pitchesWithFeedback: number;
  pitchesWithoutFeedback: number;
  foundersWithoutUsefulFeedback?: number | null;
  completionRate?: number | null;
  averageTimeToFirstReviewMinutes?: number | null;
}

// Database-aligned types
export interface Profile {
  id: string;
  email: string;
  full_name: string;
  username: string | null;
  public_handle?: string | null;
  avatar_url: string | null;
  bio: string | null;
  website: string | null;
  twitter_handle: string | null;
  linkedin_url: string | null;
  followers_count: number;
  following_count: number;
  pitches_count: number;
  companies_count: number;
  created_at: string;
  updated_at: string;
}

export interface Company {
  id: string;
  founder_id: string;
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  industry: Industry;
  stage: PitchStage;
  website: string | null;
  twitter_handle: string | null;
  linkedin_url: string | null;
  pitches_count: number;
  total_views: number;
  total_roasts: number;
  total_toasts: number;
  status: CompanyStatus;
  created_at: string;
  updated_at: string;
  // Joined data
  founder?: Profile;
}

export interface Pitch {
  id: string;
  public_id?: string | null;
  user_id: string;
  company_id: string | null;
  hook: string;
  description: string | null;
  startup_name?: string | null;
  one_line_pitch?: string | null;
  feedback_ask?: string | null;
  extra_context?: string | null;
  take_version?: number | null;
  video_url: string;
  video_provider: 'cloudflare' | 'mux' | 'bunny';
  video_id: string | null;
  thumbnail_url: string | null;
  duration: number | null;
  version_number: number;
  views_count: number;
  roast_count: number;
  toast_count: number;
  interest_score: number;
  status: PitchStatus;
  created_at: string;
  updated_at: string;
  // Joined data
  company?: Company;
  founder?: Profile;
  feedback?: Feedback[];
}

export interface PitchVersion {
  version: string;
  date: string;
  hook: string;
  changes: string[];
}

export interface Reaction {
  id: string;
  pitch_id: string;
  user_id: string;
  type: 'roast' | 'toast';
  created_at: string;
}

export interface Feedback {
  id: string;
  pitch_id: string;
  user_id: string;
  type: FeedbackType;
  content: string;
  is_public: boolean;
  signal?: string;
  signals?: string[];
  readiness?: number;
  scores?: {
    clarity: number;
    solution: number;
    market: number;
    presentation: number;
  };
  created_at: string;
  updated_at: string;
  // Joined data
  author?: Profile;
  authorName?: string;
  authorRole?: string;
}

// Legacy feedback type for backwards compatibility
export interface LegacyFeedback {
  id: string;
  authorName: string;
  authorRole: string;
  type: FeedbackType;
  signal?: string;
  signals?: string[];
  readiness?: number;
  scores: {
    clarity: number;
    solution: number;
    market: number;
    presentation: number;
  };
  notes: string;
  createdAt: string;
  reviewerRole?: ReviewerRole | string | null;
  displayRoleOnly?: boolean;
  canRateQuality?: boolean;
  qualityRating?: FeedbackQualityRating | null;
  qualityAction?: FeedbackQualityAction | null;
}

// Legacy interface for backwards compatibility with existing components
export interface LegacyPitch {
  id: string;
  publicId?: string;
  userId: string;
  founderHandle?: string | null;
  founderName: string;
  founderAvatar: string;
  companyName: string;
  hook: string;
  description: string;
  feedbackAsk?: string;
  extraContext?: string;
  videoUrl: string;
  thumbnailUrl: string;
  industry: Industry;
  stage: PitchStage;
  views: number;
  interestScore: number;
  roastCount: number;
  toastCount: number;
  createdAt: string;
  versions?: PitchVersion[];
  feedback?: LegacyFeedback[];
  duration?: number;
  versionNumber?: number;
  practiceGoalId?: string | null;
  promptKey?: string | null;
  promptText?: string | null;
  isBestTake?: boolean;
  isBookmarked?: boolean;
  bookmarkCount?: number;
  isOwnedByViewer?: boolean;
}

export interface QuickReaction {
  id: string;
  type: ReactionType;
  x: number;
  y: number;
  timestamp: number;
}

export interface UserStreak {
  currentStreak: number;
  longestStreak: number;
  totalFeedbacks: number;
  lastFeedbackDate: string;
}

export interface FeedbackFormData {
  type: FeedbackType;
  signal: string;
  signals: string[];
  readiness: number;
  scores: {
    clarity: number;
    solution: number;
    market: number;
    presentation: number;
  };
  notes: string;
}

export interface Follow {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}

export interface PitchView {
  id: string;
  pitch_id: string;
  user_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: 'roast' | 'toast' | 'follow' | 'feedback' | 'mention' | 'pitch_milestone';
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

// Legacy User type for backwards compatibility
export interface User {
  id: string;
  publicHandle?: string | null;
  name: string;
  email: string;
  avatar: string;
  bio?: string;
  website?: string | null;
  twitter?: string | null;
  linkedin?: string | null;
  followersCount: number;
  followingCount: number;
  pitchesCount: number;
  createdAt: string;
}
