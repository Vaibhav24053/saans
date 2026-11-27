import {
  formatTimeRange,
  getUsAqiCategory,
  isValidAqiValue,
  US_AQI_THRESHOLDS,
} from './aqi.js';
import type {
  AirQualityData,
  CookingFuel,
  HouseholdProfile,
} from './types.js';

export interface IndoorAction {
  id: string;
  category: string;
  title: string;
  guidance: string;
  costTag: 'Zero cost' | 'Uses your gear' | 'Low cost optional';
  relevance: string;
}

export interface WindowGuidance {
  isHigh: boolean;
  isElevated: boolean;
  aqiAvailable: boolean;
  rawAqi: number | null;
  categoryLabel: string;
  headline: string;
  lowerWindowLabel: string | null;
  peakWindowLabel: string | null;
}

const COOKING_FUEL_LABELS: Record<CookingFuel, string> = {
  lpg_gas: 'LPG / gas',
  induction_electric: 'induction / electric',
  mixed: 'mixed',
};

export function formatCookingFuelLabel(fuel: CookingFuel): string {
  return COOKING_FUEL_LABELS[fuel];
}

export function getWindowGuidance(airData: AirQualityData | null): WindowGuidance {
  const candidateAqi = airData?.current.usAqi ?? null;
  const aqiAvailable = isValidAqiValue(candidateAqi);
  const rawAqi = aqiAvailable ? candidateAqi : null;
  const cat = getUsAqiCategory(rawAqi);
  const isHigh = rawAqi !== null && rawAqi >= US_AQI_THRESHOLDS.UNHEALTHY;
  const isElevated = rawAqi !== null && rawAqi >= US_AQI_THRESHOLDS.ELEVATED;

  const lowerWindowLabel = airData?.summary.lowerWindow
    ? formatTimeRange(
        airData.summary.lowerWindow.startTime,
        airData.summary.lowerWindow.endTime,
      )
    : null;
  const peakWindowLabel = airData?.summary.peakWindow
    ? formatTimeRange(
        airData.summary.peakWindow.startTime,
        airData.summary.peakWindow.endTime,
      )
    : null;

  let headline = 'Good window for a brief 15-minute indoor air refresh';
  if (isHigh) {
    headline = 'Keep exterior windows closed right now';
  } else if (isElevated) {
    headline =
      'Keep street-facing windows shut; ventilate briefly in the lower window';
  }

  return {
    isHigh,
    isElevated,
    aqiAvailable,
    rawAqi,
    categoryLabel: cat.label,
    headline,
    lowerWindowLabel,
    peakWindowLabel,
  };
}

function buildWindowAction(
  profile: HouseholdProfile,
  windowGuide: WindowGuidance,
): IndoorAction {
  const { isHigh, rawAqi, categoryLabel, lowerWindowLabel, peakWindowLabel } =
    windowGuide;

  let guidance: string;
  if (isHigh && rawAqi !== null) {
    const peakClause = peakWindowLabel ? `, especially through ${peakWindowLabel}` : '';
    const refreshClause = lowerWindowLabel
      ? `If indoor air feels stuffy, limit fresh-air exchange to a brief 10-minute refresh near ${lowerWindowLabel}.`
      : 'Wait for an afternoon dip before briefly airing rooms.';
    guidance = `Outdoor modelled air is ${categoryLabel} (${rawAqi} US AQI). Keep street-facing and balcony windows shut${peakClause}. ${refreshClause}`;
  } else {
    const ventPhrase =
      profile.ventilationOption === 'cross_ventilation'
        ? 'cross-ventilation flush across opposite windows'
        : 'window air refresh';
    const lowerClause = lowerWindowLabel
      ? ` during the relatively lower ${lowerWindowLabel} window`
      : '';
    guidance = `Schedule a 15–20 minute ${ventPhrase}${lowerClause}, then close windows ahead of evening traffic buildup.`;
  }

  return {
    id: 'windows',
    category: 'Windows & Ventilation Timing',
    title: isHigh
      ? 'Keep outside-facing windows closed right now'
      : 'Time your short indoor ventilation window',
    guidance,
    costTag: 'Zero cost',
    relevance: `Adapted to ${profile.homeType.replace('_', ' ')} + ${profile.ventilationOption.replace('_', ' ')}`,
  };
}

