import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeAirQualitySummary,
  detectDominantPollutant,
  findCurrentHourIndex,
  formatHourLabel,
  formatTimeRange,
  getAqiCategory,
  getEuropeanAqiCategory,
  getUsAqiCategory,
  isValidAqiValue,
} from '../shared/aqi.ts';
import type { HourlyAirPoint } from '../shared/types.ts';

function makeHourlyPoint(
  time: string,
  overrides: Partial<HourlyAirPoint> = {},
): HourlyAirPoint {
  return {
    time,
    usAqi: 85,
    europeanAqi: 38,
    pm25: 28,
    pm10: 55,
    no2: 22,
    so2: 10,
    o3: 45,
    ...overrides,
  };
}

describe('US AQI category boundaries', () => {
  it('classifies every US EPA AQI category boundary accurately', () => {
    const cases: Array<[number, string, 1 | 2 | 3 | 4 | 5 | 6]> = [
      [0, 'Good', 1],
      [50, 'Good', 1],
      [51, 'Moderate', 2],
      [100, 'Moderate', 2],
      [101, 'Unhealthy for Sensitive Groups', 3],
      [150, 'Unhealthy for Sensitive Groups', 3],
      [151, 'Unhealthy', 4],
      [200, 'Unhealthy', 4],
      [201, 'Very Unhealthy', 5],
      [300, 'Very Unhealthy', 5],
      [301, 'Hazardous', 6],
      [500, 'Hazardous', 6],
    ];

    for (const [aqi, expectedLabel, expectedSeverity] of cases) {
      const cat = getUsAqiCategory(aqi);
      assert.equal(cat.label, expectedLabel, `US AQI ${aqi} label mismatch`);
      assert.equal(cat.severity, expectedSeverity, `US AQI ${aqi} severity mismatch`);
    }
  });

  it('handles null, NaN, non-finite, and negative readings as Unavailable', () => {
    const invalidInputs: Array<number | null> = [
      null,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      -1,
      -50,
    ];

    for (const val of invalidInputs) {
      assert.equal(isValidAqiValue(val), false);
      const cat = getUsAqiCategory(val);
      assert.equal(cat.label, 'Unavailable');
      assert.equal(cat.shortLabel, 'N/A');
      assert.equal(cat.severity, 1);
    }
  });
});

describe('European AQI category boundaries', () => {
  it('classifies every European AQI category boundary accurately', () => {
    const cases: Array<[number, string]> = [
      [0, 'Good'],
      [20, 'Good'],
      [21, 'Fair'],
      [40, 'Fair'],
      [41, 'Moderate'],
      [60, 'Moderate'],
      [61, 'Poor'],
      [80, 'Poor'],
      [81, 'Very Poor'],
      [100, 'Very Poor'],
      [101, 'Extremely Poor'],
      [160, 'Extremely Poor'],
    ];

    for (const [aqi, expectedLabel] of cases) {
      const cat = getEuropeanAqiCategory(aqi);
      assert.equal(cat.label, expectedLabel, `European AQI ${aqi} label mismatch`);
      assert.equal(cat.shortLabel, expectedLabel);
    }
  });

  it('handles null, NaN, non-finite, and negative readings as Unavailable', () => {
    for (const val of [null, Number.NaN, Number.POSITIVE_INFINITY, -5]) {
      const cat = getEuropeanAqiCategory(val);
      assert.equal(cat.label, 'Unavailable');
      assert.equal(cat.shortLabel, 'N/A');
    }
  });

  it('dispatches getAqiCategory strictly by selected scale without silent conversion', () => {
    // Value 75 is Moderate on US AQI (51-100) but Poor on European AQI (61-80)
    assert.equal(getAqiCategory(75, 'us_aqi').label, 'Moderate');
    assert.equal(getAqiCategory(75, 'european_aqi').label, 'Poor');
    assert.equal(getAqiCategory(null, 'us_aqi').label, 'Unavailable');
    assert.equal(getAqiCategory(null, 'european_aqi').label, 'Unavailable');
  });
});

