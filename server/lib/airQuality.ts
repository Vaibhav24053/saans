import { computeAirQualitySummary } from '../../shared/aqi.js';
import type {
  AirQualityData,
  HourlyAirPoint,
  LocationInfo,
} from '../../shared/types.js';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

type CamsModelDomain = 'cams_europe' | 'cams_global';

interface CamsDomainMetadata {
  modelName: string;
  spatialResolutionLabel: string;
  dataSourceLabel: string;
  attribution: string;
  dataIntegrityNote: string;
}

const CAMS_DOMAIN_METADATA: Record<CamsModelDomain, CamsDomainMetadata> = {
  cams_europe: {
    modelName: 'Copernicus CAMS European Air Quality Forecast',
    spatialResolutionLabel: '0.1° (~11 km European model grid)',
    dataSourceLabel: 'Open-Meteo · Copernicus CAMS Europe (~11 km model)',
    attribution:
      'Air quality data provided by Open-Meteo.com using the Copernicus Atmosphere Monitoring Service (CAMS) European ensemble (CC BY 4.0).',
    dataIntegrityNote:
      'Modelled atmospheric forecast from Copernicus CAMS Europe (~11 km grid resolution) via Open-Meteo on US EPA AQI (0–500) and European AQI scales. Modelled forecasts reflect regional averages and are not street-level or official local monitoring station readings.',
  },
  cams_global: {
    modelName: 'Copernicus CAMS Global Atmospheric Composition Forecast',
    spatialResolutionLabel: '0.4° (~45 km global model grid)',
    dataSourceLabel: 'Open-Meteo · Copernicus CAMS Global (~45 km model)',
    attribution:
      'Air quality data provided by Open-Meteo.com using the Copernicus Atmosphere Monitoring Service (CAMS) Global forecast (CC BY 4.0).',
    dataIntegrityNote:
      'Modelled atmospheric forecast from Copernicus CAMS Global (~45 km spatial resolution) via Open-Meteo on US EPA AQI (0–500) and European AQI scales. Model grids represent broad regional estimates and are NOT official CPCB ground monitoring station measurements or street-level readings.',
  },
};

const airCache = new Map<string, CacheEntry<AirQualityData>>();
const geoCache = new Map<string, CacheEntry<LocationInfo[]>>();

const AIR_TTL_MS = 10 * 60 * 1000; // 10 minutes
const GEO_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_CACHE_ENTRIES = 200;

export function clearAirQualityCaches(): void {
  airCache.clear();
  geoCache.clear();
}

function setBoundedCache<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  entry: CacheEntry<T>,
): void {
  if (cache.size >= MAX_CACHE_ENTRIES && !cache.has(key)) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) {
      cache.delete(oldestKey);
    }
  }
  cache.set(key, entry);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function readUnknownArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function safeNumber(val: unknown): number | null {
  if (typeof val === 'number' && Number.isFinite(val) && val >= 0) {
    return Math.round(val * 10) / 10;
  }
  return null;
}

export function isValidCoordinates(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

export function assertValidCoordinates(latitude: number, longitude: number): void {
  if (!isValidCoordinates(latitude, longitude)) {
    throw new RangeError(
      'Invalid coordinates: latitude must be between -90 and 90, and longitude must be between -180 and 180.',
    );
  }
}

function formatCoordinateFallbackLabel(latitude: number, longitude: number): string {
  const latDir = latitude >= 0 ? 'N' : 'S';
  const lonDir = longitude >= 0 ? 'E' : 'W';
  return `${Math.abs(latitude).toFixed(2)}°${latDir}, ${Math.abs(longitude).toFixed(2)}°${lonDir}`;
}

function parseGeocodingResults(raw: unknown): LocationInfo[] {
  if (!isRecord(raw) || !Array.isArray(raw.results)) return [];
  const locations: LocationInfo[] = [];

  for (const item of raw.results) {
    if (!isRecord(item)) continue;
    const name = readOptionalString(item.name);
    const latitude = item.latitude;
    const longitude = item.longitude;
    if (
      !name ||
      typeof latitude !== 'number' ||
      typeof longitude !== 'number' ||
      !isValidCoordinates(latitude, longitude)
    ) {
      continue;
    }
    locations.push({
      name,
      admin1: readOptionalString(item.admin1),
      country: readOptionalString(item.country) ?? 'Unknown',
      latitude,
      longitude,
      timezone: readOptionalString(item.timezone) ?? 'auto',
      source: 'geocoding',
    });
  }
  return locations;
}

export async function searchLocations(query: string): Promise<LocationInfo[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const cacheKey = trimmed.toLowerCase();
  const cached = geoCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.searchParams.set('name', trimmed);
  url.searchParams.set('count', '8');
  url.searchParams.set('language', 'en');
  url.searchParams.set('format', 'json');

  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`Open-Meteo Geocoding returned HTTP ${response.status}`);
  }

  const raw: unknown = await response.json();
  const results = parseGeocodingResults(raw);

  setBoundedCache(geoCache, cacheKey, {
    value: results,
    expiresAt: Date.now() + GEO_TTL_MS,
  });
  return results;
}

