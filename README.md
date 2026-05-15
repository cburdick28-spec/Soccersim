# Pocket Manager Online

Pocket Manager Online is a browser-first football management simulation built with Next.js 15, TypeScript, Tailwind CSS, Zustand, Supabase, and PWA support.

## Features

- Solo and multiplayer career entry flows
- Username + password auth mapped internally to `username@pocketmanager.local`
- Guest local-only mode
- EN/ES instant localization
- Difficulty presets with solo-only sandbox cheat controls
- Multiplayer lobby creation/join UI with invite codes
- Live match screen with real-time minute ticks, halftime pause, tactical controls, substitutions, and event feed
- Match persistence flow writing `matches`, updating `standings`, and applying post-match player morale/form changes
- International offer logic tied to manager reputation
- Retirement-to-manager conversion logic (~5%)
- Supabase relational runtime flow using gameplay tables (`players`, `clubs`, `leagues`, `matches`, `standings`)
- PWA install support (`manifest.webmanifest`, offline route, `next-pwa`)
- Vercel-ready serverless architecture

## Stack

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- Zustand
- Supabase (`@supabase/supabase-js`, `@supabase/ssr`)
- `next-pwa`

## Local Development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Configure env vars:

   ```bash
   cp .env.example .env.local
   ```

3. Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

4. Run development server:

   ```bash
   npm run dev
   ```

5. Open `http://localhost:3000`.

## Supabase Setup

1. Create a Supabase project.
2. Disable email confirmation in Auth settings for username/password flow.
3. Run SQL scripts in order:
   - `/supabase/schema.sql`
   - `/supabase/seed.sql`
4. Enable Realtime for `multiplayer_lobbies`, `messages`, and `notifications` tables.

## Testing & Quality

```bash
npm run lint
npm run test
npm run build
```

## Deployment (Vercel)

1. Import GitHub repository into Vercel.
2. Add required environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Deploy with default Next.js settings.
4. Confirm installability via browser “Install App” prompt.

## Notes on Multiplayer Cheat Enforcement

- Client flow disables cheats in multiplayer for regular users.
- Supabase policy `league_settings_no_cheat` enforces server-side restriction.
