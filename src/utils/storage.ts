import type {
  AirQualityData,
  AirWindow,
  BudgetPreference,
  CommuteType,
  CookingFuel,
  DemoPersonaId,
  DemoScenarioId,
  HomeType,
  HouseholdProfile,
  HourlyAirPoint,
  LocationInfo,
  OutdoorWindowPref,
  PollutantKey,
  RespiratorySensitivity,
  SustainabilityFocus,
  VentilationOption,
} from '../../shared/types.js';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface StoredDemoState {
  enabled: boolean;
  scenarioId: DemoScenarioId;
  personaId: DemoPersonaId | null;
}

export interface ChallengeProgressState {
  counts: Record<string, number>;
  streakWeeks: number;
  lastLoggedDate: string | null;
}

const VALID_SCENARIOS = new Set<DemoScenarioId>([
  'moderate_haze',
  'severe_winter_smog',
  'worsening_inversion',
]);
const VALID_PERSONAS = new Set<DemoPersonaId>([
  'young_family',
  'commuter_senior',
  'wfh_cyclist',
]);
const VALID_LOCATION_SOURCES = new Set<LocationInfo['source']>([
  'geocoding',
  'geolocation',
  'demo',
]);
const VALID_SENSITIVITY = new Set<RespiratorySensitivity>([
  'none',
  'mild',
  'elevated',
]);
const VALID_COMMUTE = new Set<CommuteType>([
  'public_transport',
  'car',
  'two_wheeler',
  'walking',
  'cycling',
  'wfh',
]);
const VALID_OUTDOOR_WINDOW = new Set<OutdoorWindowPref>([
  'early_morning',
  'mid_morning',
  'afternoon',
  'evening',
  'flexible',
]);
const VALID_HOME_TYPE = new Set<HomeType>([
  'apartment',
  'independent_house',
  'other',
]);
const VALID_VENTILATION = new Set<VentilationOption>([
  'cross_ventilation',
  'exhaust_fan',
  'ac_recirculate',
  'limited',
]);
const VALID_COOKING_FUEL = new Set<CookingFuel>([
  'lpg_gas',
  'induction_electric',
  'mixed',
]);
const VALID_SUSTAINABILITY = new Set<SustainabilityFocus>([
  'exposure_first',
  'balanced',
  'low_emission_priority',
]);
const VALID_BUDGET = new Set<BudgetPreference>([
  'zero_cost',
  'moderate',
  'flexible',
]);
const VALID_POLLUTANTS = new Set<PollutantKey>([
  'pm25',
  'pm10',
  'no2',
  'so2',
  'o3',
]);
const VALID_TRENDS = new Set(['improving', 'stable', 'worsening']);
const VALID_DOMAINS = new Set(['cams_global', 'cams_europe', 'demo']);

function getDefaultStorage(): StorageLike | null {
  if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
    try {
      return globalThis.localStorage;
    } catch {
      return null;
    }
  }
  return null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteInRange(val: unknown, min: number, max: number): val is number {
  return typeof val === 'number' && Number.isFinite(val) && val >= min && val <= max;
}

function isIntInRange(val: unknown, min: number, max: number): val is number {
  return isFiniteInRange(val, min, max) && Number.isInteger(val);
}

function isNullableFinite(val: unknown): val is number | null {
  return val === null || (typeof val === 'number' && Number.isFinite(val));
}

function isValidLocationInfo(raw: unknown): raw is LocationInfo {
  if (!isPlainObject(raw)) return false;
  return (
    typeof raw.name === 'string' &&
    raw.name.trim().length > 0 &&
    typeof raw.country === 'string' &&
    isFiniteInRange(raw.latitude, -90, 90) &&
    isFiniteInRange(raw.longitude, -180, 180) &&
    typeof raw.timezone === 'string' &&
    raw.timezone.length > 0 &&
    typeof raw.source === 'string' &&
    VALID_LOCATION_SOURCES.has(raw.source as LocationInfo['source']) &&
    (raw.admin1 === undefined || typeof raw.admin1 === 'string')
  );
}

