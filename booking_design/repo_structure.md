# Repository Structure Proposal

We recommend initializing a **Vite + React + TypeScript** project. 
This can live in a subdirectory (e.g., `booking-app/`) or be the new root if migrating.
Assuming a "Monorepo" style where `gleeye-erp` root stays, and we add the new module:

```
gleeye-erp/
├── booking-app/                <-- NEW MODULE (React + TS)
│   ├── package.json            (Dependencies: react, vite, date-fns, supabase-js, tailwindcss)
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   └── src/
│       ├── main.tsx            (Entry point)
│       ├── App.tsx             (Router & Layout)
│       ├── api/                (Supabase integration)
│       │   ├── supabaseClient.ts
│       │   ├── bookingApi.ts   (fetchServices, createBooking)
│       │   └── calendarApi.ts  (Google/Apple sync logic)
│       ├── components/         (Reusable UI)
│       │   ├── ui/             (Button, Card, Input - ShadCN style)
│       │   ├── calendar/       (WeekView, MonthView)
│       │   └── forms/          (BookingForm, AvailabilityEditor)
│       ├── features/           (Domain Modules)
│       │   ├── booking/        (Public Booking Flow)
│       │   │   ├── ServiceList.tsx
│       │   │   ├── SlotPicker.tsx
│       │   │   └── Confirmation.tsx
│       │   ├── admin/          (Admin Dashboard)
│       │   │   ├── ServiceManager.tsx
│       │   │   └── BookingTable.tsx
│       │   └── collaborator/   (Staff Dashboard)
│       │       ├── AvailabilitySettings.tsx
│       │       └── CalendarSync.tsx
│       ├── lib/                (Utilities)
│       │   ├── availability.ts (The Core Algo)
│       │   └── formatting.ts
│       └── types/
│           └── index.ts        (Shared interfaces: Service, Slot, User)
├── supabase/                   <-- EXISTING/SHARED
│   ├── migrations/             (Add new booking tables here)
│   └── functions/              (Edge Functions)
│       ├── sync-calendar/      (Node.js logic for ICS fetching)
│       └── send-email/         (Confirmation emails)
└── js/                         <-- EXISTING LEGACY APP
```

## Key Files Commentary

### `src/types/index.ts`
Centralizes your Data Model types so frontend components (Admin vs User) speak the same language.

### `src/lib/availability.ts`
Ideally, this logic runs on the **Backend** (Supabase Edge Function / Postgres Function) for security and performance, but can share code with Frontend for optimistic UI updates. 
*Recommendation*: Write the heavy lifting in a Postgres Database Function (PL/pgSQL) or a Supabase Edge Function (Deno/Node) to ensure no "overbooking" happens due to client-side lag.

### `src/features/collaborator/CalendarSync.tsx`
Handles the OAuth flow.
1. Button `Connect Google`.
2. Redirects to `https://accounts.google.com/o/oauth2/v2/auth...`.
3. Callback route `/auth/callback` exchanges code for tokens.
4. Stores tokens in `external_calendar_connections` (Encrypted!).

### State Management
Use `Zustand` or `React Context` for the booking wizard state (SelectedService -> SelectedSlot -> UserDetails).