function parseNominatimAddress(
  raw: unknown,
  latitude: number,
  longitude: number,
): LocationInfo | null {
  if (!isRecord(raw) || !isRecord(raw.address)) return null;
  const addr = raw.address;
  const city =
    readOptionalString(addr.city) ??
    readOptionalString(addr.town) ??
    readOptionalString(addr.village) ??
    readOptionalString(addr.state_district);
  if (!city) return null;

  return {
    name: city,
    admin1: readOptionalString(addr.state),
    country: readOptionalString(addr.country) ?? 'Unknown',
    latitude,
    longitude,
    timezone: 'auto',
    source: 'geolocation',
  };
}

export async function reverseGeocodeCoordinates(
  latitude: number,
  longitude: number,
): Promise<LocationInfo> {
  assertValidCoordinates(latitude, longitude);
  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.searchParams.set('lat', String(latitude));
    url.searchParams.set('lon', String(longitude));
    url.searchParams.set('format', 'json');
    url.searchParams.set('zoom', '10');

    const response = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'SAANS-AirQualityCompanion/1.0',
      },
      signal: AbortSignal.timeout(6000),
    });

    if (response.ok) {
      const raw: unknown = await response.json();
      const resolved = parseNominatimAddress(raw, latitude, longitude);
      if (resolved) return resolved;
    }
  } catch {
    // Fall through gracefully to coordinate label
  }

  return {
    name: formatCoordinateFallbackLabel(latitude, longitude),
    country: 'Detected Coordinates',
    latitude,
    longitude,
    timezone: 'auto',
    source: 'geolocation',
  };
}

export function isInEuropeanCamsDomain(latitude: number, longitude: number): boolean {
  // Copernicus CAMS European regional domain spans roughly 30°N–72°N, 25°W–45°E.
  // India (approx. 6°N–37°N, 68°E–98°E) and global cities outside Europe use CAMS Global (~45 km).
  return latitude >= 30 && latitude <= 72 && longitude >= -25 && longitude <= 45;
}

export function selectCamsModelDomain(
  latitude: number,
  longitude: number,
): CamsModelDomain {
  assertValidCoordinates(latitude, longitude);
  return isInEuropeanCamsDomain(latitude, longitude) ? 'cams_europe' : 'cams_global';
}

function buildAirQualityRequestUrl(
  latitude: number,
  longitude: number,
  modelDomain: CamsModelDomain,
): string {
  const url = new URL('https://air-quality-api.open-meteo.com/v1/air-quality');
  url.searchParams.set('latitude', String(latitude));
  url.searchParams.set('longitude', String(longitude));
  url.searchParams.set(
    'current',
    'us_aqi,european_aqi,pm2_5,pm10,nitrogen_dioxide,sulphur_dioxide,ozone',
  );
  url.searchParams.set(
    'hourly',
    'us_aqi,european_aqi,pm2_5,pm10,nitrogen_dioxide,sulphur_dioxide,ozone,us_aqi_pm2_5,us_aqi_pm10,us_aqi_nitrogen_dioxide,us_aqi_sulphur_dioxide,us_aqi_ozone',
  );
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('domains', modelDomain);
  url.searchParams.set('forecast_days', '2');
  return url.toString();
}

