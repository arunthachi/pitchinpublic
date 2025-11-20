import { Pitch } from '@/types';

export const mockPitches: Pitch[] = [
  {
    id: '1',
    founderName: 'Sarah Chen',
    founderAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
    companyName: 'QuantumFlow',
    hook: 'AI-powered supply chain optimization that saves manufacturers 40% on logistics',
    description: 'We use machine learning to predict supply chain disruptions before they happen, automatically rerouting shipments and optimizing inventory across warehouses.',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800&q=80',
    industry: 'AI/ML',
    stage: 'Seed',
    views: 12400,
    interestScore: 8.7,
    roastCount: 23,
    toastCount: 89,
    duration: 60,
    createdAt: '2025-11-18T10:00:00Z',
    versions: [
      {
        version: 'V1',
        date: '2025-09-15',
        hook: 'Supply chain software for manufacturers',
        changes: ['Too generic', 'No clear value prop', 'Missing differentiation']
      },
      {
        version: 'V2',
        date: '2025-10-20',
        hook: 'Predictive logistics platform using AI',
        changes: ['Better positioning', 'Added AI angle', 'Still lacked concrete metrics']
      },
      {
        version: 'V3',
        date: '2025-11-18',
        hook: 'AI-powered supply chain optimization that saves manufacturers 40% on logistics',
        changes: ['Added specific ROI', 'Clearer target market', 'Strong hook']
      }
    ],
    feedback: [
      {
        id: 'f1',
        authorName: 'Marcus Rivera',
        authorRole: 'Series B Founder',
        type: 'toast',
        scores: { clarity: 9, solution: 8, market: 9, presentation: 8 },
        notes: 'Strong value prop with concrete metrics. The 40% savings claim is compelling. Would love to see case studies backing this up.',
        createdAt: '2025-11-19T14:30:00Z'
      }
    ]
  },
  {
    id: '2',
    founderName: 'James Mitchell',
    founderAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=James',
    companyName: 'MediLink',
    hook: 'Telemedicine platform connecting rural patients with specialists in under 60 seconds',
    description: 'Rural healthcare deserts affect 20% of Americans. MediLink uses AI triage to instantly match patients with the right specialist, reducing wait times from weeks to seconds.',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&q=80',
    industry: 'HealthTech',
    stage: 'Pre-Seed',
    views: 8900,
    interestScore: 7.9,
    roastCount: 15,
    toastCount: 67,
    duration: 58,
    createdAt: '2025-11-17T15:30:00Z',
    versions: [
      {
        version: 'V1',
        date: '2025-10-01',
        hook: 'Better telemedicine for everyone',
        changes: ['Too broad', 'No unique angle', 'Crowded market concern']
      },
      {
        version: 'V2',
        date: '2025-11-17',
        hook: 'Telemedicine platform connecting rural patients with specialists in under 60 seconds',
        changes: ['Clear niche focus', 'Added speed metric', 'Addressed real problem']
      }
    ],
    feedback: []
  },
  {
    id: '3',
    founderName: 'Priya Patel',
    founderAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Priya',
    companyName: 'CarbonLedger',
    hook: 'Blockchain-verified carbon credits marketplace for SMBs',
    description: 'Small businesses want to go carbon neutral but carbon credit markets are opaque and expensive. We verify credits on-chain and offer fractional purchases starting at $10/month.',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1569163139394-de4798aa62b6?w=800&q=80',
    industry: 'Climate',
    stage: 'Seed',
    views: 15600,
    interestScore: 8.2,
    roastCount: 42,
    toastCount: 78,
    duration: 45,
    createdAt: '2025-11-16T09:15:00Z',
    versions: [
      {
        version: 'V1',
        date: '2025-09-01',
        hook: 'Carbon credits on the blockchain',
        changes: ['Blockchain buzzword overload', 'Unclear target market', 'No pricing mentioned']
      },
      {
        version: 'V2',
        date: '2025-10-10',
        hook: 'Enterprise carbon credit platform',
        changes: ['Wrong market focus', 'Too competitive', 'Enterprises have solutions']
      },
      {
        version: 'V3',
        date: '2025-11-16',
        hook: 'Blockchain-verified carbon credits marketplace for SMBs',
        changes: ['Pivoted to underserved SMB market', 'Clear verification angle', 'Accessible pricing']
      }
    ],
    feedback: [
      {
        id: 'f2',
        authorName: 'David Kim',
        authorRole: 'Climate Tech Investor',
        type: 'roast',
        scores: { clarity: 7, solution: 6, market: 7, presentation: 7 },
        notes: 'Pivoting to SMBs is smart but $10/month might be too low for unit economics. How do you plan to achieve profitability with this pricing?',
        createdAt: '2025-11-17T11:20:00Z'
      }
    ]
  },
  {
    id: '4',
    founderName: 'Alex Turner',
    founderAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex',
    companyName: 'DevSync',
    hook: 'Real-time collaborative IDE for distributed engineering teams, 10x faster than GitHub',
    description: 'Remote teams waste 2 hours daily on async code reviews and merge conflicts. DevSync lets teams code together in real-time with AI-powered conflict resolution.',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&q=80',
    industry: 'SaaS',
    stage: 'Series A',
    views: 22100,
    interestScore: 9.1,
    roastCount: 31,
    toastCount: 134,
    duration: 52,
    createdAt: '2025-11-15T16:45:00Z',
    feedback: [
      {
        id: 'f3',
        authorName: 'Emily Zhang',
        authorRole: 'Former VP Eng at Stripe',
        type: 'toast',
        scores: { clarity: 10, solution: 9, market: 9, presentation: 9 },
        notes: 'This is exactly what my team needed at Stripe. The real-time collab angle is genius. Strong founding team. Ready to intro you to my network.',
        createdAt: '2025-11-16T10:00:00Z'
      },
      {
        id: 'f4',
        authorName: 'Ryan Brooks',
        authorRole: 'Seed Stage Investor',
        type: 'roast',
        scores: { clarity: 8, solution: 8, market: 6, presentation: 8 },
        notes: 'Great product but how do you compete with Microsoft (VS Code Live Share) and Replit? Need clearer moat and go-to-market strategy.',
        createdAt: '2025-11-16T14:30:00Z'
      }
    ]
  },
  {
    id: '5',
    founderName: 'Nina Rodriguez',
    founderAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Nina',
    companyName: 'FinFlow',
    hook: 'Stripe for B2B payments - net-60 terms without the cash flow pain',
    description: 'B2B sellers lose deals because they can\'t offer net-60 terms. FinFlow provides instant payouts while letting buyers pay later, taking a 2.9% fee.',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&q=80',
    industry: 'FinTech',
    stage: 'Seed',
    views: 18300,
    interestScore: 8.8,
    roastCount: 28,
    toastCount: 102,
    duration: 47,
    createdAt: '2025-11-14T13:20:00Z',
    versions: [
      {
        version: 'V1',
        date: '2025-10-01',
        hook: 'Buy now, pay later for businesses',
        changes: ['Too consumer-focused', 'Unclear differentiation', 'Weak positioning']
      },
      {
        version: 'V2',
        date: '2025-11-14',
        hook: 'Stripe for B2B payments - net-60 terms without the cash flow pain',
        changes: ['Stronger comparison anchor', 'Clear B2B focus', 'Specific value prop']
      }
    ],
    feedback: [
      {
        id: 'f5',
        authorName: 'Lisa Wong',
        authorRole: 'FinTech Founder (Exited)',
        type: 'toast',
        scores: { clarity: 9, solution: 9, market: 10, presentation: 8 },
        notes: 'Huge market. The "Stripe for X" comp is overused but actually makes sense here. I\'d focus on credit risk modeling as your moat.',
        createdAt: '2025-11-15T09:45:00Z'
      }
    ]
  }
];

export function getPitchById(id: string): Pitch | undefined {
  return mockPitches.find(pitch => pitch.id === id);
}

export function getRecentPitches(limit: number = 10): Pitch[] {
  return [...mockPitches]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}
