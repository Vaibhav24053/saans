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

const airCache = new Map<string, CacheEntry<AirQualityData>>();
const geoCache = new Map<string, CacheEntry<LocationInfo[]>>();

const AIR_TTL_MS = 10 * 60 * 1000; // 10 minutes
const GEO_TTL_MS = 30 * 60 * 1000; // 30 minutes

function safeNumber(val: unknown): number | null {
  if (typeof val === 'number' && Number.isFinite(val)) {
    return Math.round(val * 10) / 10;
  }
  return null;
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

  const data = (await response.json()) as {
    results?: Array<{
      name: string;
      admin1?: string;
      country?: string;
      latitude: number;
      longitude: number;
      timezone?: string;
    }>;
  };

  const results: LocationInfo[] = (data.results ?? []).map((item) => ({
    name: item.name,
    admin1: item.admin1,
    country: item.country ?? 'Unknown',
    latitude: item.latitude,
    longitude: item.longitude,
    timezone: item.timezone ?? 'auto',
    source: 'geocoding',
  }));

  geoCache.set(cacheKey, { value: results, expiresAt: Date.now() + GEO_TTL_MS });
  return results;
}

export async function reverseGeocodeCoordinates(
  latitude: number,
  longitude: number,
): Promise<LocationInfo> {
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
      const json = (await response.json()) as {
        address?: {
          city?: string;
          town?: string;
          village?: string;
          state_district?: string;
          state?: string;
          country?: string;
        };
      };
      const addr = json.address;
      const city =
        addr?.city ?? addr?.town ?? addr?.village ?? addr?.state_district;
      if (city) {
        return {
          name: city,
          admin1: addr?.state,
          country: addr?.country ?? 'Unknown',
          latitude,
          longitude,
          timezone: 'auto',
          source: 'geolocation',
        };
      }
    }
  } catch {
    // Fall through gracefully to coordinate label
  }

  return {
    name: `${latitude.toFixed(2)}°N, ${longitude.toFixed(2)}°E`,
    country: 'Detected Coordinates',
    latitude,
    longitude,
    timezone: 'auto',
    source: 'geolocation',
  };
}

function isInEuropeanCamsDomain(latitude: number, longitude: number): boolean {
  // Copernicus CAMS European regional domain spans roughly 30°N–72°N, 25°W–45°E.
  // India (approx. 6°N–37°N, 68°E–98°E) and global cities outside Europe use CAMS Global (~45 km).
  return latitude >= 30 && latitude <= 72 && longitude >= -25 && longitude <= 45;
}

