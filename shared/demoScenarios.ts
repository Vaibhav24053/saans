import { computeAirQualitySummary } from './aqi.js';
import type {
  AirQualityData,
  ChallengeItem,
  DemoPersonaId,
  DemoScenarioId,
  HouseholdProfile,
  HourlyAirPoint,
} from './types.js';

export interface DemoScenarioMeta {
  id: DemoScenarioId;
  name: string;
  shortLabel: string;
  cityLabel: string;
  tagline: string;
  badgeText: string;
  highlights: string;
}

export const DEMO_SCENARIOS: DemoScenarioMeta[] = [
  {
    id: 'moderate_haze',
    name: 'Moderate Urban Haze',
    shortLabel: 'Moderate Haze',
    cityLabel: 'Bengaluru (Sample)',
    tagline: 'US AQI ~88 · Manageable daytime air with mild evening traffic buildup',
    badgeText: 'Moderate · 88 US AQI',
    highlights: 'Shows balanced ventilation, active commuting options, and light exposure precautions.',
  },
  {
    id: 'severe_winter_smog',
    name: 'Severe Winter Smog',
    shortLabel: 'Severe Smog',
    cityLabel: 'New Delhi (Sample)',
    tagline: 'US AQI ~268 · Heavy winter PM2.5 inversion with brief afternoon dip',
    badgeText: 'Very Unhealthy · 268 US AQI',
    highlights: 'Triggers urgent indoor protection, rescheduled activity, HEPA/no-purifier guidance, and mask alerts.',
  },
  {
    id: 'worsening_inversion',
    name: 'Worsening Evening Inversion',
    shortLabel: 'Worsening Forecast',
    cityLabel: 'Lucknow (Sample)',
    tagline: 'US AQI rising 92 → 224 · Clearer morning window before evening smog trap',
    badgeText: 'Worsening · 92 → 224 AQI',
    highlights: 'Demonstrates forecast-driven scheduling: air out home early, finish errands before dusk.',
  },
];

export interface DemoPersonaMeta {
  id: DemoPersonaId;
  name: string;
  subtitle: string;
  profile: Omit<HouseholdProfile, 'location' | 'onboardingCompleted'>;
}

export const DEMO_PERSONAS: DemoPersonaMeta[] = [
  {
    id: 'young_family',
    name: 'Meera & Aarav (Young Family)',
    subtitle: '2 adults, 1 child · Car commute · Apartment · No purifier',
    profile: {
      householdName: 'Meera & Aarav’s Home',
      adults: 2,
      children: 1,
      olderAdults: 0,
      respiratorySensitivity: 'mild',
      commuteType: 'car',
      commuteDistanceKm: 12,
      outdoorWindow: 'evening',
      homeType: 'apartment',
      hasAirPurifier: false,
      ventilationOption: 'cross_ventilation',
      cookingFuel: 'lpg_gas',
      sustainabilityFocus: 'balanced',
      budgetPreference: 'moderate',
    },
  },
  {
    id: 'commuter_senior',
    name: 'Rohan & Dad (Two-Wheeler + Senior)',
    subtitle: '2 adults, 1 older adult (elevated sensitivity) · Two-wheeler · HEPA purifier',
    profile: {
      householdName: 'Rohan’s Household',
      adults: 2,
      children: 0,
      olderAdults: 1,
      respiratorySensitivity: 'elevated',
      commuteType: 'two_wheeler',
      commuteDistanceKm: 9,
      outdoorWindow: 'early_morning',
      homeType: 'independent_house',
      hasAirPurifier: true,
      ventilationOption: 'exhaust_fan',
      cookingFuel: 'lpg_gas',
      sustainabilityFocus: 'exposure_first',
      budgetPreference: 'moderate',
    },
  },
  {
    id: 'wfh_cyclist',
    name: 'Ananya (WFH + Evening Cyclist)',
    subtitle: '1 adult · Work from home · Evening cycling · Low-emission priority',
    profile: {
      householdName: 'Ananya’s Studio',
      adults: 1,
      children: 0,
      olderAdults: 0,
      respiratorySensitivity: 'none',
      commuteType: 'wfh',
      commuteDistanceKm: 6,
      outdoorWindow: 'evening',
      homeType: 'apartment',
      hasAirPurifier: false,
      ventilationOption: 'cross_ventilation',
      cookingFuel: 'induction_electric',
      sustainabilityFocus: 'low_emission_priority',
      budgetPreference: 'zero_cost',
    },
  },
];

