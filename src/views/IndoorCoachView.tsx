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
import {
  buildIndoorActions,
  formatCookingFuelLabel,
  getWindowGuidance,
} from '@shared/indoorCoach';
import { useSaans } from '@/context/SaansContext';
import {
  parseStoredStringArray,
  readStorageJson,
  writeStorageJson,
} from '@/utils/storage';

const STORAGE_INDOOR_KEY = 'saans_indoor_checks_v1';

export function IndoorCoachView() {
  const { profile, airData, setIsProfileEditorOpen } = useSaans();
  const [checkedIds, setCheckedIds] = useState<string[]>(() =>
    readStorageJson(STORAGE_INDOOR_KEY, [], parseStoredStringArray),
  );

  useEffect(() => {
    writeStorageJson(STORAGE_INDOOR_KEY, checkedIds);
  }, [checkedIds]);

  const toggleItem = (id: string) => {
    setCheckedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const windowGuide = getWindowGuidance(airData);
  const actions = buildIndoorActions(profile, airData);
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
            <strong>{formatCookingFuelLabel(profile.cookingFuel)}</strong>{' '}
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
              windowGuide.isHigh
                ? 'bg-[#FDECEC] text-[#991B1B]'
                : 'bg-[#E6F0EB] text-[#1B4332]'
            }`}
          >
            {windowGuide.isHigh ? (
              <DoorClosed className="w-5 h-5" />
            ) : (
              <Wind className="w-5 h-5" />
            )}
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-[#717D77]">
              Current Window Guidance · {airData?.location.name}
            </div>
            <h2 className="text-lg font-semibold text-[#151B18] mt-0.5">
              {windowGuide.headline}
            </h2>
            <p className="text-xs text-[#4A5550] mt-1 leading-relaxed">
              {windowGuide.aqiAvailable ? (
                <>
                  Modelled outdoor US AQI is <strong>{windowGuide.rawAqi}</strong> (
                  {windowGuide.categoryLabel}).{' '}
                </>
              ) : (
                <>
                  Live outdoor AQI is currently unavailable — apply precautionary
                  window habits.{' '}
                </>
              )}
              {windowGuide.lowerWindowLabel
                ? `Relatively lower forecast window: ${windowGuide.lowerWindowLabel}.`
                : ''}{' '}
              {windowGuide.peakWindowLabel
                ? `Upcoming peak window: ${windowGuide.peakWindowLabel}.`
                : ''}
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
