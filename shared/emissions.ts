export type TransportModeId =
  | 'petrol_car_solo'
  | 'diesel_car_solo'
  | 'two_wheeler'
  | 'carpool_3'
  | 'local_bus'
  | 'metro_rail'
  | 'commuter_rail'
  | 'walk_cycle'
  | 'wfh';

export interface TransportEmissionFactor {
  id: TransportModeId;
  label: string;
  shortLabel: string;
  gramsCo2ePerPassengerKm: number;
  unitBasis: string;
  occupancyAssumption: string;
  sourceNote: string;
  exposureNote: string;
}

/**
 * Documented UK reference emission factors derived from UK Government (DESNZ / DEFRA)
 * Greenhouse Gas Reporting Conversion Factors (2024), combining direct tailpipe and
 * well-to-tank (WTT) averages for passenger transport.
 *
 * IMPORTANT: These are UK reference factors — NOT India-specific emission factors.
 * Indian vehicle fleet ages, fuel mixes, transit occupancy, and regional electricity
 * grid carbon intensity differ from UK averages. These values provide a transparent,
 * sourced benchmark for comparing relative commute mode shifts, never an audited
 * carbon certificate or neighbourhood ambient AQI reduction claim.
 */
export const EMISSION_METHODOLOGY = {
  sourceTitle:
    'UK Government (DESNZ / DEFRA) 2024 GHG Conversion Factors (UK Reference Benchmark — Not India-Specific)',
  sourceUrl:
    'https://www.gov.uk/government/collections/government-conversion-factors-for-company-reporting',
  formulaText:
    'Weekly CO₂e difference (kg) = ((Baseline factor − Alternative factor) × One-way km × 2 × Days/week) ÷ 1,000',
  horizonBasis:
    'Monthly estimate = 4 active commuting weeks; Annual estimate = 48 active commuting weeks (12 × 4 weeks, allowing 4 weeks of leave/holidays).',
  caveats: [
    'UK reference factors only — not India-specific: local Indian vehicle fleet efficiency, CNG/auto-rickshaw shares, transit load factors, and state electricity grid mixes (relevant for electric metro/rail) differ from UK averages.',
    'Single-occupant car and motorbike figures use per vehicle-km factors (1 occupant); carpool divides the average petrol car factor (162 g/vehicle-km) equally across 3 occupants (54 g/passenger-km); mass transit uses average passenger-km factors.',
    'Switching commute modes reduces cumulative greenhouse gas and tailpipe emissions over time; an individual household shift does NOT immediately lower neighbourhood ambient AQI on its own.',
    'Walking and cycling produce zero tailpipe emissions, but during high-AQI episodes their personal exposure trade-off must be weighed carefully.',
  ],
};

