import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Compass,
  Home,
  Leaf,
  Loader2,
  MapPin,
  Search,
  Sparkles,
  Users,
  Wind,
} from 'lucide-react';
import type {
  BudgetPreference,
  CommuteType,
  CookingFuel,
  HomeType,
  HouseholdProfile,
  LocationInfo,
  OutdoorWindowPref,
  RespiratorySensitivity,
  SustainabilityFocus,
  VentilationOption,
} from '@shared/types';
import { DEFAULT_PROFILE, useSaans } from '@/context/SaansContext';
import { reverseGeocode, searchCities } from '@/services/api';
import { BrandMark } from './BrandMark';

const QUICK_LOCATIONS: LocationInfo[] = [
  {
    name: 'New Delhi',
    admin1: 'Delhi',
    country: 'India',
    latitude: 28.6139,
    longitude: 77.209,
    timezone: 'Asia/Kolkata',
    source: 'geocoding',
  },
  {
    name: 'Mumbai',
    admin1: 'Maharashtra',
    country: 'India',
    latitude: 19.076,
    longitude: 72.8777,
    timezone: 'Asia/Kolkata',
    source: 'geocoding',
  },
  {
    name: 'Bengaluru',
    admin1: 'Karnataka',
    country: 'India',
    latitude: 12.9716,
    longitude: 77.5946,
    timezone: 'Asia/Kolkata',
    source: 'geocoding',
  },
  {
    name: 'Lucknow',
    admin1: 'Uttar Pradesh',
    country: 'India',
    latitude: 26.8467,
    longitude: 80.9462,
    timezone: 'Asia/Kolkata',
    source: 'geocoding',
  },
  {
    name: 'Pune',
    admin1: 'Maharashtra',
    country: 'India',
    latitude: 18.5204,
    longitude: 73.8567,
    timezone: 'Asia/Kolkata',
    source: 'geocoding',
  },
];

