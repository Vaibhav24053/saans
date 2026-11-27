import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  clearAirQualityCaches,
  fetchOpenMeteoAirQuality,
  isInEuropeanCamsDomain,
  isValidCoordinates,
  reverseGeocodeCoordinates,
  searchLocations,
  selectCamsModelDomain,
} from '../server/lib/airQuality.ts';

const originalFetch = globalThis.fetch;

function mockFetchOnce(
  handler: (url: string) => Response | Promise<Response>,
): { getUrls: () => string[] } {
  const urls: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    urls.push(url);
    return handler(url);
  }) as typeof fetch;
  return { getUrls: () => urls };
}

beforeEach(() => {
  clearAirQualityCaches();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  clearAirQualityCaches();
});

describe('coordinate validation and geographical CAMS model selection', () => {
  it('validates latitude and longitude bounds strictly', () => {
    assert.equal(isValidCoordinates(28.6139, 77.209), true);
    assert.equal(isValidCoordinates(-90, -180), true);
    assert.equal(isValidCoordinates(90, 180), true);

    assert.equal(isValidCoordinates(90.1, 77), false);
    assert.equal(isValidCoordinates(-90.1, 77), false);
    assert.equal(isValidCoordinates(28.6, 180.1), false);
    assert.equal(isValidCoordinates(28.6, -180.1), false);
    assert.equal(isValidCoordinates(Number.NaN, 77), false);
    assert.equal(isValidCoordinates(28.6, Number.POSITIVE_INFINITY), false);
  });

  it('selects cams_europe for European locations and cams_global for India and non-European locations', () => {
    // European cities -> cams_europe
    assert.equal(isInEuropeanCamsDomain(51.5072, -0.1276), true); // London
    assert.equal(selectCamsModelDomain(48.8566, 2.3522), 'cams_europe'); // Paris
    assert.equal(selectCamsModelDomain(52.52, 13.405), 'cams_europe'); // Berlin
    assert.equal(selectCamsModelDomain(30, -25), 'cams_europe'); // SW boundary
    assert.equal(selectCamsModelDomain(72, 45), 'cams_europe'); // NE boundary

    // Indian cities -> cams_global (never European grid)
    assert.equal(selectCamsModelDomain(28.6139, 77.209), 'cams_global'); // New Delhi
    assert.equal(selectCamsModelDomain(12.9716, 77.5946), 'cams_global'); // Bengaluru
    assert.equal(selectCamsModelDomain(19.076, 72.8777), 'cams_global'); // Mumbai

    // Other global cities outside Europe -> cams_global
    assert.equal(selectCamsModelDomain(40.7128, -74.006), 'cams_global'); // New York
    assert.equal(selectCamsModelDomain(35.6762, 139.6503), 'cams_global'); // Tokyo
    assert.equal(selectCamsModelDomain(-33.8688, 151.2093), 'cams_global'); // Sydney
    assert.equal(selectCamsModelDomain(29.9, 10), 'cams_global'); // Just south of boundary
    assert.equal(selectCamsModelDomain(45, 45.1), 'cams_global'); // Just east of boundary
  });

  it('rejects invalid coordinates before calling external services', async () => {
    const tracker = mockFetchOnce(
      () => new Response(JSON.stringify({}), { status: 200 }),
    );

    await assert.rejects(
      () => fetchOpenMeteoAirQuality(95, 77.2),
      RangeError,
    );
    await assert.rejects(
      () => fetchOpenMeteoAirQuality(28.6, -200),
      RangeError,
    );
    await assert.rejects(
      () => fetchOpenMeteoAirQuality(Number.NaN, 77.2),
      RangeError,
    );
    await assert.rejects(
      () => reverseGeocodeCoordinates(-91, 0),
      RangeError,
    );

    assert.equal(tracker.getUrls().length, 0);
  });
});

