import type {
  BudgetPreference,
  CommuteType,
  CookingFuel,
  HomeType,
  LocationInfo,
  OutdoorWindowPref,
  RespiratorySensitivity,
  SustainabilityFocus,
  VentilationOption,
} from '@shared/types';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

export const CITY_PRESETS = {
  newDelhi: {
    name: 'New Delhi',
    admin1: 'Delhi',
    country: 'India',
    latitude: 28.6139,
    longitude: 77.209,
    timezone: 'Asia/Kolkata',
    source: 'geocoding' as const,
  },
  mumbai: {
    name: 'Mumbai',
    admin1: 'Maharashtra',
    country: 'India',
    latitude: 19.076,
    longitude: 72.8777,
    timezone: 'Asia/Kolkata',
    source: 'geocoding' as const,
  },
  bengaluru: {
    name: 'Bengaluru',
    admin1: 'Karnataka',
    country: 'India',
    latitude: 12.9716,
    longitude: 77.5946,
    timezone: 'Asia/Kolkata',
    source: 'geocoding' as const,
  },
  kolkata: {
    name: 'Kolkata',
    admin1: 'West Bengal',
    country: 'India',
    latitude: 22.5726,
    longitude: 88.3639,
    timezone: 'Asia/Kolkata',
    source: 'geocoding' as const,
  },
  gurugram: {
    name: 'Gurugram',
    admin1: 'Haryana',
    country: 'India',
    latitude: 28.4595,
    longitude: 77.0266,
    timezone: 'Asia/Kolkata',
    source: 'geocoding' as const,
  },
  lucknow: {
    name: 'Lucknow',
    admin1: 'Uttar Pradesh',
    country: 'India',
    latitude: 26.8467,
    longitude: 80.9462,
    timezone: 'Asia/Kolkata',
    source: 'geocoding' as const,
  },
  pune: {
    name: 'Pune',
    admin1: 'Maharashtra',
    country: 'India',
    latitude: 18.5204,
    longitude: 73.8567,
    timezone: 'Asia/Kolkata',
    source: 'geocoding' as const,
  },
  london: {
    name: 'London',
    admin1: 'England',
    country: 'United Kingdom',
    latitude: 51.5072,
    longitude: -0.1276,
    timezone: 'Europe/London',
    source: 'geocoding' as const,
  },
} satisfies Record<string, LocationInfo>;

export const ONBOARDING_QUICK_LOCATIONS: LocationInfo[] = [
  CITY_PRESETS.newDelhi,
  CITY_PRESETS.mumbai,
  CITY_PRESETS.bengaluru,
  CITY_PRESETS.lucknow,
  CITY_PRESETS.pune,
];

export const MODAL_QUICK_CITIES: LocationInfo[] = [
  CITY_PRESETS.newDelhi,
  CITY_PRESETS.mumbai,
  CITY_PRESETS.bengaluru,
  CITY_PRESETS.kolkata,
  CITY_PRESETS.gurugram,
  CITY_PRESETS.london,
];

export const SENSITIVITY_OPTIONS: ReadonlyArray<{
  value: RespiratorySensitivity;
  title: string;
  desc: string;
  selectLabel: string;
}> = [
  {
    value: 'none',
    title: 'Standard',
    desc: 'General urban precautions',
    selectLabel: 'Standard urban precautions',
  },
  {
    value: 'mild',
    title: 'Cautious',
    desc: 'Prefer gentler outdoor limits on moderate/hazy days',
    selectLabel: 'Cautious on moderate/hazy days',
  },
  {
    value: 'elevated',
    title: 'High Precaution',
    desc: 'Prioritise indoor comfort and early alerts',
    selectLabel: 'High precaution / indoor priority',
  },
];

