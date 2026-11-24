import type {
  AirQualitySummary,
  AirWindow,
  AqiScale,
  HourlyAirPoint,
  PollutantKey,
} from './types.js';

export interface AqiCategory {
  label: string;
  shortLabel: string;
  severity: 1 | 2 | 3 | 4 | 5 | 6;
  textColor: string;
  bgColor: string;
  borderColor: string;
  dotColor: string;
  summary: string;
}

export function getUsAqiCategory(aqi: number | null): AqiCategory {
  if (aqi === null || Number.isNaN(aqi)) {
    return {
      label: 'Unavailable',
      shortLabel: 'N/A',
      severity: 1,
      textColor: '#4A5550',
      bgColor: '#F0EEE7',
      borderColor: '#DCD8CE',
      dotColor: '#717D77',
      summary: 'Air quality index reading is currently unavailable.',
    };
  }
  if (aqi <= 50) {
    return {
      label: 'Good',
      shortLabel: 'Good',
      severity: 1,
      textColor: '#1E563B',
      bgColor: '#E6F4EC',
      borderColor: '#B8DFC9',
      dotColor: '#2D6A4F',
      summary: 'Relatively clean modelled air quality with low particulate burden.',
    };
  }
  if (aqi <= 100) {
    return {
      label: 'Moderate',
      shortLabel: 'Moderate',
      severity: 2,
      textColor: '#7A5410',
      bgColor: '#FBF3DC',
      borderColor: '#EAD59B',
      dotColor: '#B7791F',
      summary: 'Acceptable for many, though unusually sensitive groups may prefer lighter outdoor exertion.',
    };
  }
  if (aqi <= 150) {
    return {
      label: 'Unhealthy for Sensitive Groups',
      shortLabel: 'Sensitive Groups',
      severity: 3,
      textColor: '#9C4212',
      bgColor: '#FEF0E1',
      borderColor: '#F4C99E',
      dotColor: '#C05621',
      summary: 'Elevated pollution. Children, older adults, and sensitive individuals should limit prolonged outdoor exertion.',
    };
  }
  if (aqi <= 200) {
    return {
      label: 'Unhealthy',
      shortLabel: 'Unhealthy',
      severity: 4,
      textColor: '#991B1B',
      bgColor: '#FDECEC',
      borderColor: '#F5BDBD',
      dotColor: '#C53030',
      summary: 'High pollution levels. Moving intense outdoor activity indoors helps reduce household exposure.',
    };
  }
  if (aqi <= 300) {
    return {
      label: 'Very Unhealthy',
      shortLabel: 'Very Unhealthy',
      severity: 5,
      textColor: '#6B21A8',
      bgColor: '#F5EBFC',
      borderColor: '#DBBFF2',
      dotColor: '#7E22CE',
      summary: 'Severe pollution episode. Prioritise indoor routines, closed windows, and low-exertion outdoor errands.',
    };
  }
  return {
    label: 'Hazardous',
    shortLabel: 'Hazardous',
    severity: 6,
    textColor: '#7F1D1D',
    bgColor: '#F9E2E2',
    borderColor: '#E8A5A5',
    dotColor: '#991B1B',
    summary: 'Extreme air pollution levels. Keep outdoor time to an essential minimum and protect indoor air.',
  };
}

export function getEuropeanAqiCategory(aqi: number | null): AqiCategory {
  if (aqi === null || Number.isNaN(aqi)) {
    return getUsAqiCategory(null);
  }
  if (aqi <= 20) {
    return {
      ...getUsAqiCategory(25),
      label: 'Good',
      shortLabel: 'Good',
    };
  }
  if (aqi <= 40) {
    return {
      ...getUsAqiCategory(45),
      label: 'Fair',
      shortLabel: 'Fair',
    };
  }
  if (aqi <= 60) {
    return {
      ...getUsAqiCategory(75),
      label: 'Moderate',
      shortLabel: 'Moderate',
    };
  }
  if (aqi <= 80) {
    return {
      ...getUsAqiCategory(130),
      label: 'Poor',
      shortLabel: 'Poor',
    };
  }
  if (aqi <= 100) {
    return {
      ...getUsAqiCategory(175),
      label: 'Very Poor',
      shortLabel: 'Very Poor',
    };
  }
  return {
    ...getUsAqiCategory(260),
    label: 'Extremely Poor',
    shortLabel: 'Extremely Poor',
  };
}