export const TRANSPORT_MODES: Record<TransportModeId, TransportEmissionFactor> = {
  petrol_car_solo: {
    id: 'petrol_car_solo',
    label: 'Petrol Car (1 occupant)',
    shortLabel: 'Petrol Car',
    gramsCo2ePerPassengerKm: 162,
    unitBasis: 'g CO₂e / vehicle-km',
    occupancyAssumption: '1 occupant (driver only)',
    sourceNote: 'UK DESNZ/DEFRA 2024 reference — average petrol car',
    exposureNote:
      'Enclosed cabin (recirculation mode reduces outside particulate ingress).',
  },
  diesel_car_solo: {
    id: 'diesel_car_solo',
    label: 'Diesel Car (1 occupant)',
    shortLabel: 'Diesel Car',
    gramsCo2ePerPassengerKm: 173,
    unitBasis: 'g CO₂e / vehicle-km',
    occupancyAssumption: '1 occupant (driver only)',
    sourceNote: 'UK DESNZ/DEFRA 2024 reference — average diesel car',
    exposureNote:
      'Enclosed cabin; diesel combustion typically emits more local tailpipe NO₂ and fine particulates.',
  },
  two_wheeler: {
    id: 'two_wheeler',
    label: 'Two-Wheeler / Motorbike (1 rider)',
    shortLabel: 'Two-Wheeler',
    gramsCo2ePerPassengerKm: 114,
    unitBasis: 'g CO₂e / vehicle-km',
    occupancyAssumption: '1 rider',
    sourceNote: 'UK DESNZ/DEFRA 2024 reference — average motorbike',
    exposureNote:
      'Direct open-air roadway exposure — well-fitted N95 mask advised when AQI is elevated.',
  },
  local_bus: {
    id: 'local_bus',
    label: 'City Bus',
    shortLabel: 'City Bus',
    gramsCo2ePerPassengerKm: 102,
    unitBasis: 'g CO₂e / passenger-km',
    occupancyAssumption: 'UK average local bus passenger load',
    sourceNote: 'UK DESNZ/DEFRA 2024 reference — average local bus',
    exposureNote:
      'Shared transit; AC buses with closed doors reduce roadside dust exposure.',
  },
  carpool_3: {
    id: 'carpool_3',
    label: 'Carpool (3 occupants in petrol car)',
    shortLabel: 'Carpool (3x)',
    gramsCo2ePerPassengerKm: 54,
    unitBasis: 'g CO₂e / passenger-km (162 ÷ 3)',
    occupancyAssumption: '3 occupants sharing 1 petrol car',
    sourceNote:
      'Derived from UK DESNZ/DEFRA 2024 average petrol car (162 g/vkm ÷ 3)',
    exposureNote:
      'Enclosed cabin exposure similar to a car, with two-thirds lower per-occupant emissions.',
  },
  commuter_rail: {
    id: 'commuter_rail',
    label: 'Suburban / Commuter Rail',
    shortLabel: 'Rail',
    gramsCo2ePerPassengerKm: 35,
    unitBasis: 'g CO₂e / passenger-km',
    occupancyAssumption: 'UK average national rail passenger load',
    sourceNote: 'UK DESNZ/DEFRA 2024 reference — national rail',
    exposureNote: 'Off-roadway corridor reduces direct tailpipe plume exposure.',
  },
  metro_rail: {
    id: 'metro_rail',
    label: 'Urban Metro / Light Rail',
    shortLabel: 'Metro',
    gramsCo2ePerPassengerKm: 21,
    unitBasis: 'g CO₂e / passenger-km',
    occupancyAssumption: 'UK average light rail / tram passenger load',
    sourceNote:
      'UK DESNZ/DEFRA 2024 reference — light rail/tram (actual value varies with local grid mix)',
    exposureNote:
      'Climate-controlled coaches avoid street-level exhaust; strong option on smog days.',
  },
  walk_cycle: {
    id: 'walk_cycle',
    label: 'Walking or Cycling',
    shortLabel: 'Walk / Cycle',
    gramsCo2ePerPassengerKm: 0,
    unitBasis: '0 g direct tailpipe CO₂e / km',
    occupancyAssumption: '1 person (non-motorised)',
    sourceNote: 'Zero direct tailpipe emissions',
    exposureNote:
      'Best reserved for lower-pollution windows; elevated breathing rate increases inhalation during heavy smog.',
  },
  wfh: {
    id: 'wfh',
    label: 'Work From Home (No Commute)',
    shortLabel: 'WFH',
    gramsCo2ePerPassengerKm: 0,
    unitBasis: '0 g commute CO₂e / km (excludes home energy delta)',
    occupancyAssumption: 'Commute trip avoided',
    sourceNote: 'Eliminates commute trip emissions (home electricity not modelled)',
    exposureNote: 'Eliminates rush-hour roadway pollution exposure altogether.',
  },
};

export interface CommuteImpactCalculation {
  baselineMode: TransportEmissionFactor;
  alternativeMode: TransportEmissionFactor;
  oneWayKm: number;
  daysPerWeek: number;
  weeklyKm: number;
  baselineWeeklyKg: number;
  alternativeWeeklyKg: number;
  weeklySavedKg: number;
  monthlySavedKg: number;
  yearlySavedKg: number;
  percentChange: number;
  changeDirection: 'lower' | 'same' | 'higher';
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function calculateCommuteImpact(
  baselineId: TransportModeId,
  alternativeId: TransportModeId,
  oneWayKm: number,
  daysPerWeek: number,
): CommuteImpactCalculation {
  const baselineMode = TRANSPORT_MODES[baselineId];
  const alternativeMode = TRANSPORT_MODES[alternativeId];
  const safeKm = Math.max(0.5, Math.min(200, oneWayKm));
  const safeDays = Math.max(1, Math.min(7, daysPerWeek));

  const weeklyKm = round1(safeKm * 2 * safeDays);
  const baselineWeeklyRaw =
    (baselineMode.gramsCo2ePerPassengerKm * weeklyKm) / 1000;
  const alternativeWeeklyRaw =
    (alternativeMode.gramsCo2ePerPassengerKm * weeklyKm) / 1000;

  const baselineWeeklyKg = round2(baselineWeeklyRaw);
  const alternativeWeeklyKg = round2(alternativeWeeklyRaw);
  const weeklySavedKg = round2(baselineWeeklyKg - alternativeWeeklyKg);

  // Mathematically consistent horizons: 4 active weeks/month, 48 active weeks/year (12 x 4)
  const monthlySavedKg = round1(weeklySavedKg * 4);
  const yearlySavedKg = Math.round(weeklySavedKg * 48);

  let changeDirection: 'lower' | 'same' | 'higher' = 'same';
  if (weeklySavedKg > 0.005) changeDirection = 'lower';
  else if (weeklySavedKg < -0.005) changeDirection = 'higher';

  const percentChange =
    baselineWeeklyRaw > 0
      ? Math.round((Math.abs(baselineWeeklyRaw - alternativeWeeklyRaw) / baselineWeeklyRaw) * 100)
      : 0;

  return {
    baselineMode,
    alternativeMode,
    oneWayKm: safeKm,
    daysPerWeek: safeDays,
    weeklyKm,
    baselineWeeklyKg,
    alternativeWeeklyKg,
    weeklySavedKg,
    monthlySavedKg,
    yearlySavedKg,
    percentChange,
    changeDirection,
  };
}
