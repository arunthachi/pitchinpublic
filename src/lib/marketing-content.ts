export type MarketingFaq = Readonly<{
  question: string;
  answer: string;
}>;

export type MarketingRouteKey = 'home' | 'forEvents' | 'founders' | 'about' | 'contact' | 'terms';

export type MarketingRoute = Readonly<{
  path: '/' | '/for-events' | '/founders' | '/about' | '/contact' | '/terms';
  title: string;
  description: string;
  h1: string;
  eyebrow?: string;
  subhead: string;
  faq: readonly MarketingFaq[];
  sitemap: Readonly<{
    changeFrequency: 'monthly' | 'weekly';
    priority: number;
  }>;
}>;

export const productFacts = {
  name: 'Pitch in Public',
  category: 'Guided pitch preparation for founder programs and events',
  access: 'Pitch in Public is currently invite-only.',
  coaching:
    'Feedback is written by people. Pitch in Public does not use AI to coach or score founders.',
  eventPrivacy:
    'Event pitches are private to the event by default and visible to the founder plus active event members and team. Founders can choose to move an eligible take to the public feed.',
  eventDuration: 'Organizers can configure event pitch durations from one to six minutes.',
  reporting:
    'Organizer reports summarize participation, practice, feedback, and submission activity without claiming that the platform caused an outcome.',
} as const;

const homeFaq = [
  {
    question: 'What is Pitch in Public?',
    answer:
      'Pitch in Public is a guided pitch-preparation workspace. It connects an event Pitch Standard to a founder Pitch Plan, private practice takes, structured human feedback, and a final Best Take.',
  },
  {
    question: 'Who is Pitch in Public for?',
    answer:
      'It is for founder-program and startup-event organizers who coordinate pitch preparation, and for founders preparing for those programs and events.',
  },
  {
    question: 'Does Pitch in Public use AI to coach founders?',
    answer: productFacts.coaching,
  },
  {
    question: 'How does access work?',
    answer:
      'Pitch in Public is invite-only. Organizers can request access, and founders, teammates, and reviewers join through controlled invitations or event access.',
  },
  {
    question: 'Are event pitches public?',
    answer: productFacts.eventPrivacy,
  },
] as const satisfies readonly MarketingFaq[];

const organizerFaq = [
  {
    question: 'Can I set my own pitch standard and duration?',
    answer:
      'Yes. Organizers define the Pitch Standard founders prepare against and can configure event pitch durations from one to six minutes.',
  },
  {
    question: 'How are founders, teammates, and reviewers invited?',
    answer:
      'Organizers coordinate controlled invitations for event participants. Access remains tied to the event rather than an open public join page.',
  },
  {
    question: 'Can peer feedback be controlled?',
    answer:
      'Yes. An organizer can enable or close peer feedback for the event while coordinating reviewer feedback separately.',
  },
  {
    question: 'What does the outcome report show?',
    answer: productFacts.reporting,
  },
  {
    question: 'Who can see event pitches and decks?',
    answer:
      'Event takes and pitch decks stay within the controlled event experience for the founder, active event members, and team. Founder sharing controls determine whether an eligible take moves to the public feed.',
  },
] as const satisfies readonly MarketingFaq[];

const founderFaq = [
  {
    question: 'How do I join an event?',
    answer:
      'Founders join through an invitation or access path provided for their event. Pitch in Public is not an open, self-serve event directory.',
  },
  {
    question: 'What is a Pitch Plan?',
    answer:
      'A Pitch Plan turns the event Pitch Standard into a focused preparation path so you know what to work on before recording your next take.',
  },
  {
    question: 'Who can see my event takes?',
    answer: productFacts.eventPrivacy,
  },
  {
    question: 'What kind of feedback will I receive?',
    answer:
      'People give feedback against the event criteria, using readiness signals and notes that can point to a concrete next step. It is not AI-generated coaching.',
  },
  {
    question: 'What is a Best Take?',
    answer:
      'A Best Take is the version you select to represent your strongest current pitch and, when required, use for an event submission.',
  },
  {
    question: 'Can I share a take publicly?',
    answer:
      'When a take is eligible, you control whether it moves from the private event experience to the public feed.',
  },
  {
    question: 'How is daily practice different from event practice?',
    answer:
      'Event practice follows an organizer-defined standard, duration, cohort, and submission workflow. Daily practice is a separate way to build pitch repetition and momentum.',
  },
] as const satisfies readonly MarketingFaq[];