export async function fetchOpenMeteoAirQuality(
  latitude: number,
  longitude: number,
  locationHint?: Partial<LocationInfo>,
): Promise<AirQualityData> {
  const roundedLat = Math.round(latitude * 100) / 100;
  const roundedLon = Math.round(longitude * 100) / 100;
  const inEurope = isInEuropeanCamsDomain(latitude, longitude);
  const modelDomain: 'cams_europe' | 'cams_global' = inEurope
    ? 'cams_europe'
    : 'cams_global';
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

  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) {
    throw new Error(`Open-Meteo Air Quality API returned HTTP ${response.status}`);
  }

  const raw = (await response.json()) as {
    timezone?: string;
    current?: {
      time?: string;
      us_aqi?: number;
      european_aqi?: number;
      pm2_5?: number;
      pm10?: number;
      nitrogen_dioxide?: number;
      sulphur_dioxide?: number;
      ozone?: number;
    };
    hourly?: {
      time?: string[];
      us_aqi?: Array<number | null>;
      european_aqi?: Array<number | null>;
      pm2_5?: Array<number | null>;
      pm10?: Array<number | null>;
      nitrogen_dioxide?: Array<number | null>;
      sulphur_dioxide?: Array<number | null>;
      ozone?: Array<number | null>;
      us_aqi_pm2_5?: Array<number | null>;
      us_aqi_pm10?: Array<number | null>;
      us_aqi_nitrogen_dioxide?: Array<number | null>;
      us_aqi_sulphur_dioxide?: Array<number | null>;
      us_aqi_ozone?: Array<number | null>;
    };
  };

  const times = raw.hourly?.time ?? [];
  const hourly: HourlyAirPoint[] = times.map((time, idx) => ({
    time,
    usAqi: safeNumber(raw.hourly?.us_aqi?.[idx]),
    europeanAqi: safeNumber(raw.hourly?.european_aqi?.[idx]),
    pm25: safeNumber(raw.hourly?.pm2_5?.[idx]),
    pm10: safeNumber(raw.hourly?.pm10?.[idx]),
    no2: safeNumber(raw.hourly?.nitrogen_dioxide?.[idx]),
    so2: safeNumber(raw.hourly?.sulphur_dioxide?.[idx]),
    o3: safeNumber(raw.hourly?.ozone?.[idx]),
    usAqiPm25: safeNumber(raw.hourly?.us_aqi_pm2_5?.[idx]),
    usAqiPm10: safeNumber(raw.hourly?.us_aqi_pm10?.[idx]),
    usAqiNo2: safeNumber(raw.hourly?.us_aqi_nitrogen_dioxide?.[idx]),
    usAqiSo2: safeNumber(raw.hourly?.us_aqi_sulphur_dioxide?.[idx]),
    usAqiO3: safeNumber(raw.hourly?.us_aqi_ozone?.[idx]),
  }));

  const current = {
    usAqi: safeNumber(raw.current?.us_aqi),
    europeanAqi: safeNumber(raw.current?.european_aqi),
    pm25: safeNumber(raw.current?.pm2_5),
    pm10: safeNumber(raw.current?.pm10),
    no2: safeNumber(raw.current?.nitrogen_dioxide),
    so2: safeNumber(raw.current?.sulphur_dioxide),
    o3: safeNumber(raw.current?.ozone),
  };

  const timezone = raw.timezone ?? locationHint?.timezone ?? 'UTC';
  const currentTimeLocal =
    raw.current?.time ?? hourly[0]?.time ?? new Date().toISOString().slice(0, 16);

  const summary = computeAirQualitySummary(current, hourly, currentTimeLocal);

  const location: LocationInfo = {
    name: locationHint?.name ?? `${roundedLat}°, ${roundedLon}°`,
    admin1: locationHint?.admin1,
    country: locationHint?.country ?? '',
    latitude,
    longitude,
    timezone,
    source: locationHint?.source ?? 'geocoding',
  };

  const modelName =
    modelDomain === 'cams_europe'
      ? 'Copernicus CAMS European Air Quality Forecast'
      : 'Copernicus CAMS Global Atmospheric Composition Forecast';
  const spatialResolutionLabel =
    modelDomain === 'cams_europe'
      ? '0.1° (~11 km European model grid)'
      : '0.4° (~45 km global model grid)';
  const dataSourceLabel =
    modelDomain === 'cams_europe'
      ? 'Open-Meteo · Copernicus CAMS Europe (~11 km model)'
      : 'Open-Meteo · Copernicus CAMS Global (~45 km model)';
  const attribution =
    modelDomain === 'cams_europe'
      ? 'Air quality data provided by Open-Meteo.com using the Copernicus Atmosphere Monitoring Service (CAMS) European ensemble (CC BY 4.0).'
      : 'Air quality data provided by Open-Meteo.com using the Copernicus Atmosphere Monitoring Service (CAMS) Global forecast (CC BY 4.0).';
  const dataIntegrityNote =
    modelDomain === 'cams_europe'
      ? 'Modelled atmospheric forecast from Copernicus CAMS Europe (~11 km grid resolution) via Open-Meteo on US EPA AQI (0–500) and European AQI scales. Modelled forecasts reflect regional averages and are not street-level or official local monitoring station readings.'
      : 'Modelled atmospheric forecast from Copernicus CAMS Global (~45 km spatial resolution) via Open-Meteo on US EPA AQI (0–500) and European AQI scales. Model grids represent broad regional estimates and are NOT official CPCB ground monitoring station measurements or street-level readings.';

  const result: AirQualityData = {
    location,
    fetchedAt: new Date().toISOString(),
    currentTimeLocal,
    timezone,
    isDemo: false,
    modelDomain,
    modelName,
    spatialResolutionLabel,
    attribution,
    dataSourceLabel,
    dataIntegrityNote,
    current,
    hourly,
    summary,
  };

  airCache.set(cacheKey, { value: result, expiresAt: Date.now() + AIR_TTL_MS });
  return result;
}
