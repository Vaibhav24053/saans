import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  Minus,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Wind,
} from 'lucide-react';
import {
  formatTimeRange,
  getAqiCategory,
  POLLUTANT_META,
} from '@shared/aqi';
import type {
  AirQualityData,
  AqiScale,
  DailyPlanResponse,
} from '@shared/types';
import { AiSourceBadge, AqiStatusBadge } from '@/components/StatusBadges';

export function LiveMetricsStrip({
  airData,
  aqiScale,
  onOpenIntelligence,
}: {
  airData: AirQualityData;
  aqiScale: AqiScale;
  onOpenIntelligence: () => void;
}) {
  const displayedAqi =
    aqiScale === 'us_aqi' ? airData.current.usAqi : airData.current.europeanAqi;
  const aqiCat = getAqiCategory(displayedAqi, aqiScale);
  const dominantMeta = POLLUTANT_META[airData.summary.dominantPollutant];

  const TrendIcon =
    airData.summary.trendDirection === 'improving'
      ? ArrowDownRight
      : airData.summary.trendDirection === 'worsening'
        ? ArrowUpRight
        : Minus;

  const trendColors =
    airData.summary.trendDirection === 'improving'
      ? 'text-[#1E563B] bg-[#E6F4EC] border-[#BFE2CE]'
      : airData.summary.trendDirection === 'worsening'
        ? 'text-[#991B1B] bg-[#FDECEC] border-[#F5BDBD]'
        : 'text-[#4A5550] bg-[#F0EEE7] border-[#DDD8CC]';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* AQI Primary Reading */}
      <div className="lg:col-span-5 saans-card p-5 flex flex-col justify-between">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#717D77]">
              {aqiScale === 'us_aqi'
                ? 'US EPA AQI (0–500 Scale)'
                : 'European AQI (0–100+ Scale)'}
            </span>
            <div className="flex items-baseline gap-3 mt-1.5">
              <span className="font-mono-tabular text-5xl font-bold tracking-tight text-[#151B18]">
                {displayedAqi ?? '—'}
              </span>
              <AqiStatusBadge aqi={displayedAqi} scale={aqiScale} size="md" />
            </div>
          </div>
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border"
            style={{
              backgroundColor: aqiCat.bgColor,
              borderColor: aqiCat.borderColor,
              color: aqiCat.textColor,
            }}
          >
            <Wind className="w-5 h-5" />
          </div>
        </div>

        <p className="text-xs text-[#4A5550] mt-3 leading-relaxed">
          {aqiCat.summary}
        </p>

        <div className="mt-4 pt-3 border-t border-[#F0EEE7] flex items-center justify-between text-[11px] text-[#717D77]">
          <span>
            Primary driver:{' '}
            <strong className="text-[#151B18]">{dominantMeta.symbol}</strong>
          </span>
          <button
            type="button"
            onClick={onOpenIntelligence}
            className="text-[#1B4332] font-semibold hover:underline cursor-pointer"
          >
            View pollutants →
          </button>
        </div>
      </div>

      {/* PM2.5, PM10, Trend */}
      <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="saans-card p-5 flex flex-col justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#717D77]">
            PM2.5 Fine Particles
          </span>
          <div className="mt-2">
            <div className="font-mono-tabular text-3xl font-bold text-[#151B18]">
              {airData.current.pm25 ?? '—'}
              <span className="text-xs font-normal text-[#717D77] ml-1">
                µg/m³
              </span>
            </div>
            <p className="text-[11px] text-[#717D77] mt-1.5">
              WHO 24h ref: {POLLUTANT_META.pm25.whoGuidelineValue} µg/m³
            </p>
          </div>
          {airData.current.pm25 !== null && (
            <div className="mt-3 text-[11px] font-medium text-[#4A5550]">
              {airData.current.pm25 > POLLUTANT_META.pm25.whoGuidelineValue
                ? `${(airData.current.pm25 / POLLUTANT_META.pm25.whoGuidelineValue).toFixed(1)}× WHO 24h benchmark`
                : 'Within WHO 24h guideline'}
            </div>
          )}
        </div>

        <div className="saans-card p-5 flex flex-col justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#717D77]">
            PM10 Coarse Dust
          </span>
          <div className="mt-2">
            <div className="font-mono-tabular text-3xl font-bold text-[#151B18]">
              {airData.current.pm10 ?? '—'}
              <span className="text-xs font-normal text-[#717D77] ml-1">
                µg/m³
              </span>
            </div>
            <p className="text-[11px] text-[#717D77] mt-1.5">
              WHO 24h ref: {POLLUTANT_META.pm10.whoGuidelineValue} µg/m³
            </p>
          </div>
          {airData.current.pm10 !== null && (
            <div className="mt-3 text-[11px] font-medium text-[#4A5550]">
              {airData.current.pm10 > POLLUTANT_META.pm10.whoGuidelineValue
                ? `${(airData.current.pm10 / POLLUTANT_META.pm10.whoGuidelineValue).toFixed(1)}× WHO 24h benchmark`
                : 'Within WHO 24h guideline'}
            </div>
          )}
        </div>

        <div className="saans-card p-5 flex flex-col justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#717D77]">
            6-Hour Trend
          </span>
          <div className="mt-2">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border capitalize ${trendColors}`}
            >
              <TrendIcon className="w-3.5 h-3.5" />
              {airData.summary.trendDirection}
            </span>
            <p className="text-xs text-[#4A5550] mt-2 leading-relaxed">
              {airData.summary.trendNote}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AirActionPlanHero({
  airData,
  householdSummaryText,
  plan,
  planLoading,
  planError,
  onEditHousehold,
  onRegeneratePlan,
  onOpenPlanner,
}: {
  airData: AirQualityData;
  householdSummaryText: string;
  plan: DailyPlanResponse | null;
  planLoading: boolean;
  planError: string | null;
  onEditHousehold: () => void;
  onRegeneratePlan: () => void;
  onOpenPlanner: () => void;
}) {
  return (
    <section
      aria-label="Your Air Action Plan"
      className="rounded-2xl bg-white border-2 border-[#1B4332]/15 shadow-sm overflow-hidden"
    >
      <div className="px-6 py-4 bg-[#F4F7F4] border-b border-[#E1E9E2] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#1B4332] text-white flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#1B4332]">
              Your Air Action Plan
            </h2>
            <p className="text-xs text-[#4A5550]">
              Tailored for {householdSummaryText} ·{' '}
              <button
                type="button"
                onClick={onEditHousehold}
                className="text-[#1B4332] font-semibold underline underline-offset-2 cursor-pointer"
              >
                Edit household
              </button>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {plan && (
            <AiSourceBadge
              source={plan.source}
              model={plan.model}
              fallbackReason={plan.fallbackReason}
            />
          )}
          <button
            type="button"
            onClick={onRegeneratePlan}
            disabled={planLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white border border-[#D4D0C4] text-[#151B18] hover:border-[#2D6A4F] disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${planLoading ? 'animate-spin' : ''}`}
            />
            <span>{planLoading ? 'Personalising…' : 'Refresh Plan'}</span>
          </button>
        </div>
      </div>

      <div className="p-6">
        {planLoading && !plan ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-6 bg-[#ECEAE2] rounded w-3/4" />
            <div className="h-16 bg-[#ECEAE2] rounded" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="h-28 bg-[#ECEAE2] rounded-xl" />
              <div className="h-28 bg-[#ECEAE2] rounded-xl" />
            </div>
          </div>
        ) : planError && !plan ? (
          <div className="p-4 rounded-xl bg-[#FDECEC] border border-[#F5BDBD] text-sm text-[#991B1B]">
            {planError}
          </div>
        ) : plan ? (
          <div className="space-y-5">
            <div>
              <h3 className="font-serif-editorial text-2xl sm:text-[28px] text-[#151B18] leading-snug">
                {plan.headline}
              </h3>
              <p className="text-sm text-[#4A5550] mt-2 leading-relaxed">
                {plan.heroSummary.currentConditions}
              </p>
            </div>

            {/* Immediate Action Banner */}
            <div className="p-4 rounded-xl bg-[#1B4332] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#B7E4C7]">
                  One Immediate Action Right Now
                </span>
                <p className="text-sm font-medium mt-1 leading-relaxed">
                  {plan.heroSummary.immediateAction}
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenPlanner}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-white text-[#1B4332] hover:bg-[#E6F0EB] transition-colors shrink-0 self-start sm:self-center cursor-pointer"
              >
                <span>Full Schedule</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Avoid vs Prioritise */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-[#FCF6F5] border border-[#F0D5D1]">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#991B1B] mb-2.5">
                  <ShieldAlert className="w-4 h-4" />
                  <span>What to Avoid Today</span>
                </div>
                <ul className="space-y-2">
                  {plan.heroSummary.avoidToday.map((item, idx) => (
                    <li
                      key={idx}
                      className="text-sm text-[#3F2321] flex items-start gap-2"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-[#C53030] mt-2 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-4 rounded-xl bg-[#F3F8F5] border border-[#CBE2D5]">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#1B4332] mb-2.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>What to Prioritise</span>
                </div>
                <ul className="space-y-2">
                  {plan.heroSummary.prioritiseToday.map((item, idx) => (
                    <li
                      key={idx}
                      className="text-sm text-[#1D3227] flex items-start gap-2"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-[#2D6A4F] mt-2 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Lower Pollution Window */}
            <div className="p-4 rounded-xl bg-[#EEF5F9] border border-[#CEE1EE] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <CalendarClock className="w-5 h-5 text-[#2B6CB0] shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-[#1F5489]">
                    Relatively Lower-Pollution Window
                  </div>
                  <p className="text-sm text-[#1E3A54] mt-0.5 leading-relaxed">
                    {plan.heroSummary.bestLowerWindowNote}
                  </p>
                </div>
              </div>
              {airData.summary.lowerWindow && (
                <div className="shrink-0 px-3 py-2 rounded-xl bg-white border border-[#CEE1EE] text-right">
                  <div className="text-xs font-bold text-[#151B18]">
                    {formatTimeRange(
                      airData.summary.lowerWindow.startTime,
                      airData.summary.lowerWindow.endTime,
                    )}
                  </div>
                  <div className="text-[11px] font-mono-tabular text-[#4A5550]">
                    ~{airData.summary.lowerWindow.avgUsAqi} US AQI avg
                  </div>
                </div>
              )}
            </div>

            {plan.source === 'fallback' && plan.fallbackReason && (
              <p className="text-[11px] text-[#717D77] bg-[#F7F6F2] border border-[#E6E3DA] rounded-xl px-3.5 py-2">
                <strong>Engine notice:</strong> {plan.fallbackReason}
              </p>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
