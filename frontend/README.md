# 🇹🇭 TrendSiam - Modern Frontend

A beautiful, modern Next.js frontend for the TrendSiam Thai news aggregation platform, featuring AI-powered summaries, bilingual support, and stunning design inspired by big.dk and tadao-ando.com aesthetics.

## ✨ Features

### 🎨 **Modern Design System**
- **Bold Typography**: Instrument Sans + Playfair Display fonts
- **Minimalist Layout**: Clean whitespace and grid-based design
- **Dark/Light Themes**: Smooth theme transitions
- **Responsive Design**: Perfect on mobile, tablet, and desktop
- **Glass Morphism**: Modern backdrop blur effects
- **Smooth Animations**: Subtle hover effects and transitions

### 🌐 **Bilingual Support**
- **Thai/English Toggle**: Instant language switching
- **Complete Localization**: All UI elements translated
- **Cultural Adaptation**: Thai-specific formatting and typography

### 🤖 **AI-Powered Features**
- **Smart Summaries**: AI-generated Thai and English summaries
- **Popularity Scoring**: Advanced algorithmic ranking
- **Auto-Categorization**: 8 content categories
- **AI Image Generation**: Editorial illustrations for top 3 stories
- **Weekly Analytics**: Comprehensive trend reports

### 🔧 **Advanced Functionality**
- **Real-time Filtering**: Platform, category, date, and search filters
- **Developer Mode**: Debug information and AI prompt access
- **PDF Reports**: Weekly report downloads
- **Accessibility**: WCAG compliant with screen reader support
- **Performance**: Optimized loading and smooth interactions

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Backend TrendSiam API running on `http://localhost:8000`

### Installation

1. **Clone and setup the frontend:**
```bash
cd frontend
npm install
```

2. **Configure environment variables:**
```bash
# Create .env.local file
echo "NEXT_PUBLIC_API_BASE_URL=http://localhost:8000" > .env.local
```

3. **Start development server:**
```bash
npm run dev
```

4. **Open in browser:**
```
http://localhost:3000
```

## 🏗️ Project Structure

```
frontend/
├── src/
│   ├── app/                    # Next.js 14 App Router
│   │   ├── globals.css         # Global styles & design system
│   │   ├── layout.tsx          # Root layout with providers
│   │   ├── page.tsx            # Home page
│   │   ├── weekly-report/      # Weekly report page
│   │   ├── terms/              # Terms of use page
│   │   └── privacy/            # Privacy policy page
│   ├── components/             # Reusable UI components
│   │   ├── layout/             # Navigation, sidebar, footer
│   │   ├── news/               # News grid and cards
│   │   ├── filters/            # Filter panel and controls
│   │   ├── hero/               # Hero section
│   │   ├── stats/              # Statistics overview
│   │   └── ui/                 # Base UI components
│   ├── stores/                 # Zustand state management
│   │   ├── newsStore.ts        # News data state
│   │   └── uiStore.ts          # UI preferences state
│   ├── lib/                    # Utilities and APIs
│   │   ├── api.ts              # Backend API integration
│   │   └── i18n.ts             # Internationalization
│   └── types/                  # TypeScript type definitions
│       └── index.ts            # Shared interfaces
├── package.json                # Dependencies and scripts
├── tailwind.config.js          # Tailwind CSS configuration
├── next.config.js              # Next.js configuration
└── tsconfig.json               # TypeScript configuration
```

## 🎨 Design System

### **Color Palette**
```css
/* Primary (Grayscale) */
primary-50:  #f8fafc   /* Light backgrounds */
primary-100: #f1f5f9   /* Subtle backgrounds */
primary-500: #64748b   /* Medium text */
primary-900: #0f172a   /* Dark text */
primary-950: #020617   /* Dark backgrounds */

/* Accent (Red) */
accent-500:  #ef4444   /* Primary accent */
accent-600:  #dc2626   /* Hover states */

/* Thai (Orange) */
thai-500:    #f97316   /* Thai cultural accent */
thai-600:    #ea580c   /* Thai hover states */
```

### **Typography**
- **Primary Font**: Instrument Sans (300-700)
- **Display Font**: Playfair Display (400-800)
- **Mono Font**: Geist Mono (300-500)

### **Components**
- **News Cards**: Clean, card-based layout with hover effects
- **Filter System**: Advanced filtering with active state indicators
- **Navigation**: Responsive sidebar with smooth animations
- **Theme Toggle**: Seamless dark/light mode switching

## 🔌 API Integration

### **Backend Endpoints**
The frontend expects these API endpoints from the backend:

```typescript
// News data
GET /api/news                    # Get all news items
GET /api/news/filtered           # Get filtered news
GET /api/news/top               # Get top stories

// Weekly reports
GET /api/weekly-report          # Get weekly data
GET /api/weekly-report/pdf      # Download PDF report

// Images
GET /api/images                 # Get AI image URLs
POST /api/images/generate       # Generate new images

// Data refresh
POST /api/news/refresh          # Refresh news data
```

