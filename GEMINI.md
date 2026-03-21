# GEMINI.md

This file serves as the primary instructional context and architectural guide for Gemini CLI when working in this repository.

---

# 🚀 Project Overview

**Project Name:** hotManhwammhub
**Type:** Professional Telegram Mini App (TMA)
**Framework:** Next.js (Page Router)
**Styling:** Tailwind CSS + shadcn/ui (Dark Mode First)
**Integration:** Telegram Mini App via @telegram-apps/sdk

---

# 🎯 Project Goal

Build a **clean, mobile-first manhwa platform** optimized for the Telegram ecosystem, focusing on a direct "browse and read" experience.

### Core Features:

- 📖 **Infinite Vertical Reader:** Optimized for high-resolution manhwa strips.
- 🔍 **Simple Discovery:** A clean home page featuring a curated list of manhwas.
- 💎 **Virtual Economy:** Seamless coin-based unlocking system.
- 💳 **Myanmar Payment Hub:** Integrated flow for KBZPay, WaveMoney with screenshot verification.
- 🔔 **Push Notifications:** Alert users via Bot when new chapters drop.

---

# 🧠 Architecture Overview

```text
[ Telegram App ] ↔ [ TMA SDK ] ↔ [ Next.js Frontend (shadcn/ui) ]
                                         ↓
                                [ NestJS Backend API ]
```

---

# ⚙️ Tech Stack & UI Kits

### Frontend:
- **Next.js (Page Router):** For robust routing and SSR capabilities.
- **TypeScript:** Strict typing for all API responses and component props.
- **Tailwind CSS:** Utility-first styling.
- **shadcn/ui:** Core component library (Buttons, Dialogs, Sheets, Cards).
- **Framer Motion:** For smooth transitions and "app-like" feel.
- **Lucide React:** Iconography.

### Auth & State:
- **Better Auth:** For secure session management and authentication.
- **@telegram-apps/sdk:** Modern interaction with Telegram.
- **Zustand:** For global client state (User, Coins).
- **Axios/Fetch:** For clean, service-based API communication in `api/`.

---

# 🔐 Authentication Workflow (Better Auth + Telegram)

We use **Better Auth** to manage user sessions after verifying the Telegram `initData`.

1. **Initialization:** On app load, the frontend sends the Telegram `initData` to the backend.
2. **Verification:** The backend validates the `initData` using the Bot Token.
3. **Session:** **Better Auth** creates a secure session for the user, allowing for persistent authentication beyond the Telegram lifecycle if needed.
4. **Usage:** Use the `useSession()` hook from Better Auth to access user data and protect routes.

---

# ⚙️ Configuration & Environment

The following environment variables are required for the application to function correctly. Ensure these are set in your `.env` or `.env.local` file.

| Variable | Description |
| :--- | :--- |
| `BETTER_AUTH_API_KEY` | API Key for Better Auth integration and secure session management. |
| `NEXT_PUBLIC_API_URL` | The base URL for the NestJS Backend API. |
| `NEXT_PUBLIC_TELEGRAM_BOT_TOKEN` | (Optional/Local) For local testing of Telegram data validation. |

---

# 🎨 UI/UX & Design System (Premium Dark Theme)

### Theme Strategy:
- **Default:** Forced Dark Mode (`class="dark"`).
- **Background:** `Zinc-950` (Deep, modern look).
- **Primary Accent:** `Violet-600` (Premium feel).
- **Secondary/Action:** `Amber-400` (For coins and premium CTAs).

### shadcn/ui Customization:
- **Radius:** `0.75rem` (xl) for a modern, rounded mobile feel.
- **Components:** Use `Drawer` for mobile actions and `Skeleton` for loading states.

---

# 📱 Page Structure (Next.js Page Router)

- `/` → **Home:** Simple, scrollable grid of manhwa covers with titles and ratings.
- `/manhwa/[slug]` → **Details:** Synopsis, Chapter list, "Read Now" CTA.
- `/reader/[chapterId]` → **The Reader:** Pure focus mode, vertical scroll, chapter nav.
- `/shop` → **Top-up:** Visual grid of coin packages (shadcn Cards).
- `/profile` → **Account:** Coin balance, Transaction history, and Telegram info.

---

# 💰 Payment & Monetization Flow

1. **Selection:** User picks a package (e.g., "50 Coins - 5,000 MMK").
2. **Instructions:** Show a shadcn `Dialog` with payment details (KBZPay/Wave QR).
3. **Verification:**
   - User uploads screenshot.
   - Frontend sends data to Backend.
   - Backend notifies Admin via Telegram Bot for approval.
4. **Fulfillment:** User receives a Telegram notification when coins are added.

---

# 🔐 Telegram Integration Workflow

### Initialization (`_app.tsx`):
```tsx
import { init, backButton } from '@telegram-apps/sdk';

// Initialize SDK and expand app to full height
const lp = init();
lp.themeParams.bind();
lp.viewport.expand();
```

---

# 🏗️ Modular API Architecture (Strict)

All data fetching and backend interactions must be organized into a dedicated `api/` directory, separated by domain. This ensures clean separation of concerns and easy maintenance.

### Structure:
- `api/users/index.ts` → Auth, Balance, Profile, User History.
- `api/manhwa/index.ts` → Discovery, Details, Search, Genres.
- `api/episodes/index.ts` → Chapter content, Unlock logic, Reader settings.
- `api/payments/index.ts` → Coin packages, Transaction requests, Screenshot uploads.

### Implementation Pattern:
Each file should export:
1. **TypeScript Interfaces** for Request and Response.
2. **Service Functions** using a standard `fetch` or `axios` wrapper.

---

# ⚠️ Development Rules (Strict)

### 1. shadcn/ui Usage
- Do not reinvent components. Check `components/ui` first.
- Use `npx shadcn-ui@latest add [component]` to add new parts.

### 2. Mobile Performance
- Manhwa images must be **lazy-loaded** to prevent memory crashes.
- Use `next/image` with proper `sizes` attribute.
- Minimum touch target size: `44x44px`.

### 3. State & Data Fetching (Modular API)
- **No React Query:** Use the modular service pattern in `api/`.
- **Standard Hooks:** Use `useEffect` and `useState` for component-level fetching.
- **Global State:** Use **Zustand** for shared state like user data and coin balance.

---

# 🧪 Scripts

```bash
# Setup
npm install

# UI Components
npx shadcn-ui@latest init
npx shadcn-ui@latest add button card dialog drawer scroll-area skeleton tabs

# Run
npm run dev
```

---

# 🧠 AI Instructions (Gemini)

When generating code:
1. **Modular API Services:** Always create or update `api/[module]/index.ts` for data fetching. Never inline `fetch` or `axios` calls in components.
2. **Prefer shadcn/ui:** Use existing components from `@/components/ui`.
3. **Dark Mode First:** Use `dark:` classes or assume a Zinc-950 background.
4. **Mobile First:** Everything must look perfect on a 390x844px viewport.
5. **Animations:** Use Framer Motion for `AnimatePresence` on page transitions and modal entries.
6. **Next.js Patterns:** Use Page Router conventions (`pages/`, `getServerSideProps`).
