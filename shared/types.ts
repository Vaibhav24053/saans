import { z } from 'zod';

export type AqiScale = 'us_aqi' | 'european_aqi';

export type PollutantKey = 'pm25' | 'pm10' | 'no2' | 'so2' | 'o3';

export type RespiratorySensitivity = 'none' | 'mild' | 'elevated';

export type CommuteType =
  | 'public_transport'
  | 'car'
  | 'two_wheeler'
  | 'walking'
  | 'cycling'
  | 'wfh';

export type OutdoorWindowPref =
  | 'early_morning'
  | 'mid_morning'
  | 'afternoon'
  | 'evening'
  | 'flexible';

export type HomeType = 'apartment' | 'independent_house' | 'other';

export type VentilationOption =
  | 'cross_ventilation'
  | 'exhaust_fan'
  | 'ac_recirculate'
  | 'limited';

export type CookingFuel = 'lpg_gas' | 'induction_electric' | 'mixed';

export type SustainabilityFocus =
  | 'exposure_first'
  | 'balanced'
  | 'low_emission_priority';

export type BudgetPreference = 'zero_cost' | 'moderate' | 'flexible';

export type DemoScenarioId =
  | 'moderate_haze'
  | 'severe_winter_smog'
  | 'worsening_inversion';

export type DemoPersonaId = 'young_family' | 'commuter_senior' | 'wfh_cyclist';

export interface LocationInfo {
  name: string;
  admin1?: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
  source: 'geocoding' | 'geolocation' | 'demo';
}

export interface HouseholdProfile {
  householdName: string;
  location: LocationInfo;
  adults: number;
  children: number;
  olderAdults: number;
  respiratorySensitivity: RespiratorySensitivity;
  commuteType: CommuteType;
  commuteDistanceKm: number;
  outdoorWindow: OutdoorWindowPref;
  homeType: HomeType;
  hasAirPurifier: boolean;
  ventilationOption: VentilationOption;
  cookingFuel: CookingFuel;
  sustainabilityFocus: SustainabilityFocus;
  budgetPreference: BudgetPreference;
  onboardingCompleted: boolean;
}

export interface HourlyAirPoint {
  time: string; // ISO local datetime string e.g. "2026-11-23T15:00"
  usAqi: number | null;
  europeanAqi: number | null;
  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  so2: number | null;
  o3: number | null;
  usAqiPm25?: number | null;
  usAqiPm10?: number | null;
  usAqiNo2?: number | null;
  usAqiSo2?: number | null;
  usAqiO3?: number | null;
}

export interface AirWindow {
  startTime: string;
  endTime: string;
  avgUsAqi: number;
  peakUsAqi: number;
  avgPm25: number;
}

export interface AirQualitySummary {
  dominantPollutant: PollutantKey;
  dominantPollutantLabel: string;
  trendDirection: 'improving' | 'stable' | 'worsening';
  trendDelta6h: number;
  trendNote: string;
  peakWindow: AirWindow | null;
  lowerWindow: AirWindow | null;
  tomorrowOutlook: {
    avgUsAqi: number;
    maxUsAqi: number;
    minUsAqi: number;
    directionVsToday: 'better' | 'similar' | 'worse';
  } | null;
}

export type FallbackCode =
  | 'missing_key'
  | 'rate_limited'
  | 'invalid_credentials'
  | 'model_unavailable'
  | 'timeout'
  | 'validation_failed'
  | 'upstream_error';

export interface AirQualityData {
  location: LocationInfo;
  fetchedAt: string;
  currentTimeLocal: string;
  timezone: string;
  isDemo: boolean;
  demoScenarioId?: DemoScenarioId;
  demoScenarioName?: string;
  modelDomain: 'cams_global' | 'cams_europe' | 'demo';
  modelName: string;
  spatialResolutionLabel: string;
  attribution: string;
  dataSourceLabel: string;
  dataIntegrityNote: string;
  current: {
    usAqi: number | null;
    europeanAqi: number | null;
    pm25: number | null;
    pm10: number | null;
    no2: number | null;
    so2: number | null;
    o3: number | null;
  };
  hourly: HourlyAirPoint[];
  summary: AirQualitySummary;
}

export const PlanItemSchema = z.object({
  id: z.string(),
  title: z.string().min(2),
  action: z.string().min(4),
  whyRecommended: z.string().min(4),
  triggers: z.array(z.string()).min(1).max(4),
  expectedBenefit: z.string().min(4),
  impactCategory: z.enum(['personal_exposure', 'wider_emissions', 'both']),
  priority: z.enum(['high', 'medium', 'low']),
  timeframe: z.string(),
});

export const DailyPlanPayloadSchema = z.object({
  headline: z.string().min(5),
  heroSummary: z.object({
    currentConditions: z.string().min(10),
    avoidToday: z.array(z.string()).min(1).max(4),
    prioritiseToday: z.array(z.string()).min(1).max(4),
    bestLowerWindowNote: z.string().min(5),
    immediateAction: z.string().min(5),
  }),
  blocks: z.object({
    morning: z.array(PlanItemSchema).min(1).max(4),
    afternoon: z.array(PlanItemSchema).min(1).max(4),
    evening: z.array(PlanItemSchema).min(1).max(4),
    tomorrow: z.array(PlanItemSchema).min(1).max(4),
  }),
  transparencyNote: z.string().min(5),
});

export type PlanItem = z.infer<typeof PlanItemSchema>;
export type DailyPlanPayload = z.infer<typeof DailyPlanPayloadSchema>;

export interface DailyPlanResponse extends DailyPlanPayload {
  source: 'gemini' | 'fallback';
  model?: string;
  fallbackReason?: string;
  fallbackCode?: FallbackCode;
  generatedAt: string;
}

export const AskSaansPayloadSchema = z.object({
  answer: z.string().min(5),
  keyTakeaway: z.string().min(4),
  impactFraming: z.enum([
    'personal_exposure',
    'wider_emissions',
    'both',
    'informational',
  ]),
  dataPointsUsed: z.array(z.string()).max(6),
  followUpSuggestions: z.array(z.string()).max(4),
});

export type AskSaansPayload = z.infer<typeof AskSaansPayloadSchema>;

export interface AskSaansResponse extends AskSaansPayload {
  source: 'gemini' | 'fallback';
  model?: string;
  fallbackReason?: string;
  fallbackCode?: FallbackCode;
  generatedAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  meta?: Omit<AskSaansResponse, 'answer'>;
}

export interface ChallengeItem {
  id: string;
  title: string;
  description: string;
  category: 'commute' | 'home_energy' | 'clean_air_habit';
  impactType: 'wider_emissions' | 'personal_exposure' | 'both';
  impactNote: string;
  weeklyTarget: number;
}
