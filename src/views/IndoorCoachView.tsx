import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Circle,
  DoorClosed,
  Fan,
  Flame,
  Home,
  Sparkles,
  Wind,
} from 'lucide-react';
import { formatTimeRange, getUsAqiCategory } from '@shared/aqi';
import { useSaans } from '@/context/SaansContext';

interface IndoorAction {
  id: string;
  category: string;
  title: string;
  guidance: string;
  costTag: 'Zero cost' | 'Uses your gear' | 'Low cost optional';
  relevance: string;
}

const STORAGE_INDOOR_KEY = 'saans_indoor_checks_v1';

export function IndoorCoachView() {
  const { profile, airData, setIsProfileEditorOpen } = useSaans();
  const [checkedIds, setCheckedIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_INDOOR_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_INDOOR_KEY, JSON.stringify(checkedIds));
    } catch {
      // Ignore
    }
  }, [checkedIds]);

  const toggleItem = (id: string) => {
    setCheckedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const rawAqi = airData?.current.usAqi ?? null;
  const aqiAvailable = rawAqi !== null;
  const aqi = rawAqi ?? 0;
  const cat = getUsAqiCategory(rawAqi);
  const high = aqiAvailable && aqi >= 151;
  const elevated = aqiAvailable && aqi >= 101;

  const lowerWin = airData?.summary.lowerWindow
    ? formatTimeRange(
        airData.summary.lowerWindow.startTime,
        airData.summary.lowerWindow.endTime,
      )
    : null;
  const peakWin = airData?.summary.peakWindow
    ? formatTimeRange(
        airData.summary.peakWindow.startTime,
        airData.summary.peakWindow.endTime,
      )
    : null;

  const actions: IndoorAction[] = [
    {
      id: 'windows',
      category: 'Windows & Ventilation Timing',
      title: high
        ? 'Keep outside-facing windows closed right now'
        : 'Time your short indoor ventilation window',
      guidance: high
        ? `Outdoor modelled air is ${cat.label} (${aqi} US AQI). Keep street-facing and balcony windows shut${
            peakWin ? `, especially through ${peakWin}` : ''
          }. ${
            lowerWin
              ? `If indoor air feels stuffy, limit fresh-air exchange to a brief 10-minute refresh near ${lowerWin}.`
              : 'Wait for an afternoon dip before briefly airing rooms.'
          }`
        : `Schedule a 15–20 minute ${
            profile.ventilationOption === 'cross_ventilation'
              ? 'cross-ventilation flush across opposite windows'
              : 'window air refresh'
          }${
            lowerWin ? ` during the relatively lower ${lowerWin} window` : ''
          }, then close windows ahead of evening traffic buildup.`,
      costTag: 'Zero cost',
      relevance: `Adapted to ${profile.homeType.replace('_', ' ')} + ${profile.ventilationOption.replace('_', ' ')}`,
    },
    {
      id: 'cooking',
      category: 'Cooking & Kitchen Air',
      title:
        profile.cookingFuel === 'induction_electric'
          ? 'Control cooking oil aerosols with lids & exhaust'
          : 'Vent out LPG/gas stove NO₂ and cooking smoke',
      guidance:
        profile.cookingFuel === 'induction_electric'
          ? 'Electric and induction stoves avoid combustion NO₂, but high-heat tempering and frying still release fine PM2.5 aerosols. Cover pans with lids, run an exhaust fan if available, and shut bedroom doors while cooking.'
          : 'Gas burners release indoor NO₂ and fine particulates quickly when windows are shut. Run your kitchen chimney/exhaust fan continuously from ignition until 10 minutes after cooking, use back burners, and keep the kitchen door closed.',
      costTag: 'Zero cost',
      relevance: `Tailored to ${
        profile.cookingFuel === 'lpg_gas'
          ? 'LPG / gas'
          : profile.cookingFuel === 'induction_electric'
            ? 'induction / electric'
            : 'mixed'
      } kitchen`,
    },
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
    profile.hasAirPurifier
      ? {
          id: 'purifier',
          category: 'HEPA Air Purifier Strategy',
          title: 'Concentrate HEPA filtration in occupied rooms',
          guidance: `Place your HEPA purifier centrally (at least 30 cm from walls) in the main family room during the day and move it to the bedroom 45 minutes before sleep. Keep doors and windows closed while running, and vacuum the washable pre-filter weekly during winter smog.`,
          costTag: 'Uses your gear',
          relevance: 'Using your existing HEPA purifier efficiently',
        }
      : {
          id: 'no_purifier',
          category: 'Protection Without an Air Purifier',
          title: 'Create a low-draft “cleaner room” without buying hardware',
          guidance:
            profile.budgetPreference === 'zero_cost'
              ? 'Designate one inner bedroom away from the main street as your cleaner-air room: block under-door gaps with a rolled cotton towel, keep its door closed during cooking, and damp-wipe surfaces daily.'
              : 'Block window and door drafts with affordable foam weatherstripping tape and keep an inner bedroom closed during peak smog. If you ever consider a HEPA purifier later, size it to the room’s CADR rather than overspending on smart extras.',
          costTag:
            profile.budgetPreference === 'zero_cost'
              ? 'Zero cost'
              : 'Low cost optional',
          relevance: 'Practical guidance without requiring an air purifier',
        },
    {
      id: 'activities',
      category: 'Indoor Family Routines',
      title:
        profile.children > 0
          ? 'Keep children’s active play engaging indoors'
          : 'Shift brisk movement indoors on elevated-AQI hours',
      guidance:
        profile.children > 0
          ? elevated
            ? 'Swap evening park runs for indoor obstacle courses, dance sessions, or stretching games while outdoor PM2.5 is elevated — keeping kids active without heavy smog inhalation.'
            : 'Keep a quick indoor play backup ready if evening visibility or haze worsens.'
          : elevated
            ? 'Move cardio, yoga, or strength training indoors today; indoor breathing air generally carries less coarse dust and traffic exhaust than roadside air.'
            : 'Use indoor mobility sessions during rush hours and reserve outdoor walks for quieter lower-AQI windows.',
      costTag: 'Zero cost',
      relevance:
        profile.children > 0
          ? `Tailored for ${profile.children} child${profile.children > 1 ? 'ren' : ''}`
          : 'Adapted to household activity profile',
    },
  ];

  const completedCount = actions.filter((a) => checkedIds.includes(a.id)).length;
  const pct = Math.round((completedCount / actions.length) * 100);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#2D6A4F]">
            Indoor Air Quality Coach
          </p>
          <h1 className="font-serif-editorial text-3xl sm:text-4xl text-[#151B18] mt-1">
            Make Your Home Air-Ready
          </h1>
          <p className="text-sm text-[#4A5550] mt-1 max-w-2xl">
            Practical, affordable indoor guidance matched to your{' '}
            <strong>{profile.homeType.replace('_', ' ')}</strong>,{' '}
            <strong>
              {profile.cookingFuel === 'lpg_gas'
                ? 'LPG / gas'
                : profile.cookingFuel === 'induction_electric'
                  ? 'induction / electric'
                  : 'mixed'}
            </strong>{' '}
            kitchen, and{' '}
            <strong>
              {profile.hasAirPurifier ? 'HEPA purifier setup' : 'no-purifier setup'}
            </strong>
            .
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsProfileEditorOpen(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-[#D4D0C4] text-[#151B18] hover:border-[#2D6A4F] self-start md:self-auto cursor-pointer"
        >
          <Home className="w-3.5 h-3.5 text-[#1B4332]" />
          <span>Update Home Setup</span>
        </button>
      </div>

      {/* Live Window Recommendation Banner */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 saans-card p-5 flex items-start gap-4">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
              high
                ? 'bg-[#FDECEC] text-[#991B1B]'
                : 'bg-[#E6F0EB] text-[#1B4332]'
            }`}
          >
            {high ? <DoorClosed className="w-5 h-5" /> : <Wind className="w-5 h-5" />}
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-[#717D77]">
              Current Window Guidance · {airData?.location.name}
            </div>
            <h2 className="text-lg font-semibold text-[#151B18] mt-0.5">
              {high
                ? 'Keep exterior windows closed right now'
                : elevated
                  ? 'Keep street-facing windows shut; ventilate briefly in the lower window'
                  : 'Good window for a brief 15-minute indoor air refresh'}
            </h2>
            <p className="text-xs text-[#4A5550] mt-1 leading-relaxed">
              {aqiAvailable ? (
                <>
                  Modelled outdoor US AQI is <strong>{rawAqi}</strong> ({cat.label}).{' '}
                </>
              ) : (
                <>Live outdoor AQI is currently unavailable — apply precautionary window habits. </>
              )}
              {lowerWin
                ? `Relatively lower forecast window: ${lowerWin}.`
                : ''}{' '}
              {peakWin ? `Upcoming peak window: ${peakWin}.` : ''}
            </p>
          </div>
        </div>

        {/* Readiness Progress */}
        <div className="saans-card p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#4A5550]">
              Today’s Home Readiness
            </span>
            <span className="font-mono-tabular text-sm font-bold text-[#1B4332]">
              {completedCount}/{actions.length}
            </span>
          </div>
          <div className="my-3 h-2.5 w-full rounded-full bg-[#EFECE4] overflow-hidden">
            <div
              className="h-full rounded-full bg-[#1B4332] transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-[#717D77]">
            {pct === 100
              ? 'Every indoor air habit is checked off for today.'
              : 'Tap any recommendation below as you complete it.'}
          </p>
        </div>
      </div>

      {/* Checklist Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {actions.map((item) => {
          const done = checkedIds.includes(item.id);
          return (
            <div
              key={item.id}
              onClick={() => toggleItem(item.id)}
              role="checkbox"
              aria-checked={done}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleItem(item.id);
                }
              }}
              className={`saans-card p-5 transition-all cursor-pointer select-none ${
                done
                  ? 'bg-[#F4F8F5] border-[#B8DFC9]'
                  : 'hover:border-[#2D6A4F]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#2D6A4F]">
                  {item.id === 'cooking' ? (
                    <Flame className="w-3.5 h-3.5" />
                  ) : item.id === 'purifier' ? (
                    <Fan className="w-3.5 h-3.5" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  <span>{item.category}</span>
                </div>
                {done ? (
                  <CheckCircle2 className="w-5 h-5 text-[#1B4332] shrink-0" />
                ) : (
                  <Circle className="w-5 h-5 text-[#C5C0B3] shrink-0" />
                )}
              </div>

              <h3
                className={`text-base font-semibold mt-2 ${
                  done ? 'line-through text-[#4A5550]' : 'text-[#151B18]'
                }`}
              >
                {item.title}
              </h3>
              <p className="text-xs text-[#4A5550] mt-1.5 leading-relaxed">
                {item.guidance}
              </p>

              <div className="mt-4 pt-3 border-t border-[#ECE9DF] flex items-center justify-between gap-2 text-[11px]">
                <span className="text-[#717D77]">{item.relevance}</span>
                <span className="px-2 py-0.5 rounded-full bg-[#F0EEE7] text-[#4A5550] font-medium shrink-0">
                  {item.costTag}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