function isValidAirWindow(raw: unknown): raw is AirWindow {
  if (!isPlainObject(raw)) return false;
  return (
    typeof raw.startTime === 'string' &&
    typeof raw.endTime === 'string' &&
    typeof raw.avgUsAqi === 'number' &&
    Number.isFinite(raw.avgUsAqi) &&
    typeof raw.peakUsAqi === 'number' &&
    Number.isFinite(raw.peakUsAqi) &&
    typeof raw.avgPm25 === 'number' &&
    Number.isFinite(raw.avgPm25)
  );
}

function isValidHourlyPoint(raw: unknown): raw is HourlyAirPoint {
  if (!isPlainObject(raw)) return false;
  return (
    typeof raw.time === 'string' &&
    isNullableFinite(raw.usAqi) &&
    isNullableFinite(raw.europeanAqi) &&
    isNullableFinite(raw.pm25) &&
    isNullableFinite(raw.pm10) &&
    isNullableFinite(raw.no2) &&
    isNullableFinite(raw.so2) &&
    isNullableFinite(raw.o3)
  );
}

export function readStorageJson<T>(
  key: string,
  fallback: T,
  validate: (parsed: unknown) => T | null,
  storage?: StorageLike | null,
): T {
  const store = storage === undefined ? getDefaultStorage() : storage;
  if (!store) return fallback;
  try {
    const raw = store.getItem(key);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    const validated = validate(parsed);
    return validated !== null ? validated : fallback;
  } catch {
    return fallback;
  }
}

