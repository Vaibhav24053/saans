import { useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  Minus,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  findCurrentHourIndex,
  formatHourLabel,
  formatTimeRange,
  getAqiCategory,
  POLLUTANT_META,
} from '@shared/aqi';
import { useSaans } from '@/context/SaansContext';
import { AqiStatusBadge } from '@/components/StatusBadges';
import {
  ModelAttributionCard,
  PollutantBreakdownGrid,
} from '@/components/intelligence/IntelligenceSections';

type ChartMetric = 'usAqi' | 'europeanAqi' | 'pm25' | 'pm10';

const METRIC_CONFIG: Record<
  ChartMetric,
  { label: string; unit: string; color: string }
> = {
  usAqi: { label: 'US EPA AQI', unit: '0–500 scale', color: '#1B4332' },
  europeanAqi: { label: 'European AQI', unit: '0–100+ scale', color: '#2B6CB0' },
  pm25: { label: 'PM2.5', unit: 'µg/m³', color: '#B45309' },
  pm10: { label: 'PM10', unit: 'µg/m³', color: '#7E22CE' },
};

const METRIC_KEYS: readonly ChartMetric[] = [
  'usAqi',
  'europeanAqi',
  'pm25',
  'pm10',
];

export function AirIntelligenceView() {
  const { airData, aqiScale } = useSaans();
  const [metric, setMetric] = useState<ChartMetric>(
    aqiScale === 'european_aqi' ? 'europeanAqi' : 'usAqi',
  );
  const [horizonHours, setHorizonHours] = useState<24 | 48>(24);

  if (!airData) {
    return (
      <div className="saans-card p-8 text-center text-sm text-[#4A5550]">
        Air intelligence data is loading or unavailable.
      </div>
    );
  }

  const startIdx = findCurrentHourIndex(airData.hourly, airData.currentTimeLocal);
  const sliced = airData.hourly.slice(startIdx, startIdx + horizonHours);
  const chartData = sliced.map((pt, i) => ({
    label:
      horizonHours === 48 && i >= 24
        ? `Tmr ${formatHourLabel(pt.time)}`
        : formatHourLabel(pt.time),
    usAqi: pt.usAqi,
    europeanAqi: pt.europeanAqi,
    pm25: pt.pm25,
    pm10: pt.pm10,
    no2: pt.no2,
  }));

  const dominantMeta = POLLUTANT_META[airData.summary.dominantPollutant];
  const TrendIcon =
    airData.summary.trendDirection === 'improving'
      ? ArrowDownRight
      : airData.summary.trendDirection === 'worsening'
        ? ArrowUpRight
        : Minus;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-[#2D6A4F]">
          Environmental Analytics
        </p>
        <h1 className="font-serif-editorial text-3xl sm:text-4xl text-[#151B18] mt-1">
          Air Quality Intelligence
        </h1>
        <p className="text-sm text-[#4A5550] mt-1">
          Hourly modelled forecast, pollutant breakdown, and peak/trough windows
          for <strong>{airData.location.name}</strong> ({airData.timezone}).
        </p>
      </div>

      {/* 4 Key Signal Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="saans-card p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#717D77]">
            Dominant Concern
          </div>
          <div className="text-2xl font-bold text-[#151B18] mt-1.5">
            {dominantMeta.symbol}
          </div>
          <p className="text-xs text-[#4A5550] mt-1">{dominantMeta.name}</p>
        </div>

        <div className="saans-card p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#717D77]">
            6-Hour Direction
          </div>
          <div className="flex items-center gap-1.5 text-xl font-bold text-[#151B18] mt-1.5 capitalize">
            <TrendIcon className="w-5 h-5 text-[#1B4332]" />
            <span>{airData.summary.trendDirection}</span>
          </div>
          <p className="text-xs text-[#4A5550] mt-1">
            {airData.summary.trendDelta6h > 0
              ? `+${airData.summary.trendDelta6h}`
              : airData.summary.trendDelta6h}{' '}
            US AQI pts over 6h
          </p>
        </div>

        <div className="saans-card p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#991B1B]">
            Upcoming Peak Window
          </div>
          <div className="text-lg font-bold text-[#151B18] mt-1.5">
            {airData.summary.peakWindow
              ? formatTimeRange(
                  airData.summary.peakWindow.startTime,
                  airData.summary.peakWindow.endTime,
                )
              : 'Unavailable'}
          </div>
          <p className="text-xs text-[#4A5550] mt-1 font-mono-tabular">
            {airData.summary.peakWindow
              ? `Peak ~${airData.summary.peakWindow.peakUsAqi} US AQI`
              : '—'}
          </p>
        </div>

        <div className="saans-card p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#1F5489]">
            Relatively Lower Window
          </div>
          <div className="text-lg font-bold text-[#151B18] mt-1.5">
            {airData.summary.lowerWindow
              ? formatTimeRange(
                  airData.summary.lowerWindow.startTime,
                  airData.summary.lowerWindow.endTime,
                )
              : 'Unavailable'}
          </div>
          <p className="text-xs text-[#4A5550] mt-1">
            {airData.summary.lowerWindow
              ? `Avg ~${airData.summary.lowerWindow.avgUsAqi} US AQI (lower, not risk-free)`
              : '—'}
          </p>
        </div>
      </div>

      {/* Main Interactive Forecast Chart */}
      <div className="saans-card p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="text-base font-semibold text-[#151B18]">
              Hourly Forecast Curve · {METRIC_CONFIG[metric].label}
            </h2>
            <p className="text-xs text-[#717D77] mt-0.5">
              Unit: {METRIC_CONFIG[metric].unit} · Local time ({airData.timezone})
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex p-0.5 rounded-xl bg-[#F0EEE7] border border-[#E6E3DA]">
              {METRIC_KEYS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMetric(m)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    metric === m
                      ? 'bg-white text-[#151B18] shadow-xs'
                      : 'text-[#4A5550] hover:text-[#151B18]'
                  }`}
                >
                  {METRIC_CONFIG[m].label.replace(' EPA', '')}
                </button>
              ))}
            </div>

            <div className="inline-flex p-0.5 rounded-xl bg-[#F0EEE7] border border-[#E6E3DA]">
              {([24, 48] as const).map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setHorizonHours(h)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    horizonHours === h
                      ? 'bg-[#1B4332] text-white'
                      : 'text-[#4A5550] hover:text-[#151B18]'
                  }`}
                >
                  {h}h
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 12, left: -12, bottom: 0 }}
            >
              <defs>
                <linearGradient id="saansIntelGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor={METRIC_CONFIG[metric].color}
                    stopOpacity={0.28}
                  />
                  <stop
                    offset="95%"
                    stopColor={METRIC_CONFIG[metric].color}
                    stopOpacity={0.02}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#ECEAE2"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#717D77' }}
                interval={horizonHours === 48 ? 5 : 2}
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
                  backgroundColor: '#FFFFFF',
                }}
              />
              <Area
                type="monotone"
                dataKey={metric}
                name={METRIC_CONFIG[metric].label}
                stroke={METRIC_CONFIG[metric].color}
                strokeWidth={2.5}
                fill="url(#saansIntelGrad)"
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 pt-3 border-t border-[#F0EEE7] flex flex-wrap items-center justify-between gap-2 text-xs text-[#4A5550]">
          <div className="flex items-center gap-4">
            <span>
              US AQI now:{' '}
              <strong className="font-mono-tabular">
                {airData.current.usAqi ?? '—'}
              </strong>{' '}
              <AqiStatusBadge
                aqi={airData.current.usAqi}
                scale="us_aqi"
                size="sm"
              />
            </span>
            <span>
              European AQI now:{' '}
              <strong className="font-mono-tabular">
                {airData.current.europeanAqi ?? '—'}
              </strong>{' '}
              (
              {
                getAqiCategory(airData.current.europeanAqi, 'european_aqi')
                  .shortLabel
              }
              )
            </span>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] text-[#717D77]">
            <Clock className="w-3.5 h-3.5" />
            Never converted silently between US, EU, and Indian CPCB scales
          </span>
        </div>
      </div>

      <PollutantBreakdownGrid airData={airData} />
      <ModelAttributionCard airData={airData} />
    </div>
  );
}