export function getAqiCategory(aqi: number | null, scale: AqiScale): AqiCategory {
  return scale === 'us_aqi' ? getUsAqiCategory(aqi) : getEuropeanAqiCategory(aqi);
}

export interface PollutantMetadata {
  key: PollutantKey;
  symbol: string;
  name: string;
  unit: string;
  whoReference: string;
  whatItIs: string;
  commonSources: string;
  practicalNote: string;
}

export const POLLUTANT_META: Record<PollutantKey, PollutantMetadata> = {
  pm25: {
    key: 'pm25',
    symbol: 'PM2.5',
    name: 'Fine Particulate Matter (≤ 2.5 µm)',
    unit: 'µg/m³',
    whoReference: 'WHO 24-hour guideline: 15 µg/m³',
    whatItIs:
      'Microscopic airborne particles small enough to penetrate deep into the airways and stay suspended for hours, especially during cool winter inversions.',
    commonSources:
      'Vehicle exhaust, regional biomass and crop-residue burning, solid-fuel cooking, power generation, and secondary winter haze.',
    practicalNote:
      'Well-fitted N95/KF94 masks outdoors and HEPA filtration indoors are specifically effective against fine particles.',
  },
  pm10: {
    key: 'pm10',
    symbol: 'PM10',
    name: 'Coarse Particulate Matter (≤ 10 µm)',
    unit: 'µg/m³',
    whoReference: 'WHO 24-hour guideline: 45 µg/m³',
    whatItIs:
      'Larger inhalable dust and aerosol particles that irritate the eyes, nose, and upper airways and settle quickly on indoor surfaces.',
    commonSources:
      'Road dust resuspension, construction sites, wind-blown soil, and coarse combustion ash.',
    practicalNote:
      'Damp-mopping instead of dry sweeping and keeping street-facing windows shut during peak traffic reduces indoor PM10.',
  },
  no2: {
    key: 'no2',
    symbol: 'NO₂',
    name: 'Nitrogen Dioxide',
    unit: 'µg/m³',
    whoReference: 'WHO 24-hour guideline: 25 µg/m³',
    whatItIs:
      'A traffic-related gas that spikes sharply along busy arterial roads during rush hours and can also build up indoors from unvented gas stoves.',
    commonSources:
      'Diesel and petrol traffic exhaust, idling vehicles, and indoor LPG/natural gas cooking without an exhaust hood.',
    practicalNote:
      'Stepping back from main roads during walks and running a kitchen exhaust fan when cooking lowers NO₂ exposure.',
  },
  so2: {
    key: 'so2',
    symbol: 'SO₂',
    name: 'Sulphur Dioxide',
    unit: 'µg/m³',
    whoReference: 'WHO 24-hour guideline: 40 µg/m³',
    whatItIs:
      'A sharp-smelling gas produced by burning sulphur-containing fuels that contributes to secondary fine particulate formation.',
    commonSources:
      'Industrial boilers, coal-fired power plants, brick kilns, and heavy diesel generators.',
    practicalNote:
      'Elevated SO₂ typically reflects regional industrial or generator plumes rather than individual street traffic.',
  },
  o3: {
    key: 'o3',
    symbol: 'O₃',
    name: 'Ground-Level Ozone',
    unit: 'µg/m³',
    whoReference: 'WHO 8-hour guideline: 100 µg/m³',
    whatItIs:
      'A secondary pollutant formed when sunlight reacts with traffic emissions; unlike winter PM2.5, ozone typically peaks in bright mid-afternoon sun.',
    commonSources:
      'Photochemical reaction between sunlight, nitrogen oxides (NOx), and volatile organic compounds (VOCs).',
    practicalNote:
      'On sunny days with elevated O₃, mornings and evenings may have lower ozone than mid-afternoon.',
  },
};