describe('fetchOpenMeteoAirQuality deterministic parsing', () => {
  it('queries cams_global for New Delhi and labels spatial resolution honestly', async () => {
    const tracker = mockFetchOnce(() =>
      new Response(
        JSON.stringify({
          timezone: 'Asia/Kolkata',
          current: {
            time: '2026-11-27T10:00',
            us_aqi: 210,
            european_aqi: 92,
            pm2_5: 132.46,
            pm10: 205.12,
            nitrogen_dioxide: 48.2,
            sulphur_dioxide: 16.4,
            ozone: 31.0,
          },
          hourly: {
            time: [
              '2026-11-27T10:00',
              '2026-11-27T11:00',
              '2026-11-27T12:00',
              '2026-11-27T13:00',
            ],
            us_aqi: [210, 200, 185, 175],
            european_aqi: [92, 88, 80, 76],
            pm2_5: [132.5, 120.1, 110.0, 98.4],
            pm10: [205.1, 190.0, 175.0, 160.0],
            nitrogen_dioxide: [48.2, 42.0, 38.0, 35.0],
            sulphur_dioxide: [16.4, 15.0, 14.0, 13.0],
            ozone: [31.0, 36.0, 42.0, 48.0],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const data = await fetchOpenMeteoAirQuality(28.6139, 77.209, {
      name: 'New Delhi',
      country: 'India',
    });

    assert.equal(tracker.getUrls().length, 1);
    const reqUrl = new URL(tracker.getUrls()[0]);
    assert.equal(reqUrl.searchParams.get('domains'), 'cams_global');
    assert.equal(reqUrl.searchParams.get('timezone'), 'auto');

    assert.equal(data.modelDomain, 'cams_global');
    assert.match(data.spatialResolutionLabel, /45 km/);
    assert.match(data.dataIntegrityNote, /NOT official CPCB/);
    assert.equal(data.timezone, 'Asia/Kolkata');
    assert.equal(data.location.timezone, 'Asia/Kolkata');
    assert.equal(data.current.pm25, 132.5);
    assert.equal(data.current.usAqi, 210);
  });

  it('queries cams_europe for London and uses European model metadata', async () => {
    const tracker = mockFetchOnce(() =>
      new Response(
        JSON.stringify({
          timezone: 'Europe/London',
          current: {
            time: '2026-11-27T09:00',
            us_aqi: 42,
            european_aqi: 24,
            pm2_5: 8.4,
            pm10: 14.2,
            nitrogen_dioxide: 19.1,
            sulphur_dioxide: 3.2,
            ozone: 52.0,
          },
          hourly: {
            time: ['2026-11-27T09:00', '2026-11-27T10:00', '2026-11-27T11:00'],
            us_aqi: [42, 44, 40],
            european_aqi: [24, 25, 22],
            pm2_5: [8.4, 8.8, 7.9],
            pm10: [14.2, 15.0, 13.8],
            nitrogen_dioxide: [19.1, 18.0, 17.5],
            sulphur_dioxide: [3.2, 3.0, 2.9],
            ozone: [52.0, 55.0, 58.0],
          },
        }),
        { status: 200 },
      ),
    );

    const data = await fetchOpenMeteoAirQuality(51.5072, -0.1276, {
      name: 'London',
      country: 'United Kingdom',
    });

    const reqUrl = new URL(tracker.getUrls()[0]);
    assert.equal(reqUrl.searchParams.get('domains'), 'cams_europe');
    assert.equal(data.modelDomain, 'cams_europe');
    assert.match(data.spatialResolutionLabel, /11 km/);
    assert.equal(data.timezone, 'Europe/London');
  });

  it('handles missing pollutant values and negative/non-finite readings safely', async () => {
    mockFetchOnce(() =>
      new Response(
        JSON.stringify({
          timezone: 'Asia/Kolkata',
          current: {
            time: '2026-11-27T12:00',
            us_aqi: 112,
            european_aqi: null,
            pm2_5: null,
            pm10: -5,
            nitrogen_dioxide: 34.2,
            sulphur_dioxide: undefined,
            ozone: 'invalid',
          },
          hourly: {
            time: ['2026-11-27T12:00', '2026-11-27T13:00', '2026-11-27T14:00'],
            us_aqi: [112, null, 118],
            pm2_5: [null, null, null],
          },
        }),
        { status: 200 },
      ),
    );

    const data = await fetchOpenMeteoAirQuality(12.9716, 77.5946, {
      name: 'Bengaluru',
      country: 'India',
    });

    assert.equal(data.current.usAqi, 112);
    assert.equal(data.current.europeanAqi, null);
    assert.equal(data.current.pm25, null);
    assert.equal(data.current.pm10, null);
    assert.equal(data.current.no2, 34.2);
    assert.equal(data.current.so2, null);
    assert.equal(data.current.o3, null);
    assert.equal(data.summary.dominantPollutant, 'no2');
    assert.equal(data.hourly[1].usAqi, null);
  });

  it('handles completely missing hourly forecast arrays without crashing', async () => {
    mockFetchOnce(() =>
      new Response(
        JSON.stringify({
          timezone: 'Asia/Tokyo',
          current: {
            time: '2026-11-27T15:00',
            us_aqi: 55,
            pm2_5: 14.1,
          },
        }),
        { status: 200 },
      ),
    );

    const data = await fetchOpenMeteoAirQuality(35.6762, 139.6503, {
      name: 'Tokyo',
      country: 'Japan',
    });

    assert.equal(data.hourly.length, 0);
    assert.equal(data.summary.peakWindow, null);
    assert.equal(data.summary.lowerWindow, null);
    assert.equal(data.summary.tomorrowOutlook, null);
    assert.equal(data.summary.trendDirection, 'stable');
    assert.equal(data.currentTimeLocal, '2026-11-27T15:00');
  });

  it('resolves timezone fallback cleanly when Open-Meteo omits timezone', async () => {
    // Case 1: locationHint supplies explicit IANA timezone
    mockFetchOnce(() =>
      new Response(JSON.stringify({ current: { us_aqi: 60 } }), { status: 200 }),
    );
    const withHint = await fetchOpenMeteoAirQuality(19.076, 72.8777, {
      name: 'Mumbai',
      timezone: 'Asia/Kolkata',
    });
    assert.equal(withHint.timezone, 'Asia/Kolkata');

    // Case 2: locationHint timezone is "auto" -> must fall back to "UTC", never literal "auto"
    clearAirQualityCaches();
    mockFetchOnce(() =>
      new Response(JSON.stringify({ current: { us_aqi: 60 } }), { status: 200 }),
    );
    const withAutoHint = await fetchOpenMeteoAirQuality(19.076, 72.8777, {
      name: 'Mumbai',
      timezone: 'auto',
    });
    assert.equal(withAutoHint.timezone, 'UTC');
    assert.equal(withAutoHint.location.timezone, 'UTC');
  });

  it('formats southern and western hemisphere coordinates accurately on reverse-geocode fallback', async () => {
    mockFetchOnce(() => new Response('Unavailable', { status: 503 }));
    const loc = await reverseGeocodeCoordinates(-33.8688, -151.2093);
    assert.equal(loc.name, '33.87°S, 151.21°W');
    assert.equal(loc.source, 'geolocation');
  });

  it('serves cached air quality on repeat requests and merges updated location hints', async () => {
    const tracker = mockFetchOnce(() =>
      new Response(
        JSON.stringify({
          timezone: 'Asia/Kolkata',
          current: { time: '2026-11-27T10:00', us_aqi: 140, pm2_5: 52.3 },
          hourly: { time: ['2026-11-27T10:00'], us_aqi: [140], pm2_5: [52.3] },
        }),
        { status: 200 },
      ),
    );

    const first = await fetchOpenMeteoAirQuality(28.6139, 77.209, {
      name: 'New Delhi',
      country: 'India',
    });
    const second = await fetchOpenMeteoAirQuality(28.6139, 77.209, {
      name: 'Connaught Place',
      country: 'India',
    });

    assert.equal(tracker.getUrls().length, 1);
    assert.equal(first.location.name, 'New Delhi');
    assert.equal(second.location.name, 'Connaught Place');
    assert.equal(second.current.usAqi, 140);
  });

  it('throws descriptive errors on non-OK upstream responses and filters malformed geocode rows', async () => {
    mockFetchOnce(() => new Response('Bad Gateway', { status: 502 }));
    await assert.rejects(
      () => fetchOpenMeteoAirQuality(28.6139, 77.209),
      /HTTP 502/,
    );

    mockFetchOnce(() =>
      new Response(
        JSON.stringify({
          results: [
            { name: 'Pune', admin1: 'Maharashtra', country: 'India', latitude: 18.52, longitude: 73.85, timezone: 'Asia/Kolkata' },
            { name: 'BrokenRow', latitude: 'invalid', longitude: 77 },
            { name: 'OutOfRange', latitude: 95, longitude: 77 },
          ],
        }),
        { status: 200 },
      ),
    );
    const locations = await searchLocations('Pune');
    assert.equal(locations.length, 1);
    assert.equal(locations[0].name, 'Pune');
  });
});