export const DEFAULT_CHALLENGES: ChallengeItem[] = [
  {
    id: 'cleaner_commute',
    title: 'One cleaner commute this week',
    description:
      'Replace at least one solo car or two-wheeler trip with metro, bus, carpool, or a remote workday.',
    category: 'commute',
    impactType: 'wider_emissions',
    impactNote: 'Directly lowers personal transport CO₂e and tailpipe exhaust.',
    weeklyTarget: 2,
  },
  {
    id: 'zero_idling',
    title: 'Avoid unnecessary vehicle idling',
    description:
      'Switch off the engine at traffic signals over 30 seconds and while waiting at school or market pickups.',
    category: 'commute',
    impactType: 'both',
    impactNote: 'Cuts localized roadside exhaust plumes and saves fuel immediately.',
    weeklyTarget: 5,
  },
  {
    id: 'combine_errands',
    title: 'Combine two errands into one trip',
    description:
      'Batch grocery, pharmacy, and school-run trips into a single planned route during a lower-pollution window.',
    category: 'commute',
    impactType: 'both',
    impactNote: 'Fewer cold starts mean lower emissions and less time spent in traffic air.',
    weeklyTarget: 2,
  },
  {
    id: 'clean_cooking_vent',
    title: 'Ventilate during cooking',
    description:
      'Run the kitchen exhaust or open the kitchen window while closing bedroom doors during high-heat cooking.',
    category: 'clean_air_habit',
    impactType: 'personal_exposure',
    impactNote: 'Reduces indoor PM2.5 and NO₂ buildup inside living spaces.',
    weeklyTarget: 5,
  },
  {
    id: 'smart_energy_evening',
    title: 'Trim avoidable evening energy draw',
    description:
      'Shift non-essential heavy appliances and standby loads during evening peak demand hours.',
    category: 'home_energy',
    impactType: 'wider_emissions',
    impactNote: 'Lowers peak-hour fossil generation demand on regional grids.',
    weeklyTarget: 3,
  },
];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function buildLocalDateStr(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function buildScenarioHourly(scenarioId: DemoScenarioId): {
  hourly: HourlyAirPoint[];
  currentTimeLocal: string;
  currentIdx: number;
} {
  const now = new Date();
  // Anchor demo "current hour" neatly to local hour (clamped to a realistic daytime hour for worsening scenario clarity if needed, or actual local hour)
  const currentHour = now.getHours();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

  const hourly: HourlyAirPoint[] = [];

  for (let offset = 0; offset < 48; offset++) {
    const dt = new Date(today.getTime() + offset * 3600 * 1000);
    const h = dt.getHours();
    const isTomorrow = offset >= 24;
    const time = `${buildLocalDateStr(dt)}T${pad2(h)}:00`;

    let usAqi = 85;
    let pm25 = 28;
    let pm10 = 54;
    let no2 = 24;
    let so2 = 9;
    let o3 = 52;

    if (scenarioId === 'moderate_haze') {
      // Mild morning traffic bump, cleaner midday, moderate evening rise
      const morningBump = Math.exp(-Math.pow((h - 9) / 2.5, 2)) * 18;
      const eveningBump = Math.exp(-Math.pow((h - 20) / 3, 2)) * 22;
      const middayDip = Math.exp(-Math.pow((h - 14) / 2.8, 2)) * -18;
      const tomorrowShift = isTomorrow ? -8 : 0;

      usAqi = Math.round(84 + morningBump + eveningBump + middayDip + tomorrowShift);
      pm25 = Math.round((usAqi * 0.33) * 10) / 10;
      pm10 = Math.round((pm25 * 1.95) * 10) / 10;
      no2 = Math.round((22 + morningBump * 0.8 + eveningBump * 0.9) * 10) / 10;
      so2 = Math.round((8.5 + (h >= 18 ? 2.5 : 0)) * 10) / 10;
      o3 = Math.round((38 + Math.exp(-Math.pow((h - 15) / 3, 2)) * 46) * 10) / 10;
    } else if (scenarioId === 'severe_winter_smog') {
      // Classic North Indian winter inversion: extreme morning/night PM2.5, modest afternoon boundary-layer lift that still stays Very Unhealthy
      const afternoonRelief = Math.exp(-Math.pow((h - 15) / 2.6, 2)) * -58;
      const morningPeak = Math.exp(-Math.pow((h - 8) / 2.8, 2)) * 44;
      const nightTrap = h >= 21 || h <= 5 ? 30 : 0;
      const tomorrowShift = isTomorrow ? -18 : 0;

      usAqi = Math.round(
        Math.max(208, 276 + morningPeak + afternoonRelief + nightTrap + tomorrowShift),
      );
      pm25 = Math.round((usAqi * 0.82) * 10) / 10;
      pm10 = Math.round((pm25 * 1.56) * 10) / 10;
      no2 = Math.round((56 + morningPeak * 0.6 + (nightTrap > 0 ? 18 : 0)) * 10) / 10;
      so2 = Math.round((24 + (nightTrap > 0 ? 6 : 0)) * 10) / 10;
      o3 = Math.round((24 + Math.exp(-Math.pow((h - 14) / 3, 2)) * 28) * 10) / 10;
    } else {
      // worsening_inversion: Starts moderate (90-100) in morning, steadily degrades through afternoon into heavy evening inversion (~225)
      if (!isTomorrow) {
        const ramp = Math.max(0, (h - 7) / 15);
        const curve = Math.pow(ramp, 1.45) * 136;
        const dawnBase = h < 7 ? 96 - h * 1.2 : 90;
        usAqi = Math.round(Math.min(238, dawnBase + curve));
      } else {
        // Tomorrow stays elevated early morning, then slowly disperses after noon
        const morningHold = Math.exp(-Math.pow((h - 7) / 3.5, 2)) * 42;
        const afternoonDrop = Math.exp(-Math.pow((h - 15) / 3.2, 2)) * -58;
        usAqi = Math.round(Math.max(125, 192 + morningHold + afternoonDrop));
      }
      pm25 = Math.round((usAqi * 0.62) * 10) / 10;
      pm10 = Math.round((pm25 * 1.65) * 10) / 10;
      no2 = Math.round((26 + (usAqi - 85) * 0.28) * 10) / 10;
      so2 = Math.round((11 + (usAqi - 85) * 0.08) * 10) / 10;
      o3 = Math.round((44 + Math.exp(-Math.pow((h - 14) / 3, 2)) * 34) * 10) / 10;
    }

    const europeanAqi = Math.round(Math.min(145, usAqi * 0.44));

    hourly.push({
      time,
      usAqi,
      europeanAqi,
      pm25,
      pm10,
      no2,
      so2,
      o3,
      usAqiPm25: usAqi,
      usAqiPm10: Math.round(usAqi * 0.84),
      usAqiNo2: Math.round(Math.min(130, no2 * 1.15)),
      usAqiSo2: Math.round(Math.min(90, so2 * 1.1)),
      usAqiO3: Math.round(Math.min(110, o3 * 0.85)),
    });
  }

  // For worsening_inversion, anchor current display hour to 10:00 AM if user opens late at night so the worsening curve is visibly ahead of them, otherwise use current hour
  const anchorHour =
    scenarioId === 'worsening_inversion' && (currentHour >= 19 || currentHour < 7)
      ? 10
      : currentHour;

  const currentIdx = Math.min(23, Math.max(0, anchorHour));
  const currentTimeLocal = hourly[currentIdx].time;

  return { hourly, currentTimeLocal, currentIdx };
}

export function buildDemoAirQualityData(scenarioId: DemoScenarioId): AirQualityData {
  const { hourly, currentTimeLocal, currentIdx } = buildScenarioHourly(scenarioId);
  const currentPt = hourly[currentIdx];

  const locationMap: Record<DemoScenarioId, AirQualityData['location']> = {
    moderate_haze: {
      name: 'Bengaluru',
      admin1: 'Karnataka',
      country: 'India',
      latitude: 12.9716,
      longitude: 77.5946,
      timezone: 'Asia/Kolkata',
      source: 'demo',
    },
    severe_winter_smog: {
      name: 'New Delhi',
      admin1: 'Delhi',
      country: 'India',
      latitude: 28.6139,
      longitude: 77.209,
      timezone: 'Asia/Kolkata',
      source: 'demo',
    },
    worsening_inversion: {
      name: 'Lucknow',
      admin1: 'Uttar Pradesh',
      country: 'India',
      latitude: 26.8467,
      longitude: 80.9462,
      timezone: 'Asia/Kolkata',
      source: 'demo',
    },
  };

  const meta = DEMO_SCENARIOS.find((s) => s.id === scenarioId) ?? DEMO_SCENARIOS[0];
  const current = {
    usAqi: currentPt.usAqi,
    europeanAqi: currentPt.europeanAqi,
    pm25: currentPt.pm25,
    pm10: currentPt.pm10,
    no2: currentPt.no2,
    so2: currentPt.so2,
    o3: currentPt.o3,
  };

  const summary = computeAirQualitySummary(current, hourly, currentTimeLocal);

  return {
    location: locationMap[scenarioId],
    fetchedAt: new Date().toISOString(),
    currentTimeLocal,
    timezone: 'Asia/Kolkata',
    isDemo: true,
    demoScenarioId: scenarioId,
    demoScenarioName: meta.name,
    modelDomain: 'demo',
    modelName: 'SAANS Illustrative Sample Dataset',
    spatialResolutionLabel: 'Simulated scenario (not live data)',
    attribution:
      'SAANS Demo Mode — Prepared sample dataset for demonstration only. Switch to Live Data for Open-Meteo / Copernicus CAMS forecasts.',
    dataSourceLabel: `Demo Scenario Dataset — ${meta.name}`,
    dataIntegrityNote:
      'Sample demonstration dataset illustrating urban pollution patterns on the US EPA AQI (0–500) and European AQI scales. Switch to Live Data anytime to query Open-Meteo (Copernicus CAMS Global ~45 km) modelled forecasts.',
    current,
    hourly,
    summary,
  };
}
