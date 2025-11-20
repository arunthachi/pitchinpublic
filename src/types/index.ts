export type PitchStage = 'Pre-Seed' | 'Seed' | 'Series A' | 'Series B' | 'Growth';
export type Industry = 'SaaS' | 'FinTech' | 'HealthTech' | 'AI/ML' | 'Consumer' | 'Enterprise' | 'Climate' | 'Web3';
export type FeedbackType = 'roast' | 'toast';
export type ReactionType = 'roast' | 'toast' | 'fire' | 'rocket' | 'eyes' | 'thinking';

export interface PitchVersion {
  version: string;
  date: string;
  hook: string;
  changes: string[];
}

export interface Feedback {
  id: string;
  authorName: string;
  authorRole: string;
  type: FeedbackType;
  scores: {
    clarity: number;
    solution: number;
    market: number;
    presentation: number;
  };
  notes: string;
  createdAt: string;
}

export interface Pitch {
  id: string;
  founderName: string;
  founderAvatar: string;
  companyName: string;
  hook: string;
  description: string;
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
  feedback?: Feedback[];
  duration?: number; // in seconds
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
  scores: {
    clarity: number;
    solution: number;
    market: number;
    presentation: number;
  };
  notes: string;
}