describe('detectDominantPollutant', () => {
  it('prefers official US AQI sub-indices when supplied', () => {
    const hourly = makeHourlyPoint('2026-11-27T10:00', {
      usAqiPm25: 90,
      usAqiPm10: 145,
      usAqiNo2: 40,
      usAqiSo2: 15,
      usAqiO3: 60,
    });
    const dominant = detectDominantPollutant(
      { pm25: 60, pm10: 90, no2: 20, so2: 10, o3: 50 },
      hourly,
    );
    assert.equal(dominant, 'pm10');
  });

  it('falls back to WHO guideline ratios when sub-indices are absent', () => {
    const dominant = detectDominantPollutant({
      pm25: 10, // 0.67x WHO (15)
      pm10: 20, // 0.44x WHO (45)
      no2: 90, // 3.6x WHO (25)
      so2: 15, // 0.375x WHO (40)
      o3: 50, // 0.5x WHO (100)
    });
    assert.equal(dominant, 'no2');
  });

  it('handles missing, NaN, and negative pollutant concentrations safely', () => {
    const dominant = detectDominantPollutant({
      pm25: null,
      pm10: Number.NaN,
      no2: -12,
      so2: null,
      o3: 150,
    });
    assert.equal(dominant, 'o3');

    const allNull = detectDominantPollutant({
      pm25: null,
      pm10: null,
      no2: null,
      so2: null,
      o3: null,
    });
    assert.equal(allNull, 'pm25');
  });
});

describe('computeAirQualitySummary and time utilities', () => {
  it('formats 24-hour ISO local strings into 12-hour labels and ranges', () => {
    assert.equal(formatHourLabel('2026-11-27T00:00'), '12 AM');
    assert.equal(formatHourLabel('2026-11-27T09:00'), '9 AM');
    assert.equal(formatHourLabel('2026-11-27T12:00'), '12 PM');
    assert.equal(formatHourLabel('2026-11-27T17:00'), '5 PM');
    assert.equal(formatHourLabel('invalid'), 'invalid');
    assert.equal(
      formatTimeRange('2026-11-27T13:00', '2026-11-27T15:00'),
      '1 PM – 3 PM',
    );
  });

  it('locates current hour index and falls back to 0 when unmatched', () => {
    const hourly = [
      makeHourlyPoint('2026-11-27T08:00'),
      makeHourlyPoint('2026-11-27T09:00'),
      makeHourlyPoint('2026-11-27T10:00'),
    ];
    assert.equal(findCurrentHourIndex(hourly, '2026-11-27T09:15'), 1);
    assert.equal(findCurrentHourIndex(hourly, '2026-11-28T09:00'), 0);
  });

  it('computes worsening 6h trend, peak/lower windows, and tomorrow outlook', () => {
    const hourly: HourlyAirPoint[] = [];
    // Today 06:00..23:00 (18 hours): morning clean (~80), evening spike (~220)
    for (let h = 6; h < 24; h++) {
      const aqi = h <= 10 ? 80 : h <= 15 ? 140 : 220;
      hourly.push(
        makeHourlyPoint(`2026-11-27T${String(h).padStart(2, '0')}:00`, {
          usAqi: aqi,
          pm25: Math.round(aqi * 0.5),
        }),
      );
    }
    // Tomorrow 00:00..23:00: much cleaner (~70)
    for (let h = 0; h < 24; h++) {
      hourly.push(
        makeHourlyPoint(`2026-11-28T${String(h).padStart(2, '0')}:00`, {
          usAqi: 70,
          pm25: 20,
        }),
      );
    }

    const summary = computeAirQualitySummary(
      { usAqi: 80, pm25: 40, pm10: 60, no2: 20, so2: 8, o3: 30 },
      hourly,
      '2026-11-27T08:00',
    );

    assert.equal(summary.trendDirection, 'worsening');
    assert.equal(summary.trendDelta6h, 60);
    assert.ok(summary.peakWindow);
    assert.equal(summary.peakWindow.avgUsAqi, 220);
    assert.ok(summary.lowerWindow);
    assert.equal(summary.lowerWindow.avgUsAqi, 80);
    assert.ok(summary.tomorrowOutlook);
    assert.equal(summary.tomorrowOutlook.avgUsAqi, 70);
    assert.equal(summary.tomorrowOutlook.directionVsToday, 'better');
  });

  it('handles missing/empty hourly forecasts gracefully', () => {
    const summary = computeAirQualitySummary(
      { usAqi: null, pm25: null, pm10: null, no2: null, so2: null, o3: null },
      [],
      '2026-11-27T10:00',
    );

    assert.equal(summary.trendDirection, 'stable');
    assert.equal(summary.trendDelta6h, 0);
    assert.equal(summary.peakWindow, null);
    assert.equal(summary.lowerWindow, null);
    assert.equal(summary.tomorrowOutlook, null);
    assert.match(summary.trendNote, /unavailable/i);
  });
});