export const marketingRoutes = {
  home: {
    path: '/',
    title: 'Pitch in Public | Guided pitch preparation for founder programs',
    description:
      'Prepare founders with one pitch standard, a guided plan, private event practice, structured human feedback, and a clear Best Take.',
    eyebrow: 'Guided pitch preparation for founder programs',
    h1: 'Prepare every founder for the pitch standard that matters.',
    subhead:
      'Give your cohort one clear standard, a guided plan, private event practice, and useful human feedback before event day.',
    faq: homeFaq,
    sitemap: { changeFrequency: 'weekly', priority: 1 },
  },
  forEvents: {
    path: '/for-events',
    title: 'Pitch preparation for startup events | Pitch in Public',
    description:
      'Coordinate pitch standards, founder practice, human feedback, reviewers, final submissions, private decks, and outcome reporting.',
    h1: 'Run pitch preparation with one standard and one workflow.',
    subhead:
      'Coordinate founder practice, reviewers, final submissions, and progress visibility before the live event.',
    faq: organizerFaq,
    sitemap: { changeFrequency: 'weekly', priority: 0.9 },
  },
  founders: {
    path: '/founders',
    title: 'Prepare your event pitch | Pitch in Public',
    description:
      'Follow your event Pitch Standard, practice privately, use structured human feedback, and choose your Best Take.',
    h1: 'Know what your event expects before you step on stage.',
    subhead:
      'Turn the event standard into a focused plan, practice in its controlled cohort, use human feedback to revise, and choose your Best Take.',
    faq: founderFaq,
    sitemap: { changeFrequency: 'weekly', priority: 0.85 },
  },
  about: {
    path: '/about',
    title: 'About Pitch in Public | Better pitch preparation',
    description:
      'Learn why Pitch in Public gives founder programs a clearer, more useful preparation process before event day.',
    h1: 'Pitch preparation should start before founders reach the stage.',
    subhead:
      'We help organizers set a clear standard and help founders turn structured human feedback into a stronger next take.',
    faq: [],
    sitemap: { changeFrequency: 'monthly', priority: 0.6 },
  },
  contact: {
    path: '/contact',
    title: 'Contact Pitch in Public | Request invite-only access',
    description:
      'Tell us about your founder program, startup event, or pitch-preparation needs and request invite-only access.',
    h1: 'Tell us how you prepare founders to pitch.',
    subhead:
      'Share what you are preparing for and whether you are coordinating a program or participating as a founder. We will follow up.',
    faq: [],
    sitemap: { changeFrequency: 'monthly', priority: 0.55 },
  },
  terms: {
    path: '/terms',
    title: 'Terms of Service | Pitch in Public',
    description: 'Terms governing access to and use of Pitch in Public.',
    h1: 'Terms of Service',
    subhead: 'The terms governing use of Pitch in Public.',
    faq: [],
    sitemap: { changeFrequency: 'monthly', priority: 0.3 },
  },
} as const satisfies Record<MarketingRouteKey, MarketingRoute>;

export const marketingRouteOrder: readonly MarketingRouteKey[] = [
  'home',
  'forEvents',
  'founders',
  'about',
  'contact',
  'terms',
];

export const marketingSitemapRoutes = marketingRouteOrder
  .filter((key) => key !== 'terms')
  .map((key) => marketingRoutes[key]);

export const prohibitedMarketingClaims = [
  'AI coach',
  'AI-generated feedback',
  'real-time reaction counts',
  'offline support',
  'free plan',
  'guaranteed improvement',
  'anonymous review',
] as const;
