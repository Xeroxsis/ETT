# Smart Study Planner — PRD

## Problem Statement
Build a Smart Study Planner application for students (high school, college, professional certifications).

## Architecture
- **Frontend:** React + TailwindCSS + Shadcn UI (port 3000)
- **Backend:** FastAPI + MongoDB (port 8001, /api prefix)
- **AI:** Gemini Flash (gemini-3-flash-preview) via emergentintegrations
- **Auth:** JWT in httpOnly cookies (7d access, 30d refresh)

## User Personas
- High school / college students needing structured study schedules
- Professional certification candidates (UPSC, CPA, etc.)
- Self-learners wanting accountability & progress tracking

## Core Requirements (Static)
1. Email/password authentication
2. Study session scheduling with calendar view
3. Subject & topic management with progress tracking
4. Pomodoro timer (25/5/15 min cycle) with session logging
5. AI-powered study plan generation
6. Dashboard with streak, weekly stats, upcoming sessions
7. Light/dark theme toggle

## What's Been Implemented (2026-03-31)
- Full JWT auth (register, login, logout, refresh, brute-force protection)
- Admin seed: admin@smartplanner.com / admin123
- Subject CRUD with color picker
- Topic CRUD with completion toggle & progress bars
- Study sessions (schedule, complete, delete) with Calendar view
- Pomodoro timer with SVG ring, mode switching, stats logging to backend
- AI study plan generation & saved plans list (Gemini Flash)
- Dashboard: streak card, total hours, weekly chart (recharts), subject progress
- Responsive navbar with mobile menu, theme toggle, user dropdown
- Light/dark theme (orange primary #F97316, emerald secondary #10B981)
- Fonts: Manrope (headings), IBM Plex Sans (body), JetBrains Mono (mono)

## Prioritized Backlog

### P0 (Critical - Next Sprint)
- [ ] Flashcard / quiz mode per subject topic
- [ ] Email/push reminders for scheduled sessions

### P1 (High Value)
- [ ] Export AI plan to PDF
- [ ] Notes rich text editor for topics
- [ ] Study session recurring scheduling
- [ ] Analytics page (time per subject, completion rates)

### P2 (Nice to Have)
- [ ] Social/sharing features (share streak)
- [ ] Google Calendar sync
- [ ] Study groups / collaborative subjects
- [ ] Spaced repetition algorithm for topics

## Test Credentials
- Admin: admin@smartplanner.com / admin123
- Test user: testuser@example.com / testpass123

## Key Files
- Backend: /app/backend/server.py
- Frontend: /app/frontend/src/
  - App.js (routing)
  - contexts/AuthContext.js, ThemeContext.js
  - pages/Dashboard.jsx, CalendarPage.jsx, SubjectsPage.jsx, PomodoroPage.jsx, AIPlanner.jsx
  - components/Navbar.jsx
