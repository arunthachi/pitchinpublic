# Pitch in Public 2.0 - The TikTok for Startup Pitches

A **full-screen, immersive, mobile-first** web application where founders post 60-second pitches and get real-time feedback from the community. Think **TikTok meets Product Hunt meets Loom**.

## 🎬 What's New in 2.0

### **The TikTok Experience**
- ✅ Full-screen vertical video feed
- ✅ Swipe up/down navigation (or arrow keys)
- ✅ Auto-play videos with smooth transitions
- ✅ Floating UI that doesn't compete with content
- ✅ Gesture-based interactions

### **Quick Interactions**
- ✅ **Roast 🔥 / Toast 🥂** buttons floating over video (like TikTok likes)
- ✅ Real-time reaction counts
- ✅ Animated feedback bubbles
- ✅ Tap to pause/play
- ✅ Swipe left to open feedback panel

### **Recording Flow**
- ✅ One-tap recording studio access
- ✅ Upload video in 3 clicks
- ✅ Add hook and tags inline
- ✅ Post goes live instantly

## 🚀 Core Features

### **1. The Feed (TikTok-Style)**
```
┌─────────────────────┐
│   [Video Playing]   │ ← Full screen
│                     │
│   Sarah Chen        │ ← Floating overlay
│   QuantumFlow       │
│   "AI-powered..."   │
│                     │
│              [🔥 42]│ ← Roast button
│              [🥂 89]│ ← Toast button
│              [💬 12]│ ← Feedback
│              [📊 8.7]│ ← Score
│                     │
│   ↓ Swipe for next  │
└─────────────────────┘
```

### **2. Quick Feedback Panel**
- Slides in from right
- Toggle Roast/Toast mode
- 4 quick sliders (Clarity, Solution, Market, Presentation)
- Text area for detailed notes
- Submit in seconds

### **3. Recording Studio**
- Upload or record video
- Add compelling hook (120 chars)
- Quick tag selection
- Preview before posting

### **4. Gesture Controls**
- **Swipe up** = Next pitch
- **Swipe down** = Previous pitch
- **Tap anywhere** = Pause/play
- **Swipe left** = Open feedback
- **Double-tap** = Quick toast (coming soon)

## 🎨 Design Philosophy

### **Minimal Chrome, Maximum Content**
- Pure black background (#000000)
- Content fills 100% of screen
- UI only appears when needed
- No grid layouts, no distractions

### **Floating UI**
- All controls float over video
- Semi-transparent with backdrop blur
- Neon cyan/lime accents pop against dark background
- Subtle animations for engagement

### **Mobile-First**
- Designed for thumb-friendly interactions
- Portrait orientation default
- Works great on desktop with keyboard nav

## 🛠️ Tech Stack

- **Framework:** Next.js 14 (App Router, TypeScript)
- **Video:** React Player
- **Gestures:** @use-gesture/react
- **Animation:** Framer Motion
- **Styling:** Tailwind CSS
- **Components:** Shadcn/UI + Radix UI
- **Icons:** Lucide React
- **Fonts:** Space Grotesk + Inter

## 📦 Installation

```bash
# Clone the repo
git clone <your-repo-url>
cd pitchinpublic

# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 🎮 How to Use

### **Watching Pitches**
1. Videos auto-play full-screen
2. Swipe up/down or use arrow keys to navigate
3. Tap video to pause/play
4. Tap mute button (top-right) to toggle sound

### **Giving Feedback**
1. While watching, tap 🔥 (Roast) or 🥂 (Toast) for quick reaction
2. Tap 💬 icon to open detailed feedback panel
3. Adjust 4 sliders and write notes
4. Submit instantly

### **Posting Your Pitch**
1. Tap the + button (top-right)
2. Upload your 60-second video
3. Write your hook (one killer sentence)
4. Add tags and post!

## 🎯 Key Interactions

### **Navigation**
- **Keyboard:** ↑ / ↓ arrows
- **Mouse:** Scroll up/down
- **Touch:** Swipe up/down

### **Reactions**
- **Roast 🔥** → Red glow animation
- **Toast 🥂** → Green glow animation
- **Feedback 💬** → Opens slide-in panel
- **Share 📤** → Native share or copy link

### **Video Controls**
- **Tap anywhere** → Pause/play
- **Tap mute icon** → Toggle sound
- **Progress bar** → Shows at top

## 📂 Project Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Home (Full-screen feed)
│   └── globals.css
├── components/
│   ├── FullScreenVideoFeed.tsx # Main container with gestures
│   ├── VideoPlayer.tsx         # Full-screen video player
│   ├── FloatingPitchInfo.tsx   # Overlay with pitch details
│   ├── FloatingReactions.tsx   # Roast/Toast sidebar
│   ├── QuickFeedbackPanel.tsx  # Slide-in feedback form
│   ├── RecordingStudio.tsx     # Upload/record interface
│   └── ui/                     # Shadcn components
├── lib/
│   ├── data.ts                 # Mock pitches
│   └── utils.ts
└── types/
    └── index.ts
```

## 🎨 Design Tokens

```css
--neon-cyan: #00F0FF
--neon-lime: #CCFF00
--roast: #FF3B30
--toast: #34C759
--dark-base: #000000
--slate-950: #020617
```

## 🔥 What Makes This Addictive

1. **Instant gratification** → Quick reactions in 1 tap
2. **Endless scroll** → Always one more pitch
3. **FOMO** → Miss out on trending pitches
4. **Social proof** → See roast/toast counts live
5. **Low friction** → Post in 3 taps
6. **Gamification** → Coming soon (streaks, badges, leaderboards)

## 🚀 Roadmap

- [ ] Double-tap to quick toast
- [ ] Duet/Stitch reactions
- [ ] Live streaming pitches
- [ ] Founder profiles
- [ ] Following/followers
- [ ] Notifications
- [ ] Streak system
- [ ] Leaderboards
- [ ] Remix culture (iterate on feedback)
- [ ] PWA with offline support

## 🎯 Performance

- Videos preload for smooth transitions
- Optimized animations with Framer Motion
- Lazy loading for components
- Responsive images with Next.js Image

## 📱 Browser Support

- Chrome/Edge (recommended)
- Safari
- Firefox
- Mobile browsers (iOS Safari, Chrome Mobile)

## 🤝 Contributing

This is an MVP. Feedback and PRs welcome!

## 📄 License

MIT

---

**Built for founders who aren't afraid of feedback.** 🔥🥂

---

## Quick Start Commands

```bash
npm run dev -- -p 3002   # Start dev server
npm run build    # Build for production
npm run start    # Run production build
npm run lint     # Run ESLint
```
