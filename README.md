# Quietcare — Frontend Prototype

Quietcare is a mobile-first caregiver experience that turns a parent’s prescription and available medicines into a clear routine, printable pouch labels, packing guidance, and reminder setup.

This repository contains the frontend handoff for the complete happy-flow prototype. Prescription reading, medicine matching, camera capture, and Telegram connection are intentionally simulated so the interaction can be demonstrated reliably without external services.

## Run locally

Requirements: Node.js 20 or newer and npm.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Every fresh load begins on the Welcome screen.

Validate the code with:

```bash
npm run check
```

## Prototype flow

1. Welcome and prescription upload
2. Prescription review and timing correction
3. Medicine-photo upload and match review
4. Routine personalisation
5. Pouch-label creation and packing guidance
6. Simulated Telegram connection
7. Final caregiver Home screen

The file picker works locally and displays the selected filename. No file is transmitted because this handoff is frontend-only.

## Project structure

```text
app/
  fonts/                   # self-hosted Manrope font files
  globals.css              # design tokens and complete responsive UI
  layout.tsx               # application shell and metadata
  page.tsx                 # Quietcare entry page
components/
  quietcare/
    quietcare-app.tsx      # complete interactive happy flow
    icons.tsx              # asset-backed icon components
  ui/
    button.tsx             # reusable button primitive
data/
  mock-data.ts             # demonstration patient and medicine content
docs/
  DESIGN_SYSTEM.md         # colors, typography, spacing, and components
  CODEX_CONTEXT.md         # implementation handoff notes
lib/
  routine.ts               # medicine coverage calculation
public/assets/
  brand/                   # Quietcare logo
  icons/                   # interface icons
  illustrations/           # onboarding and Telegram artwork
  images/                  # prescription, medicine, and home visuals
  pouch-labels/            # final pouch-label artwork
types/
  quietcare.ts             # shared TypeScript domain types
```

## Design system

The implementation uses a self-hosted Manrope family, a 390 px mobile canvas, a 24 px primary gutter, reusable pill buttons, fixed bottom actions, progress headers, form controls, cards, sheets, medicine tags, packing rows, and a floating action button.

The complete design reference is in [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md). All visual assets used by the prototype are committed under [public/assets](public/assets).

## Technology

- Next.js 16 App Router
- React 19
- TypeScript
- Plain responsive CSS with shared design tokens
- Next.js Image for optimized local assets

## Handoff boundary

This is deliberately a frontend prototype. A future implementation can connect the existing screens to OCR, authentication, a database, object storage, and Telegram without redesigning the interaction flow.
# Quietcare