function buildCookingAction(profile: HouseholdProfile): IndoorAction {
  const isInduction = profile.cookingFuel === 'induction_electric';
  return {
    id: 'cooking',
    category: 'Cooking & Kitchen Air',
    title: isInduction
      ? 'Control cooking oil aerosols with lids & exhaust'
      : 'Vent out LPG/gas stove NO₂ and cooking smoke',
    guidance: isInduction
      ? 'Electric and induction stoves avoid combustion NO₂, but high-heat tempering and frying still release fine PM2.5 aerosols. Cover pans with lids, run an exhaust fan if available, and shut bedroom doors while cooking.'
      : 'Gas burners release indoor NO₂ and fine particulates quickly when windows are shut. Run your kitchen chimney/exhaust fan continuously from ignition until 10 minutes after cooking, use back burners, and keep the kitchen door closed.',
    costTag: 'Zero cost',
    relevance: `Tailored to ${formatCookingFuelLabel(profile.cookingFuel)} kitchen`,
  };
}

function buildPurifierAction(profile: HouseholdProfile): IndoorAction {
  if (profile.hasAirPurifier) {
    return {
      id: 'purifier',
      category: 'HEPA Air Purifier Strategy',
      title: 'Concentrate HEPA filtration in occupied rooms',
      guidance:
        'Place your HEPA purifier centrally (at least 30 cm from walls) in the main family room during the day and move it to the bedroom 45 minutes before sleep. Keep doors and windows closed while running, and vacuum the washable pre-filter weekly during winter smog.',
      costTag: 'Uses your gear',
      relevance: 'Using your existing HEPA purifier efficiently',
    };
  }

  const isZeroCost = profile.budgetPreference === 'zero_cost';
  return {
    id: 'no_purifier',
    category: 'Protection Without an Air Purifier',
    title: 'Create a low-draft “cleaner room” without buying hardware',
    guidance: isZeroCost
      ? 'Designate one inner bedroom away from the main street as your cleaner-air room: block under-door gaps with a rolled cotton towel, keep its door closed during cooking, and damp-wipe surfaces daily.'
      : 'Block window and door drafts with affordable foam weatherstripping tape and keep an inner bedroom closed during peak smog. If you ever consider a HEPA purifier later, size it to the room’s CADR rather than overspending on smart extras.',
    costTag: isZeroCost ? 'Zero cost' : 'Low cost optional',
    relevance: 'Practical guidance without requiring an air purifier',
  };
}

function buildActivityAction(
  profile: HouseholdProfile,
  isElevated: boolean,
): IndoorAction {
  const hasChildren = profile.children > 0;
  let guidance: string;
  if (hasChildren) {
    guidance = isElevated
      ? 'Swap evening park runs for indoor obstacle courses, dance sessions, or stretching games while outdoor PM2.5 is elevated — keeping kids active without heavy smog inhalation.'
      : 'Keep a quick indoor play backup ready if evening visibility or haze worsens.';
  } else {
    guidance = isElevated
      ? 'Move cardio, yoga, or strength training indoors today; indoor breathing air generally carries less coarse dust and traffic exhaust than roadside air.'
      : 'Use indoor mobility sessions during rush hours and reserve outdoor walks for quieter lower-AQI windows.';
  }

  return {
    id: 'activities',
    category: 'Indoor Family Routines',
    title: hasChildren
      ? 'Keep children’s active play engaging indoors'
      : 'Shift brisk movement indoors on elevated-AQI hours',
    guidance,
    costTag: 'Zero cost',
    relevance: hasChildren
      ? `Tailored for ${profile.children} child${profile.children > 1 ? 'ren' : ''}`
      : 'Adapted to household activity profile',
  };
}

export function buildIndoorActions(
  profile: HouseholdProfile,
  airData: AirQualityData | null,
): IndoorAction[] {
  const windowGuide = getWindowGuidance(airData);

  return [
    buildWindowAction(profile, windowGuide),
    buildCookingAction(profile),
    {
      id: 'smoke_sources',
      category: 'Indoor Smoke & Fragrance',
      title: 'Pause indoor combustion sources today',
      guidance:
        'Skip incense sticks (agarbatti), dhoop, scented candles, mosquito coils, and indoor smoking — in a closed room during smog episodes, a single burning stick can push indoor PM2.5 above outdoor levels.',
      costTag: 'Zero cost',
      relevance: 'High-impact indoor particulate prevention',
    },
    {
      id: 'cleaning',
      category: 'Cleaning & Settled Dust',
      title: 'Damp-mop instead of dry broom sweeping',
      guidance:
        'Dry sweeping and feather dusting lift settled PM10 and fine ash back into breathing height. Use a damp cloth on windowsills and a wet mop on floors, and leave outdoor footwear near the entryway.',
      costTag: 'Zero cost',
      relevance:
        profile.children > 0
          ? 'Extra helpful where children play near floor level'
          : 'Keeps coarse dust from resuspending indoors',
    },
    buildPurifierAction(profile),
    buildActivityAction(profile, windowGuide.isElevated),
  ];
}