export function writeStorageJson(
  key: string,
  value: unknown,
  storage?: StorageLike | null,
): boolean {
  const store = storage === undefined ? getDefaultStorage() : storage;
  if (!store) return false;
  try {
    store.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function isValidMember<T extends string>(val: unknown, allowed: Set<T>): val is T {
  return typeof val === 'string' && allowed.has(val as T);
}

function hasValidFields(
  obj: Record<string, unknown>,
  checks: ReadonlyArray<readonly [string, (val: unknown) => boolean]>,
): boolean {
  return checks.every(([key, predicate]) => predicate(obj[key]));
}

const isString = (v: unknown): boolean => typeof v === 'string';
const isBoolean = (v: unknown): boolean => typeof v === 'boolean';
const isFiniteNum = (v: unknown): boolean =>
  typeof v === 'number' && Number.isFinite(v);

const PROFILE_FIELD_CHECKS: ReadonlyArray<
  readonly [string, (val: unknown) => boolean]
> = [
  ['householdName', (v) => typeof v === 'string' && v.length <= 120],
  ['adults', (v) => isIntInRange(v, 0, 20)],
  ['children', (v) => isIntInRange(v, 0, 20)],
  ['olderAdults', (v) => isIntInRange(v, 0, 20)],
  ['respiratorySensitivity', (v) => isValidMember(v, VALID_SENSITIVITY)],
  ['commuteType', (v) => isValidMember(v, VALID_COMMUTE)],
  ['commuteDistanceKm', (v) => isFiniteInRange(v, 0, 300)],
  ['outdoorWindow', (v) => isValidMember(v, VALID_OUTDOOR_WINDOW)],
  ['homeType', (v) => isValidMember(v, VALID_HOME_TYPE)],
  ['hasAirPurifier', isBoolean],
  ['ventilationOption', (v) => isValidMember(v, VALID_VENTILATION)],
  ['cookingFuel', (v) => isValidMember(v, VALID_COOKING_FUEL)],
  ['sustainabilityFocus', (v) => isValidMember(v, VALID_SUSTAINABILITY)],
  ['budgetPreference', (v) => isValidMember(v, VALID_BUDGET)],
  ['onboardingCompleted', isBoolean],
];

const CURRENT_AIR_FIELDS = [
  'usAqi',
  'europeanAqi',
  'pm25',
  'pm10',
  'no2',
  'so2',
  'o3',
] as const;

const AIR_META_CHECKS: ReadonlyArray<
  readonly [string, (val: unknown) => boolean]
> = [
  ['fetchedAt', isString],
  ['currentTimeLocal', isString],
  ['timezone', isString],
  ['isDemo', isBoolean],
  ['modelDomain', (v) => isValidMember(v, VALID_DOMAINS)],
  ['modelName', isString],
  ['spatialResolutionLabel', isString],
  ['attribution', isString],
  ['dataSourceLabel', isString],
  ['dataIntegrityNote', isString],
];

const AIR_SUMMARY_CHECKS: ReadonlyArray<
  readonly [string, (val: unknown) => boolean]
> = [
  ['dominantPollutant', (v) => isValidMember(v, VALID_POLLUTANTS)],
  ['dominantPollutantLabel', isString],
  ['trendDirection', (v) => isValidMember(v, VALID_TRENDS)],
  ['trendDelta6h', isFiniteNum],
  ['trendNote', isString],
  ['peakWindow', (v) => v === null || isValidAirWindow(v)],
  ['lowerWindow', (v) => v === null || isValidAirWindow(v)],
];

export function parseStoredProfile(
  raw: unknown,
  defaultProfile: HouseholdProfile,
): HouseholdProfile | null {
  if (!isPlainObject(raw)) return null;
  if (raw.location !== undefined && !isPlainObject(raw.location)) return null;

  const mergedLocation = {
    ...defaultProfile.location,
    ...(isPlainObject(raw.location) ? raw.location : {}),
  };
  if (!isValidLocationInfo(mergedLocation)) return null;

  const candidate: Record<string, unknown> = {
    ...defaultProfile,
    ...raw,
    location: mergedLocation,
  };
  if (!hasValidFields(candidate, PROFILE_FIELD_CHECKS)) return null;

  return candidate as unknown as HouseholdProfile;
}

export function parseStoredDemoState(raw: unknown): StoredDemoState | null {
  if (!isPlainObject(raw)) return null;
  const scenarioCandidate = raw.scenarioId;
  const scenarioId: DemoScenarioId =
    typeof scenarioCandidate === 'string' &&
    VALID_SCENARIOS.has(scenarioCandidate as DemoScenarioId)
      ? (scenarioCandidate as DemoScenarioId)
      : 'severe_winter_smog';

  const personaCandidate = raw.personaId;
  const personaId: DemoPersonaId | null =
    typeof personaCandidate === 'string' &&
    VALID_PERSONAS.has(personaCandidate as DemoPersonaId)
      ? (personaCandidate as DemoPersonaId)
      : null;

  return {
    enabled: Boolean(raw.enabled),
    scenarioId,
    personaId,
  };
}

export function parseStoredStringArray(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.filter((item): item is string => typeof item === 'string');
}

export function parseStoredChallengeProgress(
  raw: unknown,
): ChallengeProgressState | null {
  if (!isPlainObject(raw) || !isPlainObject(raw.counts)) return null;
  const counts: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw.counts)) {
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
      counts[k] = Math.floor(v);
    }
  }
  const streakWeeks =
    typeof raw.streakWeeks === 'number' &&
    Number.isInteger(raw.streakWeeks) &&
    raw.streakWeeks >= 1
      ? raw.streakWeeks
      : 1;
  const lastLoggedDate =
    typeof raw.lastLoggedDate === 'string' ? raw.lastLoggedDate : null;

  return { counts, streakWeeks, lastLoggedDate };
}

export function parseStoredAirCache(raw: unknown): AirQualityData | null {
  if (!isPlainObject(raw) || !isValidLocationInfo(raw.location)) return null;
  if (!isPlainObject(raw.current) || !isPlainObject(raw.summary)) return null;
  if (!Array.isArray(raw.hourly)) return null;

  const cur = raw.current;
  if (!CURRENT_AIR_FIELDS.every((k) => isNullableFinite(cur[k]))) return null;
  if (!hasValidFields(raw.summary, AIR_SUMMARY_CHECKS)) return null;
  if (!hasValidFields(raw, AIR_META_CHECKS)) return null;
  if (!raw.hourly.every(isValidHourlyPoint)) return null;

  return raw as unknown as AirQualityData;
}

export function isAirCacheMatchingLocation(
  cached: AirQualityData,
  target: LocationInfo,
  maxDeltaDegrees = 0.1,
): boolean {
  const latDiff = Math.abs(cached.location.latitude - target.latitude);
  const lonDiff = Math.abs(cached.location.longitude - target.longitude);
  return (
    Number.isFinite(latDiff) &&
    Number.isFinite(lonDiff) &&
    latDiff <= maxDeltaDegrees &&
    lonDiff <= maxDeltaDegrees
  );
}
