# Pitch in Public - MVP Frontend

A mobile-first responsive web application (PWA) for startup founders to share their pitches and receive real feedback from the community.

## Features

### 🎬 The Stage (Home Feed)
- **Desktop:** Grid layout showcasing pitch cards
- **Mobile:** TikTok-style vertical scroll feed
- Real-time pitch cards with video thumbnails, hooks, and key metrics
- Filter by industry, stage, and trending pitches

### 💬 The Feedback Room (Detail View)
- **Desktop:** Split-screen layout (Video Left, Feedback Right)
- **Mobile:** Stacked layout (Video Top, Feedback Bottom)
- Interactive feedback modal with "Roast 🔥" vs "Toast 🥂" modes
- 4-category scoring system: Clarity, Solution, Market, Presentation
- Real-time feedback submission

### 📊 Pivot History
- Visual timeline showing pitch evolution (V1 → V2 → V3)
- See how founders iterated based on feedback
- Track changes and improvements over time

## Tech Stack

- **Framework:** Next.js 14 (App Router, TypeScript)
- **Styling:** Tailwind CSS with custom dark theme
- **Components:** Shadcn/UI + Radix UI primitives
- **Animation:** Framer Motion
- **Icons:** Lucide React
- **Fonts:** Space Grotesk (headings) + Inter (body)

## Design System

### Theme
- **Colors:** Dark mode heavy (Slate 900/950)
- **Accents:** Neon Cyan (#00F0FF) and Lime Green (#CCFF00)
- **Texture:** Blueprint-style grid pattern overlay
- **Typography:** Large bold headers with high contrast

### Visual Identity
- Glassmorphism cards with backdrop blur
- Animated hover states and transitions
- Glow effects on key elements
- Mobile-optimized touch targets

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
npm run build
npm start
```

## Project Structure

```
pitchinpublic/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout with fonts & theme
│   │   ├── page.tsx            # Home feed (The Stage)
│   │   ├── pitch/[id]/page.tsx # Detail view (Feedback Room)
│   │   └── globals.css         # Global styles
│   ├── components/
│   │   ├── ui/                 # Shadcn/UI components
│   │   ├── PitchCard.tsx       # Pitch card component
│   │   ├── FeedbackModal.tsx   # Roast/Toast modal
│   │   ├── PivotHistory.tsx    # Timeline component
│   │   └── GridBackground.tsx  # Blueprint texture
│   ├── lib/
│   │   ├── utils.ts            # Utility functions
│   │   └── data.ts             # Mock pitch data
│   └── types/
│       └── index.ts            # TypeScript types
├── public/                      # Static assets
└── package.json
```

## Key Components

### PitchCard
Responsive card component with:
- Video thumbnail with play overlay
- Founder info and company name
- Stage and industry badges
- View count and interest score
- Smooth hover animations

### FeedbackModal
Interactive feedback form featuring:
- Roast 🔥 / Toast 🥂 toggle switch
- 4 scoring sliders (1-10 scale)
- Text area for detailed notes
- Dynamic theme based on feedback type

### PivotHistory
Timeline visualization showing:
- Chronological pitch versions
- Key changes and learnings
- Current version highlight
- Smooth animations

## Mobile Responsiveness

- Fully responsive grid → vertical stack layouts
- Touch-optimized interactive elements
- Optimized for screens 320px and up
- Smooth scroll behavior

## Future Enhancements

- [ ] Video player integration
- [ ] User authentication
- [ ] Real-time notifications
- [ ] Advanced filtering and search
- [ ] Founder profiles
- [ ] Analytics dashboard
- [ ] PWA offline support

## License

MIT

---

**Built for founders who aren't afraid of feedback.**