function normalizeHourlySeries(hourlyObj: Record<string, unknown>): HourlyAirPoint[] {
  const times = readUnknownArray(hourlyObj.time);
  const usAqi = readUnknownArray(hourlyObj.us_aqi);
  const europeanAqi = readUnknownArray(hourlyObj.european_aqi);
  const pm25 = readUnknownArray(hourlyObj.pm2_5);
  const pm10 = readUnknownArray(hourlyObj.pm10);
  const no2 = readUnknownArray(hourlyObj.nitrogen_dioxide);
  const so2 = readUnknownArray(hourlyObj.sulphur_dioxide);
  const o3 = readUnknownArray(hourlyObj.ozone);
  const usAqiPm25 = readUnknownArray(hourlyObj.us_aqi_pm2_5);
  const usAqiPm10 = readUnknownArray(hourlyObj.us_aqi_pm10);
  const usAqiNo2 = readUnknownArray(hourlyObj.us_aqi_nitrogen_dioxide);
  const usAqiSo2 = readUnknownArray(hourlyObj.us_aqi_sulphur_dioxide);
  const usAqiO3 = readUnknownArray(hourlyObj.us_aqi_ozone);

  const points: HourlyAirPoint[] = [];
  for (let idx = 0; idx < times.length; idx++) {
    const time = times[idx];
    if (typeof time !== 'string' || !time) continue;
    points.push({
      time,
      usAqi: safeNumber(usAqi[idx]),
      europeanAqi: safeNumber(europeanAqi[idx]),
      pm25: safeNumber(pm25[idx]),
      pm10: safeNumber(pm10[idx]),
      no2: safeNumber(no2[idx]),
      so2: safeNumber(so2[idx]),
      o3: safeNumber(o3[idx]),
      usAqiPm25: safeNumber(usAqiPm25[idx]),
      usAqiPm10: safeNumber(usAqiPm10[idx]),
      usAqiNo2: safeNumber(usAqiNo2[idx]),
      usAqiSo2: safeNumber(usAqiSo2[idx]),
      usAqiO3: safeNumber(usAqiO3[idx]),
    });
  }
  return points;
}

function normalizeOpenMeteoResponse(
  raw: unknown,
  latitude: number,
  longitude: number,
  modelDomain: CamsModelDomain,
  locationHint?: Partial<LocationInfo>,
): AirQualityData {
  const root = isRecord(raw) ? raw : {};
  const currentObj = isRecord(root.current) ? root.current : {};
  const hourlyObj = isRecord(root.hourly) ? root.hourly : {};

  const hourly = normalizeHourlySeries(hourlyObj);
  const current = {
    usAqi: safeNumber(currentObj.us_aqi),
    europeanAqi: safeNumber(currentObj.european_aqi),
    pm25: safeNumber(currentObj.pm2_5),
    pm10: safeNumber(currentObj.pm10),
    no2: safeNumber(currentObj.nitrogen_dioxide),
    so2: safeNumber(currentObj.sulphur_dioxide),
    o3: safeNumber(currentObj.ozone),
  };

  const rawTimezone = readOptionalString(root.timezone);
  const hintTimezone =
    locationHint?.timezone && locationHint.timezone.trim() !== 'auto'
      ? locationHint.timezone.trim()
      : undefined;
  const timezone = rawTimezone ?? hintTimezone ?? 'UTC';
  const currentTimeLocal =
    readOptionalString(currentObj.time) ??
    hourly[0]?.time ??
    new Date().toISOString().slice(0, 16);

  const summary = computeAirQualitySummary(current, hourly, currentTimeLocal);
  const location: LocationInfo = {
    name: locationHint?.name ?? formatCoordinateFallbackLabel(latitude, longitude),
    admin1: locationHint?.admin1,
    country: locationHint?.country ?? '',
    latitude,
    longitude,
    timezone,
    source: locationHint?.source ?? 'geocoding',
  };

  return {
    location,
    fetchedAt: new Date().toISOString(),
    currentTimeLocal,
    timezone,
    isDemo: false,
    modelDomain,
    ...CAMS_DOMAIN_METADATA[modelDomain],
    current,
    hourly,
    summary,
  };
}

export async function fetchOpenMeteoAirQuality(
  latitude: number,
  longitude: number,
  locationHint?: Partial<LocationInfo>,
): Promise<AirQualityData> {
  assertValidCoordinates(latitude, longitude);
  const roundedLat = Math.round(latitude * 100) / 100;
  const roundedLon = Math.round(longitude * 100) / 100;
  const modelDomain = selectCamsModelDomain(latitude, longitude);
  const cacheKey = `${roundedLat},${roundedLon},${modelDomain}`;

  const cached = airCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      ...cached.value,
      location: {
        ...cached.value.location,
        ...(locationHint?.name ? { name: locationHint.name } : {}),
        ...(locationHint?.admin1 ? { admin1: locationHint.admin1 } : {}),
        ...(locationHint?.country ? { country: locationHint.country } : {}),
      },
    };
  }

  const requestUrl = buildAirQualityRequestUrl(latitude, longitude, modelDomain);
  const response = await fetch(requestUrl, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) {
    throw new Error(`Open-Meteo Air Quality API returned HTTP ${response.status}`);
  }

  const raw: unknown = await response.json();
  const result = normalizeOpenMeteoResponse(
    raw,
    latitude,
    longitude,
    modelDomain,
    locationHint,
  );

  setBoundedCache(airCache, cacheKey, {
    value: result,
    expiresAt: Date.now() + AIR_TTL_MS,
  });
  return result;
}
