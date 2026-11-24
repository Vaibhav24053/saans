import {
  AlertCircle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  Clock,
  Home,
  Leaf,
  MapPin,
  MessageSquareText,
  Minus,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Wind,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  formatHourLabel,
  formatTimeRange,
  getAqiCategory,
  POLLUTANT_META,
} from '@shared/aqi';
import { useSaans } from '@/context/SaansContext';
import { AiSourceBadge, AqiStatusBadge } from '@/components/StatusBadges';

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function OverviewView() {
  const {
    profile,
    airData,
    airLoading,
    airError,
    aqiScale,
    setAqiScale,
    plan,
    planLoading,
    planError,
    regeneratePlan,
    refreshAirData,
    setActiveView,
    setIsLocationModalOpen,
    setIsProfileEditorOpen,
  } = useSaans();

  if (airLoading && !airData) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="h-32 rounded-2xl bg-[#ECEAE2]" />
        <div className="h-72 rounded-2xl bg-[#ECEAE2]" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="h-48 rounded-2xl bg-[#ECEAE2]" />
          <div className="h-48 rounded-2xl bg-[#ECEAE2]" />
        </div>
      </div>
    );
  }

  if (!airData) {
    return (
      <div className="saans-card p-8 text-center max-w-xl mx-auto my-8">
        <AlertCircle className="w-10 h-10 text-[#B91C1C] mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-[#151B18]">
          Air-quality forecast unavailable
        </h2>
        <p className="text-sm text-[#4A5550] mt-1.5">
          {airError ||
            'We could not reach the Open-Meteo air-quality service right now.'}
        </p>
        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => void refreshAirData()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#1B4332] text-white hover:bg-[#143326] cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Live Fetch</span>
          </button>
          <button
            type="button"
            onClick={() => setIsLocationModalOpen(true)}
            className="px-4 py-2 rounded-xl text-xs font-semibold border border-[#D4D0C4] text-[#151B18] hover:bg-[#F0EEE7] cursor-pointer"
          >
            Choose Another City
          </button>
        </div>
      </div>
    );
  }

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

  // Build next 24h chart data
  const nowPrefix = airData.currentTimeLocal.slice(0, 13);
  let nowIdx = airData.hourly.findIndex((h) => h.time.startsWith(nowPrefix));
  if (nowIdx < 0) nowIdx = 0;
  const chartData = airData.hourly.slice(nowIdx, nowIdx + 24).map((pt) => ({
    label: formatHourLabel(pt.time),
    value: aqiScale === 'us_aqi' ? pt.usAqi : pt.europeanAqi,
    pm25: pt.pm25,
  }));

  const updatedLabel = new Date(airData.fetchedAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const householdSummaryText = [
    `${profile.adults} adult${profile.adults > 1 ? 's' : ''}`,
    profile.children > 0
      ? `${profile.children} child${profile.children > 1 ? 'ren' : ''}`
      : null,
    profile.olderAdults > 0
      ? `${profile.olderAdults} senior${profile.olderAdults > 1 ? 's' : ''}`
      : null,
    profile.commuteType.replace('_', ' '),
    profile.hasAirPurifier ? 'HEPA purifier' : 'no purifier',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="space-y-6">
      {/* Editorial Greeting + Live Conditions Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#2D6A4F]">
            {getGreeting()}, {profile.householdName || 'Welcome home'}
          </p>
          <h1 className="font-serif-editorial text-3xl sm:text-4xl text-[#151B18] mt-1 leading-tight">
            Air outlook for{' '}
            <button
              type="button"
              onClick={() => setIsLocationModalOpen(true)}
              className="underline decoration-[#C7C2B4] decoration-2 underline-offset-4 hover:decoration-[#1B4332] transition-colors cursor-pointer"
            >
              {airData.location.name}
            </button>
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-[#717D77]">
            <span className="inline-flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-[#2D6A4F]" />
              {[airData.location.admin1, airData.location.country]
                .filter(Boolean)
                .join(', ')}
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              Updated {updatedLabel}
            </span>
            <span>·</span>
            <span>{airData.dataSourceLabel}</span>
          </div>
        </div>

        {/* Scale switcher + refresh */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <div
            className="inline-flex p-0.5 rounded-xl bg-[#ECEAE2] border border-[#DDD8CC]"
            role="group"
            aria-label="AQI Scale"
          >
            <button
              type="button"
              onClick={() => setAqiScale('us_aqi')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                aqiScale === 'us_aqi'
                  ? 'bg-white text-[#151B18] shadow-xs'
                  : 'text-[#4A5550] hover:text-[#151B18]'
              }`}
            >
              US AQI
            </button>
            <button
              type="button"
              onClick={() => setAqiScale('european_aqi')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                aqiScale === 'european_aqi'
                  ? 'bg-white text-[#151B18] shadow-xs'
                  : 'text-[#4A5550] hover:text-[#151B18]'
              }`}
            >
              EU AQI
            </button>
          </div>
          <button
            type="button"
            onClick={() => void refreshAirData()}
            className="p-2 rounded-xl bg-white border border-[#E6E3DA] text-[#4A5550] hover:text-[#151B18] hover:border-[#C5C0B3] transition-colors cursor-pointer"
            title="Refresh air quality data"
            aria-label="Refresh air quality data"
          >
            <RefreshCw
              className={`w-4 h-4 ${airLoading ? 'animate-spin text-[#2D6A4F]' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* Live Metrics Strip */}
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
              onClick={() => setActiveView('intelligence')}
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
                WHO 24h ref: 15 µg/m³
              </p>
            </div>
            {airData.current.pm25 !== null && (
              <div className="mt-3 text-[11px] font-medium text-[#4A5550]">
                {airData.current.pm25 > 15
                  ? `${(airData.current.pm25 / 15).toFixed(1)}× WHO 24h benchmark`
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
                WHO 24h ref: 45 µg/m³
              </p>
            </div>
            {airData.current.pm10 !== null && (
              <div className="mt-3 text-[11px] font-medium text-[#4A5550]">
                {airData.current.pm10 > 45
                  ? `${(airData.current.pm10 / 45).toFixed(1)}× WHO 24h benchmark`
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

      {/* HERO COMPONENT: YOUR AIR ACTION PLAN */}
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
                  onClick={() => setIsProfileEditorOpen(true)}
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
              onClick={() => void regeneratePlan()}
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
                  onClick={() => setActiveView('planner')}
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

      {/* Bottom 2-Column Preview: 24h Forecast Curve + Quick Companion Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 saans-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-[#151B18]">
                Next 24 Hours ({aqiScale === 'us_aqi' ? 'US AQI' : 'European AQI'})
              </h3>
              <p className="text-xs text-[#717D77]">
                Modelled hourly trajectory — never treat lower windows as completely safe
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveView('intelligence')}
              className="text-xs font-semibold text-[#1B4332] hover:underline cursor-pointer"
            >
              Deep dive →
            </button>
          </div>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="saansOverviewGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2D6A4F" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#2D6A4F" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#717D77' }}
                  interval={3}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#717D77' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    border: '1px solid #E6E3DA',
                    fontSize: '12px',
                    boxShadow: '0 6px 20px rgba(0,0,0,0.06)',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  name={aqiScale === 'us_aqi' ? 'US AQI' : 'EU AQI'}
                  stroke="#1B4332"
                  strokeWidth={2.2}
                  fill="url(#saansOverviewGrad)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-5 grid grid-cols-1 gap-3.5">
          <button
            type="button"
            onClick={() => setActiveView('indoor')}
            className="saans-card p-4 text-left hover:border-[#2D6A4F] transition-colors flex items-start gap-3.5 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-[#E6F0EB] text-[#1B4332] flex items-center justify-center shrink-0">
              <Home className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-[#151B18] group-hover:text-[#1B4332] flex items-center justify-between">
                <span>Make Your Home Air-Ready</span>
                <ArrowRight className="w-4 h-4 text-[#717D77]" />
              </div>
              <p className="text-xs text-[#4A5550] mt-1">
                Window timing,{' '}
                {profile.cookingFuel === 'lpg_gas'
                  ? 'LPG / gas'
                  : profile.cookingFuel === 'induction_electric'
                    ? 'induction / electric'
                    : 'mixed'}{' '}
                cooking tips, and{' '}
                {profile.hasAirPurifier
                  ? 'HEPA purifier schedule'
                  : 'zero-cost indoor steps'}.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveView('impact')}
            className="saans-card p-4 text-left hover:border-[#2D6A4F] transition-colors flex items-start gap-3.5 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-[#EEF5E9] text-[#265C3B] flex items-center justify-center shrink-0">
              <Leaf className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-[#151B18] group-hover:text-[#1B4332] flex items-center justify-between">
                <span>Your Choices. Your Impact.</span>
                <ArrowRight className="w-4 h-4 text-[#717D77]" />
              </div>
              <p className="text-xs text-[#4A5550] mt-1">
                Compare commute CO₂e savings with sourced DEFRA factors and track weekly family challenges.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveView('ask')}
            className="saans-card p-4 text-left hover:border-[#2D6A4F] transition-colors flex items-start gap-3.5 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-[#E8F2F8] text-[#1F5489] flex items-center justify-center shrink-0">
              <MessageSquareText className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-[#151B18] group-hover:text-[#1B4332] flex items-center justify-between">
                <span>Ask SAANS</span>
                <ArrowRight className="w-4 h-4 text-[#717D77]" />
              </div>
              <p className="text-xs text-[#4A5550] mt-1">
                Ask “Is it a good time to walk?” or “How should I prep dinner tonight?” grounded in live data.
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Modelled Data Integrity & Attribution Footer */}
      <div className="saans-card-subtle px-4 py-3 text-xs text-[#4A5550] flex items-start gap-2.5">
        <AlertCircle className="w-4 h-4 text-[#717D77] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p>{airData.dataIntegrityNote}</p>
          <p className="text-[11px] text-[#717D77]">
            <strong>Model:</strong> {airData.modelName} ·{' '}
            <strong>Resolution:</strong> {airData.spatialResolutionLabel} ·{' '}
            {airData.attribution}
          </p>
        </div>
      </div>
    </div>
  );
}
