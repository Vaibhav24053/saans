import {
  AlertCircle,
  ArrowRight,
  Clock,
  Home,
  Leaf,
  MapPin,
  MessageSquareText,
  RefreshCw,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { findCurrentHourIndex, formatHourLabel } from '@shared/aqi';
import { formatCookingFuelLabel } from '@shared/indoorCoach';
import { useSaans } from '@/context/SaansContext';
import {
  AirActionPlanHero,
  LiveMetricsStrip,
} from '@/components/overview/OverviewSections';

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

  const nowIdx = findCurrentHourIndex(airData.hourly, airData.currentTimeLocal);
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

      <LiveMetricsStrip
        airData={airData}
        aqiScale={aqiScale}
        onOpenIntelligence={() => setActiveView('intelligence')}
      />

      <AirActionPlanHero
        airData={airData}
        householdSummaryText={householdSummaryText}
        plan={plan}
        planLoading={planLoading}
        planError={planError}
        onEditHousehold={() => setIsProfileEditorOpen(true)}
        onRegeneratePlan={() => void regeneratePlan()}
        onOpenPlanner={() => setActiveView('planner')}
      />

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
              <AreaChart
                data={chartData}
                margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
              >
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
                Window timing, {formatCookingFuelLabel(profile.cookingFuel)}{' '}
                cooking tips, and{' '}
                {profile.hasAirPurifier
                  ? 'HEPA purifier schedule'
                  : 'zero-cost indoor steps'}
                .
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
                Compare commute CO₂e savings with sourced DEFRA factors and track
                weekly family challenges.
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
                Ask “Is it a good time to walk?” or “How should I prep dinner
                tonight?” grounded in live data.
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
