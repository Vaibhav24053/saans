# SAANS — Know the air. Change your day.

**SAANS** is a GenAI-powered personal and family urban air-quality companion built for **PromptWars Challenge 6: Urban Air Quality Assistant**.

Instead of displaying a lone AQI number, SAANS translates live modelled environmental data and hourly forecasts into a **personalised daily action plan**, tailored indoor air coaching, honest exposure-vs-emissions tracking, and a grounded conversational assistant (**Ask SAANS**).

---

## Key Features

- **Personalised Household Onboarding & Editable Profile**: Captures location (search or optional GPS), household composition (adults, children, older adults), optional non-medical sensitivity preference, commute mode & distance, typical outdoor timings, home type, air-purifier ownership, ventilation, cooking fuel, and sustainability/budget focus. All preferences persist locally in `localStorage`.
- **Today Dashboard & YOUR AIR ACTION PLAN**: Presents current US EPA AQI / European AQI (explicitly labelled, never silently converted), PM2.5 & PM10 concentrations, dominant pollutant, 6-hour trend, and a prominent personalised action plan highlighting what to avoid, what to prioritise, a relatively lower-pollution forecast window, and one immediate action.
- **AI Daily Planner (Gemini 3.5 Flash-Lite + Transparent Fallback)**: Generates a structured **Morning / Afternoon / Evening / Tomorrow** schedule using the official `@google/genai` SDK (`gemini-3.5-flash-lite`) with strict JSON schema output + Zod validation. Every recommendation cites its data/household triggers and clearly distinguishes `Personal Exposure` from `Wider Emissions`.
- **Air Quality Intelligence**: Interactive 24h & 48h forecast charts (US AQI, European AQI, PM2.5, PM10), peak & lower window identification, and 5-pollutant cards (`PM2.5`, `PM10`, `NO₂`, `SO₂`, `O₃`) with clickable educational popovers.
- **Make Your Home Air-Ready (Indoor Air Coach)**: Forecast-driven window timing, kitchen exhaust/cooking guidance, smoke/dust reduction, and practical zero-cost indoor protection (never pushing unnecessary equipment purchases).
- **Your Choices. Your Impact.**: Separates qualitative **Household Exposure Strategy** from a **Low-Emission Commute Scenario Calculator** backed by documented **UK DESNZ / DEFRA 2024 Reference GHG Conversion Factors** (clearly labelled as UK reference benchmarks, not India-specific factors), plus local **Weekly Family Challenges** with streak tracking.
- **Ask SAANS Assistant**: Multi-turn, grounded Q&A that cites exact supplied readings and explicitly distinguishes Gemini AI responses from SAANS's rules-based fallback.
- **Hackathon Demo Mode & Guided Tour**: Includes 3 labelled sample scenarios (*Moderate Urban Haze*, *Severe Winter Smog*, *Worsening Evening Inversion*), 3 instant household personas (*Young Family*, *Two-Wheeler + Senior*, *WFH Cyclist*), and a 7-step Guided Demo Walkthrough.

---

## Architecture

```text
├── shared/                   # Shared TypeScript types, AQI utilities, DEFRA emission factors, Demo scenarios
├── server/
│   ├── lib/airQuality.ts     # Open-Meteo Geocoding + Air Quality API client with 10m TTL cache
│   ├── lib/gemini.ts         # Official @google/genai server-side client + Zod output validation
│   ├── lib/fallbackEngine.ts # Transparent, personalised rules-based fallback when GEMINI_API_KEY is unset
│   ├── handlers/router.ts    # Unified API router used by Vite dev, Express prod, and Vercel functions
│   └── index.ts              # Production Express server (serves dist/ + /api/*)
├── api/                      # Vercel serverless route adapters (/api/health, /geocode, /air-quality, /daily-plan, /ask)
└── src/
    ├── context/SaansContext.tsx
    ├── services/api.ts
    ├── components/           # Onboarding, Location modal, Profile drawer, Demo bar, Guided tour, Badges
    └── views/                # Overview, Planner, Air Intelligence, Indoor Coach, Impact, Ask SAANS
```

---

## Local Setup

### Prerequisites
- Node.js 20+ and npm 10+
- Optional: a free **Gemini Developer API key** from [Google AI Studio](https://aistudio.google.com/apikey)

### Installation & Run

```bash
npm install
cp .env.example .env
# Optional: add GEMINI_API_KEY=your_key_here inside .env
npm run dev
```

Open `http://localhost:5173`. Both the React frontend and `/api/*` server endpoints run seamlessly on the same dev server.

> **No Gemini API key yet?** SAANS still works end-to-end using its transparent, personalised rules-based engine and clearly badges responses as **Rules-Based Fallback** so the UI never pretends fallback output came from Gemini.

### Typecheck & Production Build

```bash
npm run typecheck
npm run build
npm start
```

---

## API & Data Integrity

- **Environmental Data & Attribution**: Air quality forecasts provided by [Open-Meteo.com](https://open-meteo.com/en/docs/air-quality-api) using the **Copernicus Atmosphere Monitoring Service (CAMS)** (CC BY 4.0) — free tier, no API key required.
- **Model Domain & Spatial Resolution**: For India and all non-European locations, SAANS explicitly queries the **CAMS Global Atmospheric Composition Forecast** (`cams_global`, `0.4°` / `~45 km` spatial resolution). For European locations, SAANS queries `cams_europe` (`0.1°` / `~11 km`). European resolution is never displayed for Indian cities.
- **Honest Labelling**: Modelled atmospheric forecasts are explicitly distinguished from official CPCB ground monitoring stations. US EPA AQI (0–500) and European AQI are labelled separately and never silently converted into Indian CPCB AQI.
- **Sustainability Methodology**: Transport CO₂e comparisons use documented **UK Government (DESNZ / DEFRA) 2024 GHG Conversion Factors** explicitly disclosed as UK reference benchmarks rather than India-specific factors.
- **AI Guardrails**: All Gemini calls execute server-side (`gemini-3.5-flash-lite` via `@google/genai`, `process.env.GEMINI_API_KEY` is never exposed to frontend code). Outputs are schema-constrained, Zod-validated, grounded in supplied readings, handle rate limits (`429`), invalid keys (`401`/`403`), and unavailable models (`404`) gracefully, avoid medical diagnoses, never claim a forecast period is "completely safe", and never claim individual household habits immediately reduce ambient city AQI.

---

## Deployment (Free-Tier Friendly)

### Option 1: Vercel
1. Push this repository to GitHub and import it into [Vercel](https://vercel.com).
2. Add `GEMINI_API_KEY` in **Project Settings → Environment Variables**.
3. Deploy — `vercel.json` and `api/*.ts` automatically serve the React app and serverless `/api/*` endpoints.

### Option 2: Render / Railway
1. Connect the repository as a Web Service.
2. Build Command: `npm install && npm run build`
3. Start Command: `npm start`
4. Set `GEMINI_API_KEY` in Environment Variables.