### **Data Format**
News items should follow this TypeScript interface:

```typescript
interface NewsItem {
  rank: string | number
  title: string
  channel: string
  view_count: string
  published_date: string
  video_id: string
  description: string
  summary: string              // Thai summary
  summary_en: string          // English summary
  popularity_score: number
  popularity_score_precise: number
  auto_category: string
  ai_image_url?: string       // For top 3 stories
  ai_image_prompt?: string    // AI generation prompt
  // ... additional fields
}
```

## 🛠️ Development

### **Available Scripts**
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # TypeScript type checking
```

### **Environment Variables**
```bash
# Required
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000

# Optional (for production)
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

### **Adding New Features**

1. **New Components**: Add to `src/components/`
2. **New Pages**: Add to `src/app/`
3. **State Management**: Extend stores in `src/stores/`
4. **API Integration**: Update `src/lib/api.ts`
5. **Translations**: Add to `src/lib/i18n.ts`

## 🌟 Key Features Explained

### **Real-time Data Flow**
1. **Data Fetching**: Zustand store manages API calls
2. **State Management**: Reactive updates across components
3. **Filtering**: Client-side filtering with instant results
4. **Error Handling**: Graceful fallbacks and error boundaries

### **Internationalization**
- **Dynamic Text**: All text uses `getText()` function
- **Cultural Formatting**: Thai-specific date/number formatting
- **Responsive Fonts**: Optimized typography for both languages

### **Theme System**
- **CSS Variables**: Dynamic color switching
- **Persistent Storage**: Theme preference saved locally
- **Smooth Transitions**: Animated theme changes
- **System Preference**: Respects OS dark/light mode

### **Performance Optimizations**
- **Lazy Loading**: Components loaded on demand
- **Image Optimization**: Next.js automatic optimization
- **Bundle Splitting**: Efficient code splitting
- **Caching**: Smart API response caching

## 🚀 Deployment

### **Vercel (Recommended)**
```bash
# Connect your GitHub repo to Vercel
# Environment variables will be configured in Vercel dashboard
vercel
```

### **Netlify**
```bash
# Build command: npm run build
# Publish directory: .next
netlify deploy --prod
```

### **Manual Deployment**
```bash
npm run build
npm run start

# Or serve the .next folder with any static host
```

### **Environment Setup**
```bash
# Production environment variables
NEXT_PUBLIC_API_BASE_URL=https://your-api-domain.com
NEXT_PUBLIC_SITE_URL=https://your-frontend-domain.com
```

## 🔧 Customization

### **Brand Colors**
Update `tailwind.config.js` to customize the color scheme:

```javascript
theme: {
  extend: {
    colors: {
      primary: { /* Your grayscale palette */ },
      accent: { /* Your brand color */ },
      thai: { /* Your cultural accent */ },
    }
  }
}
```

### **Typography**
Modify font imports in `globals.css`:

```css
@import url('https://fonts.googleapis.com/css2?family=Your+Font:wght@400;700&display=swap');
```

### **Layout**
Adjust component layouts in `src/components/layout/`:
- `Navigation.tsx` - Top navigation bar
- `Sidebar.tsx` - Side navigation menu  
- `Footer.tsx` - Site footer

## 📱 Responsive Design

### **Breakpoints**
```css
sm:  640px    /* Small tablets */
md:  768px    /* Tablets */
lg:  1024px   /* Laptops */
xl:  1280px   /* Desktops */
2xl: 1536px   /* Large screens */
```

### **Mobile-First Approach**
- Base styles target mobile devices
- Progressive enhancement for larger screens
- Touch-friendly interface elements
- Optimized for thumb navigation

## 🔍 Troubleshooting

### **Common Issues**

1. **API Connection Failed**
   ```bash
   # Check if backend is running
   curl http://localhost:8000/api/news
   
   # Verify environment variables
   echo $NEXT_PUBLIC_API_BASE_URL
   ```

2. **Build Errors**
   ```bash
   # Clear Next.js cache
   rm -rf .next
   npm run build
   ```

3. **TypeScript Errors**
   ```bash
   # Run type checking
   npm run type-check
   
   # Check for missing dependencies
   npm install
   ```

4. **Styling Issues**
   ```bash
   # Rebuild Tailwind CSS
   npx tailwindcss build
   ```

### **Development Tips**

- **Hot Reload**: Changes auto-refresh during development
- **Error Overlay**: Detailed error information in development
- **React DevTools**: Install browser extension for debugging
- **Zustand DevTools**: Enable for state debugging

## 🎯 Production Checklist

- [ ] Environment variables configured
- [ ] API endpoints responding correctly
- [ ] Images and assets optimized
- [ ] SEO meta tags updated
- [ ] Performance tested (Lighthouse)
- [ ] Accessibility validated
- [ ] Cross-browser testing completed
- [ ] Mobile responsiveness verified

## 📄 License

This frontend is part of the TrendSiam project. See the main project LICENSE for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

**Built with ❤️ for the Thai news community using modern web technologies.**