export function OnboardingFlow() {
  const { completeOnboarding, setIsDemoTourOpen } = useSaans();
  const [step, setStep] = useState<number>(1);
  const [draft, setDraft] = useState<HouseholdProfile>(DEFAULT_PROFILE);

  const [cityQuery, setCityQuery] = useState('');
  const [cityResults, setCityResults] = useState<LocationInfo[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = cityQuery.trim();
    if (trimmed.length < 2) {
      return;
    }
    let active = true;
    const timer = setTimeout(async () => {
      if (!active) return;
      setSearching(true);
      setLocError(null);
      try {
        const res = await searchCities(trimmed);
        if (active) setCityResults(res);
      } catch {
        if (active) {
          setLocError('Search temporarily unavailable — pick a quick city or try Demo Mode.');
        }
      } finally {
        if (active) setSearching(false);
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [cityQuery]);

  const handleCityQueryChange = (value: string) => {
    setCityQuery(value);
    if (value.trim().length < 2) {
      setCityResults([]);
      setSearching(false);
    }
  };

  const handleGeolocation = () => {
    if (!navigator.geolocation) {
      setLocError('Geolocation is unavailable in this browser.');
      return;
    }
    setLocating(true);
    setLocError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const loc = await reverseGeocode(
            pos.coords.latitude,
            pos.coords.longitude,
          );
          setDraft((prev) => ({ ...prev, location: loc }));
        } catch {
          setDraft((prev) => ({
            ...prev,
            location: {
              name: `${pos.coords.latitude.toFixed(2)}°, ${pos.coords.longitude.toFixed(2)}°`,
              country: 'Current Location',
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              timezone: 'auto',
              source: 'geolocation',
            },
          }));
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        setLocError('Could not access GPS location. You can choose a city manually below.');
      },
      { timeout: 10000 },
    );
  };

  const handleQuickDemo = () => {
    completeOnboarding(
      {
        ...DEFAULT_PROFILE,
        householdName: 'Meera & Aarav’s Home',
        onboardingCompleted: true,
      },
      true,
    );
    setIsDemoTourOpen(true);
  };

  const steps = [
    { num: 1, label: 'Location', icon: MapPin },
    { num: 2, label: 'Household', icon: Users },
    { num: 3, label: 'Commute', icon: Wind },
    { num: 4, label: 'Home & Goals', icon: Home },
  ];

  return (
    <div className="min-h-screen bg-[#F7F6F2] flex flex-col">
      {/* Top minimal bar */}
      <header className="max-w-5xl w-full mx-auto px-5 pt-6 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <BrandMark className="w-9 h-9" />
          <div>
            <span className="text-lg font-bold tracking-tight text-[#151B18]">
              SAANS
            </span>
            <p className="text-[11px] text-[#717D77] -mt-0.5">
              Know the air. Change your day.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleQuickDemo}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#1B4332] text-white hover:bg-[#143326] transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Try Guided Demo</span>
          </button>
          <button
            type="button"
            onClick={() => completeOnboarding(draft, false)}
            className="px-3 py-2 rounded-xl text-xs font-medium text-[#4A5550] hover:bg-[#ECE9DF] transition-colors cursor-pointer"
          >
            Skip setup
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-5 py-6 flex flex-col justify-center">
        {/* Intro editorial headline */}
        <div className="text-center mb-8">
          <h1 className="font-serif-editorial text-4xl sm:text-5xl text-[#151B18] leading-tight">
            Air quality advice built around{' '}
            <span className="italic text-[#1B4332]">your household</span>.
          </h1>
          <p className="mt-2.5 text-sm sm:text-base text-[#4A5550] max-w-xl mx-auto">
            Instead of showing a single AQI number, SAANS combines live forecasts
            with your family’s daily rhythm to recommend practical exposure and
            low-emission choices.
          </p>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-2 sm:gap-4 mb-6">
          {steps.map((s) => {
            const Icon = s.icon;
            const active = step === s.num;
            const done = step > s.num;
            return (
              <button
                key={s.num}
                type="button"
                onClick={() => setStep(s.num)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#1B4332] text-white'
                    : done
                      ? 'bg-[#E6F0EB] text-[#1B4332]'
                      : 'bg-white border border-[#E6E3DA] text-[#717D77]'
                }`}
              >
                {done ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Icon className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            );
          })}
        </div>

        {/* Main Card */}
        <div className="saans-card p-6 sm:p-8">
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-semibold text-[#151B18]">
                  Where is your household located?
                </h2>
                <p className="text-sm text-[#4A5550] mt-1">
                  We fetch modelled hourly air-quality forecasts for your city
                  using Open-Meteo (Copernicus CAMS). Everything stays saved
                  locally on your device.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-[#717D77] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={cityQuery}
                    onChange={(e) => handleCityQueryChange(e.target.value)}
                    placeholder="Search your city (e.g., New Delhi, Bengaluru, Jaipur)..."
                    className="w-full pl-10 pr-4 py-3 text-sm rounded-xl border border-[#D4D0C4] bg-[#FAF9F6] focus:bg-white focus:border-[#2D6A4F] outline-none"
                  />
                  {searching && (
                    <Loader2 className="w-4 h-4 text-[#2D6A4F] animate-spin absolute right-3.5 top-1/2 -translate-y-1/2" />
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleGeolocation}
                  disabled={locating}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-semibold bg-[#E6F0EB] text-[#1B4332] hover:bg-[#D5E7DD] transition-colors cursor-pointer"
                >
                  {locating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Compass className="w-4 h-4" />
                  )}
                  <span>Use My Location</span>
                </button>
              </div>

              {locError && (
                <p className="text-xs text-[#991B1B] bg-[#FDECEC] border border-[#F5BDBD] rounded-xl px-3 py-2">
                  {locError}
                </p>
              )}

              {cityResults.length > 0 && (
                <div className="border border-[#E6E3DA] rounded-xl divide-y divide-[#F0EEE7] max-h-48 overflow-y-auto">
                  {cityResults.map((c, idx) => (
                    <button
                      key={`${c.name}-${idx}`}
                      type="button"
                      onClick={() => {
                        setDraft((prev) => ({ ...prev, location: c }));
                        setCityQuery('');
                        setCityResults([]);
                      }}
                      className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-[#F7F6F2] cursor-pointer"
                    >
                      <span className="text-sm font-medium text-[#151B18]">
                        {c.name}{' '}
                        <span className="text-[#717D77] font-normal">
                          {[c.admin1, c.country].filter(Boolean).join(', ')}
                        </span>
                      </span>
                      <span className="text-xs text-[#2D6A4F] font-medium">
                        Select
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <div>
                <p className="text-xs font-medium text-[#717D77] mb-2">
                  Selected location:{' '}
                  <strong className="text-[#151B18]">
                    {draft.location.name}
                    {draft.location.country ? `, ${draft.location.country}` : ''}
                  </strong>
                </p>
                <div className="flex flex-wrap gap-2">
                  {QUICK_LOCATIONS.map((loc) => {
                    const selected = draft.location.name === loc.name;
                    return (
                      <button
                        key={loc.name}
                        type="button"
                        onClick={() =>
                          setDraft((prev) => ({ ...prev, location: loc }))
                        }
                        className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                          selected
                            ? 'bg-[#1B4332] text-white border-[#1B4332]'
                            : 'bg-[#FAF9F6] text-[#151B18] border-[#E6E3DA] hover:border-[#2D6A4F]'
                        }`}
                      >
                        {loc.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-[#151B18]">
                  Who shares this home?
                </h2>
                <p className="text-sm text-[#4A5550] mt-1">
                  Helps SAANS tailor outdoor activity timing and indoor air
                  priorities. No personal or medical details required.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#4A5550] mb-1.5">
                  Household label (optional)
                </label>
                <input
                  type="text"
                  value={draft.householdName}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      householdName: e.target.value,
                    }))
                  }
                  placeholder="e.g., Sharma Family or My Apartment"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#D4D0C4] bg-[#FAF9F6] focus:bg-white focus:border-[#2D6A4F] outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(
                  [
                    { key: 'adults', label: 'Adults', sub: 'Ages 18–59', min: 1 },
                    { key: 'children', label: 'Children', sub: 'Under 18', min: 0 },
                    {
                      key: 'olderAdults',
                      label: 'Older Adults',
                      sub: 'Ages 60+',
                      min: 0,
                    },
                  ] as const
                ).map((item) => (
                  <div
                    key={item.key}
                    className="p-4 rounded-xl border border-[#E6E3DA] bg-[#FAF9F6] flex flex-col justify-between"
                  >
                    <div>
                      <div className="text-sm font-semibold text-[#151B18]">
                        {item.label}
                      </div>
                      <div className="text-xs text-[#717D77]">{item.sub}</div>
                    </div>
                    <div className="flex items-center justify-between mt-4">
                      <button
                        type="button"
                        onClick={() =>
                          setDraft((prev) => ({
                            ...prev,
                            [item.key]: Math.max(item.min, prev[item.key] - 1),
                          }))
                        }
                        className="w-8 h-8 rounded-lg bg-white border border-[#D4D0C4] text-[#151B18] font-semibold hover:bg-[#F0EEE7] cursor-pointer"
                        aria-label={`Decrease ${item.label}`}
                      >
                        −
                      </button>
                      <span className="font-mono-tabular text-lg font-semibold text-[#151B18]">
                        {draft[item.key]}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setDraft((prev) => ({
                            ...prev,
                            [item.key]: Math.min(8, prev[item.key] + 1),
                          }))
                        }
                        className="w-8 h-8 rounded-lg bg-white border border-[#D4D0C4] text-[#151B18] font-semibold hover:bg-[#F0EEE7] cursor-pointer"
                        aria-label={`Increase ${item.label}`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <div className="text-xs font-semibold text-[#4A5550] mb-1">
                  Extra air-sensitivity precaution preference (optional)
                </div>
                <p className="text-xs text-[#717D77] mb-2.5">
                  General comfort preference only — SAANS does not collect
                  medical diagnoses or offer medical advice.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {(
                    [
                      {
                        val: 'none',
                        title: 'Standard',
                        desc: 'General urban precautions',
                      },
                      {
                        val: 'mild',
                        title: 'Cautious',
                        desc: 'Prefer gentler outdoor limits on moderate/hazy days',
                      },
                      {
                        val: 'elevated',
                        title: 'High Precaution',
                        desc: 'Prioritise indoor comfort and early alerts',
                      },
                    ] as Array<{
                      val: RespiratorySensitivity;
                      title: string;
                      desc: string;
                    }>
                  ).map((opt) => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() =>
                        setDraft((prev) => ({
                          ...prev,
                          respiratorySensitivity: opt.val,
                        }))
                      }
                      className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                        draft.respiratorySensitivity === opt.val
                          ? 'bg-[#E6F0EB] border-[#2D6A4F] text-[#1B4332]'
                          : 'bg-white border-[#E6E3DA] hover:border-[#C5C0B3]'
                      }`}
                    >
                      <div className="text-sm font-semibold">{opt.title}</div>
                      <div className="text-xs text-[#4A5550] mt-0.5">
                        {opt.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-[#151B18]">
                  How does your day move?
                </h2>
                <p className="text-sm text-[#4A5550] mt-1">
                  SAANS adapts commute protection, activity rescheduling, and
                  low-emission alternatives to your real routine.
                </p>
              </div>

              <div>
                <div className="text-xs font-semibold text-[#4A5550] mb-2">
                  Primary daily commute
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {(
                    [
                      { val: 'public_transport', label: 'Public Transit' },
                      { val: 'car', label: 'Private Car' },
                      { val: 'two_wheeler', label: 'Two-Wheeler' },
                      { val: 'walking', label: 'Walking' },
                      { val: 'cycling', label: 'Cycling' },
                      { val: 'wfh', label: 'Work From Home' },
                    ] as Array<{ val: CommuteType; label: string }>
                  ).map((opt) => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() =>
                        setDraft((prev) => ({ ...prev, commuteType: opt.val }))
                      }
                      className={`px-3.5 py-3 rounded-xl border text-sm font-medium transition-colors cursor-pointer ${
                        draft.commuteType === opt.val
                          ? 'bg-[#1B4332] text-white border-[#1B4332]'
                          : 'bg-[#FAF9F6] text-[#151B18] border-[#E6E3DA] hover:border-[#2D6A4F]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {draft.commuteType !== 'wfh' && (
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-[#4A5550] mb-2">
                    <span>Typical one-way commute distance</span>
                    <span className="font-mono-tabular text-[#1B4332]">
                      {draft.commuteDistanceKm} km
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={45}
                    value={draft.commuteDistanceKm}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        commuteDistanceKm: Number(e.target.value),
                      }))
                    }
                    className="w-full accent-[#1B4332]"
                  />
                  <div className="flex justify-between text-[11px] text-[#717D77]">
                    <span>1 km</span>
                    <span>20 km</span>
                    <span>45 km</span>
                  </div>
                </div>
              )}

              <div>
                <div className="text-xs font-semibold text-[#4A5550] mb-2">
                  Typical outdoor activity or commute window
                </div>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { val: 'early_morning', label: 'Early Morning (6–9 AM)' },
                      { val: 'mid_morning', label: 'Mid-Morning (9–12 PM)' },
                      { val: 'afternoon', label: 'Afternoon (12–4 PM)' },
                      { val: 'evening', label: 'Evening (5–8 PM)' },
                      { val: 'flexible', label: 'Flexible Schedule' },
                    ] as Array<{ val: OutdoorWindowPref; label: string }>
                  ).map((opt) => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() =>
                        setDraft((prev) => ({
                          ...prev,
                          outdoorWindow: opt.val,
                        }))
                      }
                      className={`px-3.5 py-2 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                        draft.outdoorWindow === opt.val
                          ? 'bg-[#E6F0EB] text-[#1B4332] border-[#2D6A4F]'
                          : 'bg-white text-[#4A5550] border-[#E6E3DA] hover:border-[#2D6A4F]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-semibold text-[#151B18]">
                  Home environment & sustainability goals
                </h2>
                <p className="text-sm text-[#4A5550] mt-1">
                  Ensures indoor tips stay practical and affordable for your
                  actual setup — no unnecessary hardware upsells.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-semibold text-[#4A5550] mb-1.5">
                    Home type
                  </div>
                  <div className="flex gap-2">
                    {(
                      [
                        { val: 'apartment', label: 'Apartment' },
                        { val: 'independent_house', label: 'House' },
                        { val: 'other', label: 'Other' },
                      ] as Array<{ val: HomeType; label: string }>
                    ).map((opt) => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() =>
                          setDraft((prev) => ({ ...prev, homeType: opt.val }))
                        }
                        className={`flex-1 py-2 px-2.5 rounded-xl border text-xs font-medium cursor-pointer ${
                          draft.homeType === opt.val
                            ? 'bg-[#1B4332] text-white border-[#1B4332]'
                            : 'bg-[#FAF9F6] border-[#E6E3DA] text-[#151B18]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold text-[#4A5550] mb-1.5">
                    Do you own an air purifier?
                  </div>
                  <div className="flex gap-2">
                    {[
                      { val: true, label: 'Yes, HEPA purifier' },
                      { val: false, label: 'No purifier' },
                    ].map((opt) => (
                      <button
                        key={String(opt.val)}
                        type="button"
                        onClick={() =>
                          setDraft((prev) => ({
                            ...prev,
                            hasAirPurifier: opt.val,
                          }))
                        }
                        className={`flex-1 py-2 px-2.5 rounded-xl border text-xs font-medium cursor-pointer ${
                          draft.hasAirPurifier === opt.val
                            ? 'bg-[#1B4332] text-white border-[#1B4332]'
                            : 'bg-[#FAF9F6] border-[#E6E3DA] text-[#151B18]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold text-[#4A5550] mb-1.5">
                    Primary indoor ventilation
                  </div>
                  <select
                    value={draft.ventilationOption}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        ventilationOption: e.target.value as VentilationOption,
                      }))
                    }
                    className="w-full px-3 py-2 text-xs rounded-xl border border-[#D4D0C4] bg-[#FAF9F6] text-[#151B18]"
                  >
                    <option value="cross_ventilation">
                      Windows with cross-ventilation
                    </option>
                    <option value="exhaust_fan">
                      Kitchen / room exhaust fans
                    </option>
                    <option value="ac_recirculate">
                      Split / central AC (recirculation)
                    </option>
                    <option value="limited">
                      Limited single-side windows
                    </option>
                  </select>
                </div>

                <div>
                  <div className="text-xs font-semibold text-[#4A5550] mb-1.5">
                    Primary cooking setup
                  </div>
                  <select
                    value={draft.cookingFuel}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        cookingFuel: e.target.value as CookingFuel,
                      }))
                    }
                    className="w-full px-3 py-2 text-xs rounded-xl border border-[#D4D0C4] bg-[#FAF9F6] text-[#151B18]"
                  >
                    <option value="lpg_gas">LPG / Piped Gas Stove</option>
                    <option value="induction_electric">
                      Induction / Electric
                    </option>
                    <option value="mixed">Mixed (Gas + Induction)</option>
                  </select>
                </div>

                <div>
                  <div className="text-xs font-semibold text-[#4A5550] mb-1.5">
                    Priority focus
                  </div>
                  <select
                    value={draft.sustainabilityFocus}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        sustainabilityFocus: e.target
                          .value as SustainabilityFocus,
                      }))
                    }
                    className="w-full px-3 py-2 text-xs rounded-xl border border-[#D4D0C4] bg-[#FAF9F6] text-[#151B18]"
                  >
                    <option value="balanced">
                      Balanced (Exposure + Low Emissions)
                    </option>
                    <option value="exposure_first">
                      Family Exposure Protection First
                    </option>
                    <option value="low_emission_priority">
                      Low-Emission Lifestyle Focus
                    </option>
                  </select>
                </div>

                <div>
                  <div className="text-xs font-semibold text-[#4A5550] mb-1.5">
                    Budget comfort for home changes
                  </div>
                  <select
                    value={draft.budgetPreference}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        budgetPreference: e.target.value as BudgetPreference,
                      }))
                    }
                    className="w-full px-3 py-2 text-xs rounded-xl border border-[#D4D0C4] bg-[#FAF9F6] text-[#151B18]"
                  >
                    <option value="zero_cost">
                      Zero-cost / behavioural steps only
                    </option>
                    <option value="moderate">
                      Moderate (masks, weatherstrips, filters)
                    </option>
                    <option value="flexible">
                      Flexible (open to home upgrades)
                    </option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Footer actions */}
          <div className="mt-8 pt-5 border-t border-[#ECE9DF] flex items-center justify-between">
            <div>
              {step > 1 ? (
                <button
                  type="button"
                  onClick={() => setStep((s) => s - 1)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-[#4A5550] hover:bg-[#F0EEE7] transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs text-[#717D77]">
                  <Leaf className="w-3.5 h-3.5 text-[#2D6A4F]" />
                  <span>Stored locally · Edit anytime</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {step < 4 ? (
                <>
                  <button
                    type="button"
                    onClick={() => setStep((s) => s + 1)}
                    className="px-3.5 py-2.5 rounded-xl text-xs font-medium text-[#717D77] hover:text-[#151B18] cursor-pointer"
                  >
                    Skip step
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep((s) => s + 1)}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#1B4332] text-white hover:bg-[#143326] transition-colors cursor-pointer"
                  >
                    <span>Continue</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => completeOnboarding(draft, false)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#1B4332] text-white hover:bg-[#143326] transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Build My Daily Air Plan</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