export const COMMUTE_OPTIONS: ReadonlyArray<SelectOption<CommuteType> & { drawerLabel: string }> = [
  { value: 'public_transport', label: 'Public Transit', drawerLabel: 'Public Transport' },
  { value: 'car', label: 'Private Car', drawerLabel: 'Private Car' },
  { value: 'two_wheeler', label: 'Two-Wheeler', drawerLabel: 'Two-Wheeler' },
  { value: 'walking', label: 'Walking', drawerLabel: 'Walking' },
  { value: 'cycling', label: 'Cycling', drawerLabel: 'Cycling' },
  { value: 'wfh', label: 'Work From Home', drawerLabel: 'Work From Home' },
];

export const OUTDOOR_WINDOW_OPTIONS: ReadonlyArray<SelectOption<OutdoorWindowPref> & { drawerLabel: string }> = [
  { value: 'early_morning', label: 'Early Morning (6–9 AM)', drawerLabel: 'Early Morning (6–9 AM)' },
  { value: 'mid_morning', label: 'Mid-Morning (9–12 PM)', drawerLabel: 'Mid-Morning (9–12 PM)' },
  { value: 'afternoon', label: 'Afternoon (12–4 PM)', drawerLabel: 'Afternoon (12–4 PM)' },
  { value: 'evening', label: 'Evening (5–8 PM)', drawerLabel: 'Evening (5–8 PM)' },
  { value: 'flexible', label: 'Flexible Schedule', drawerLabel: 'Flexible' },
];

export const HOME_TYPE_OPTIONS: ReadonlyArray<SelectOption<HomeType> & { drawerLabel: string }> = [
  { value: 'apartment', label: 'Apartment', drawerLabel: 'Apartment' },
  { value: 'independent_house', label: 'House', drawerLabel: 'Independent House' },
  { value: 'other', label: 'Other', drawerLabel: 'Other' },
];

export const VENTILATION_OPTIONS: ReadonlyArray<SelectOption<VentilationOption> & { drawerLabel: string }> = [
  {
    value: 'cross_ventilation',
    label: 'Windows with cross-ventilation',
    drawerLabel: 'Cross-ventilation',
  },
  {
    value: 'exhaust_fan',
    label: 'Kitchen / room exhaust fans',
    drawerLabel: 'Exhaust fan',
  },
  {
    value: 'ac_recirculate',
    label: 'Split / central AC (recirculation)',
    drawerLabel: 'AC recirculate',
  },
  {
    value: 'limited',
    label: 'Limited single-side windows',
    drawerLabel: 'Limited windows',
  },
];

export const COOKING_FUEL_OPTIONS: ReadonlyArray<SelectOption<CookingFuel> & { drawerLabel: string }> = [
  { value: 'lpg_gas', label: 'LPG / Piped Gas Stove', drawerLabel: 'LPG / Piped Gas' },
  { value: 'induction_electric', label: 'Induction / Electric', drawerLabel: 'Induction / Electric' },
  { value: 'mixed', label: 'Mixed (Gas + Induction)', drawerLabel: 'Mixed' },
];

export const SUSTAINABILITY_FOCUS_OPTIONS: ReadonlyArray<SelectOption<SustainabilityFocus> & { drawerLabel: string }> = [
  { value: 'balanced', label: 'Balanced (Exposure + Low Emissions)', drawerLabel: 'Balanced' },
  { value: 'exposure_first', label: 'Family Exposure Protection First', drawerLabel: 'Exposure first' },
  { value: 'low_emission_priority', label: 'Low-Emission Lifestyle Focus', drawerLabel: 'Low emissions' },
];

export const BUDGET_PREFERENCE_OPTIONS: ReadonlyArray<SelectOption<BudgetPreference> & { drawerLabel: string }> = [
  { value: 'zero_cost', label: 'Zero-cost / behavioural steps only', drawerLabel: 'Zero-cost steps' },
  { value: 'moderate', label: 'Moderate (masks, weatherstrips, filters)', drawerLabel: 'Moderate' },
  { value: 'flexible', label: 'Flexible (open to home upgrades)', drawerLabel: 'Flexible' },
];

export function matchOptionValue<T extends string>(
  raw: string,
  options: ReadonlyArray<{ value: T }>,
  fallback: T,
): T {
  const matched = options.find((opt) => opt.value === raw);
  return matched ? matched.value : fallback;
}