export function formatHourLabel(isoLocal: string): string {
  const match = isoLocal.match(/T(\d{2}):(\d{2})/);
  if (!match) return isoLocal;
  const hour = parseInt(match[1], 10);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12} ${suffix}`;
}

export function formatTimeRange(startIso: string, endIso: string): string {
  return `${formatHourLabel(startIso)} – ${formatHourLabel(endIso)}`;
}

export function detectDominantPollutant(
  current: {
    pm25: number | null;
    pm10: number | null;
    no2: number | null;
    so2: number | null;
    o3: number | null;
  },
  currentHourly?: HourlyAirPoint,
): PollutantKey {
  // Prefer Open-Meteo's official US AQI sub-indices when present
  const subIndices: Array<{ key: PollutantKey; val: number | null | undefined }> = [
    { key: 'pm25', val: currentHourly?.usAqiPm25 },
    { key: 'pm10', val: currentHourly?.usAqiPm10 },
    { key: 'no2', val: currentHourly?.usAqiNo2 },
    { key: 'so2', val: currentHourly?.usAqiSo2 },
    { key: 'o3', val: currentHourly?.usAqiO3 },
  ];
  const validSub = subIndices.filter(
    (s): s is { key: PollutantKey; val: number } =>
      typeof s.val === 'number' && !Number.isNaN(s.val),
  );
  if (validSub.length > 0) {
    validSub.sort((a, b) => b.val - a.val);
    return validSub[0].key;
  }

  // Otherwise compare relative ratios against WHO 24h / 8h guideline benchmarks
  const ratios: Array<{ key: PollutantKey; ratio: number }> = [
    { key: 'pm25', ratio: (current.pm25 ?? 0) / 15 },
    { key: 'pm10', ratio: (current.pm10 ?? 0) / 45 },
    { key: 'no2', ratio: (current.no2 ?? 0) / 25 },
    { key: 'so2', ratio: (current.so2 ?? 0) / 40 },
    { key: 'o3', ratio: (current.o3 ?? 0) / 100 },
  ];
  ratios.sort((a, b) => b.ratio - a.ratio);
  return ratios[0].key;
}

export function computeAirQualitySummary(
  current: {
    usAqi: number | null;
    pm25: number | null;
    pm10: number | null;
    no2: number | null;
    so2: number | null;
    o3: number | null;
  },
  hourly: HourlyAirPoint[],
  currentTimeLocal: string,
): AirQualitySummary {
  const currentHourPrefix = currentTimeLocal.slice(0, 13);
  let nowIdx = hourly.findIndex((h) => h.time.startsWith(currentHourPrefix));
  if (nowIdx < 0) nowIdx = 0;

  const dominantPollutant = detectDominantPollutant(current, hourly[nowIdx]);
  const dominantPollutantLabel = `${POLLUTANT_META[dominantPollutant].symbol} (${POLLUTANT_META[dominantPollutant].name})`;

  const next24 = hourly.slice(nowIdx, nowIdx + 24);
  const next6 = hourly.slice(nowIdx, nowIdx + 7);

  // 6-hour trend
  const startAqi = current.usAqi ?? next6[0]?.usAqi ?? 0;
  const end6Aqi = next6[next6.length - 1]?.usAqi ?? startAqi;
  const trendDelta6h = Math.round(end6Aqi - startAqi);

  let trendDirection: 'improving' | 'stable' | 'worsening' = 'stable';
  let trendNote = 'Modelled levels are expected to remain broadly steady over the next 6 hours.';
  if (trendDelta6h <= -15) {
    trendDirection = 'improving';
    trendNote = `Forecast suggests modelled US AQI easing by ~${Math.abs(trendDelta6h)} points over the next 6 hours.`;
  } else if (trendDelta6h >= 15) {
    trendDirection = 'worsening';
    trendNote = `Forecast indicates modelled US AQI rising by ~${trendDelta6h} points over the next 6 hours.`;
  }

  // Rolling 3-hour windows for upcoming peak & relatively lower window (within next 24h)
  let peakWindow: AirWindow | null = null;
  let lowerWindow: AirWindow | null = null;

  if (next24.length >= 3) {
    for (let i = 0; i <= next24.length - 3; i++) {
      const slice = next24.slice(i, i + 3);
      const aqiVals = slice
        .map((p) => p.usAqi)
        .filter((v): v is number => v !== null);
      const pm25Vals = slice
        .map((p) => p.pm25)
        .filter((v): v is number => v !== null);
      if (aqiVals.length === 0) continue;

      const avgUsAqi = Math.round(
        aqiVals.reduce((sum, v) => sum + v, 0) / aqiVals.length,
      );
      const peakUsAqi = Math.round(Math.max(...aqiVals));
      const avgPm25 =
        pm25Vals.length > 0
          ? Math.round(
              (pm25Vals.reduce((sum, v) => sum + v, 0) / pm25Vals.length) * 10,
            ) / 10
          : 0;

      const candidate: AirWindow = {
        startTime: slice[0].time,
        endTime: slice[slice.length - 1].time,
        avgUsAqi,
        peakUsAqi,
        avgPm25,
      };

      if (!peakWindow || candidate.avgUsAqi > peakWindow.avgUsAqi) {
        peakWindow = candidate;
      }

      // Prefer daytime/waking hours (06:00–21:00) for actionable lower-pollution window
      const startHour = parseInt(slice[0].time.slice(11, 13), 10);
      const isDaytime = startHour >= 6 && startHour <= 20;
      if (isDaytime) {
        if (!lowerWindow || candidate.avgUsAqi < lowerWindow.avgUsAqi) {
          lowerWindow = candidate;
        }
      }
    }
  }

  // Tomorrow outlook (calendar day after currentTimeLocal)
  const todayDate = currentTimeLocal.slice(0, 10);
  const tomorrowPoints = hourly.filter((h) => h.time.slice(0, 10) > todayDate);
  const todayPoints = hourly.filter((h) => h.time.slice(0, 10) === todayDate);

  let tomorrowOutlook: AirQualitySummary['tomorrowOutlook'] = null;
  if (tomorrowPoints.length >= 6) {
    const tVals = tomorrowPoints
      .map((p) => p.usAqi)
      .filter((v): v is number => v !== null);
    const todayVals = todayPoints
      .map((p) => p.usAqi)
      .filter((v): v is number => v !== null);

    if (tVals.length > 0) {
      const avgUsAqi = Math.round(
        tVals.reduce((sum, v) => sum + v, 0) / tVals.length,
      );
      const maxUsAqi = Math.round(Math.max(...tVals));
      const minUsAqi = Math.round(Math.min(...tVals));
      const todayAvg =
        todayVals.length > 0
          ? todayVals.reduce((sum, v) => sum + v, 0) / todayVals.length
          : avgUsAqi;

      const diff = avgUsAqi - todayAvg;
      const directionVsToday: 'better' | 'similar' | 'worse' =
        diff <= -15 ? 'better' : diff >= 15 ? 'worse' : 'similar';

      tomorrowOutlook = { avgUsAqi, maxUsAqi, minUsAqi, directionVsToday };
    }
  }

  return {
    dominantPollutant,
    dominantPollutantLabel,
    trendDirection,
    trendDelta6h,
    trendNote,
    peakWindow,
    lowerWindow,
    tomorrowOutlook,
  };
}
