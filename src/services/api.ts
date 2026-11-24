import type {
  AirQualityData,
  AskSaansResponse,
  DailyPlanResponse,
  HouseholdProfile,
  LocationInfo,
} from '@shared/types';

export interface HealthStatus {
  status: string;
  geminiConfigured: boolean;
  model: string;
  timestamp: string;
}

async function parseJsonOrThrow<T>(res: Response): Promise<T> {
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Invalid JSON response (HTTP ${res.status})`);
  }
  if (!res.ok) {
    const errObj = json as { error?: string; message?: string };
    throw new Error(errObj.message || errObj.error || `Request failed with HTTP ${res.status}`);
  }
  return json as T;
}

export async function fetchHealthStatus(): Promise<HealthStatus> {
  const res = await fetch('/api/health');
  return parseJsonOrThrow<HealthStatus>(res);
}

export async function searchCities(query: string): Promise<LocationInfo[]> {
  const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
  const data = await parseJsonOrThrow<{ results: LocationInfo[] }>(res);
  return data.results ?? [];
}

export async function reverseGeocode(
  lat: number,
  lon: number,
): Promise<LocationInfo> {
  const res = await fetch(`/api/geocode?lat=${lat}&lon=${lon}`);
  const data = await parseJsonOrThrow<{ location: LocationInfo }>(res);
  return data.location;
}

export async function fetchLiveAirQuality(
  location: LocationInfo,
): Promise<AirQualityData> {
  const params = new URLSearchParams({
    lat: String(location.latitude),
    lon: String(location.longitude),
    name: location.name,
    country: location.country,
    timezone: location.timezone,
  });
  if (location.admin1) params.set('admin1', location.admin1);

  const res = await fetch(`/api/air-quality?${params.toString()}`);
  return parseJsonOrThrow<AirQualityData>(res);
}

export async function requestDailyPlan(
  profile: HouseholdProfile,
  airData: AirQualityData,
): Promise<DailyPlanResponse> {
  const res = await fetch('/api/daily-plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile, airData }),
  });
  return parseJsonOrThrow<DailyPlanResponse>(res);
}

export async function requestAskSaans(
  question: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  profile: HouseholdProfile,
  airData: AirQualityData,
): Promise<AskSaansResponse> {
  const res = await fetch('/api/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, history, profile, airData }),
  });
  return parseJsonOrThrow<AskSaansResponse>(res);
}
