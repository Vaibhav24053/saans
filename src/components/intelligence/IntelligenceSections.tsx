import { useState } from 'react';
import { Activity, AlertTriangle, Info, ShieldCheck } from 'lucide-react';
import { POLLUTANT_META } from '@shared/aqi';
import type { AirQualityData, PollutantKey } from '@shared/types';

export function PollutantBreakdownGrid({ airData }: { airData: AirQualityData }) {
  const [selectedPollutant, setSelectedPollutant] =
    useState<PollutantKey | null>(null);

  const pollutants: Array<{
    key: PollutantKey;
    value: number | null;
    whoRef: number;
  }> = [
    {
      key: 'pm25',
      value: airData.current.pm25,
      whoRef: POLLUTANT_META.pm25.whoGuidelineValue,
    },
    {
      key: 'pm10',
      value: airData.current.pm10,
      whoRef: POLLUTANT_META.pm10.whoGuidelineValue,
    },
    {
      key: 'no2',
      value: airData.current.no2,
      whoRef: POLLUTANT_META.no2.whoGuidelineValue,
    },
    {
      key: 'so2',
      value: airData.current.so2,
      whoRef: POLLUTANT_META.so2.whoGuidelineValue,
    },
    {
      key: 'o3',
      value: airData.current.o3,
      whoRef: POLLUTANT_META.o3.whoGuidelineValue,
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-base font-semibold text-[#151B18]">
            Pollutant Concentrations
          </h2>
          <p className="text-xs text-[#717D77]">
            Click any pollutant card to learn its sources and practical
            household precautions.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {pollutants.map((p) => {
          const meta = POLLUTANT_META[p.key];
          const isDominant = p.key === airData.summary.dominantPollutant;
          const isOpen = selectedPollutant === p.key;
          const ratio = p.value !== null ? p.value / p.whoRef : 0;
          const barPct = Math.min(100, Math.round((ratio / 4) * 100));

          return (
            <button
              key={p.key}
              type="button"
              onClick={() => setSelectedPollutant(isOpen ? null : p.key)}
              className={`saans-card p-4 text-left transition-all cursor-pointer ${
                isOpen
                  ? 'ring-2 ring-[#1B4332] border-[#1B4332]'
                  : 'hover:border-[#2D6A4F]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-[#151B18]">
                  {meta.symbol}
                </span>
                {isDominant ? (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#FEF0E1] text-[#9C4212] border border-[#F4C99E]">
                    Dominant
                  </span>
                ) : (
                  <Info className="w-3.5 h-3.5 text-[#717D77]" />
                )}
              </div>

              <div className="mt-2 font-mono-tabular text-2xl font-bold text-[#151B18]">
                {p.value !== null ? p.value : 'N/A'}
                {p.value !== null && (
                  <span className="text-[11px] font-normal text-[#717D77] ml-1">
                    {meta.unit}
                  </span>
                )}
              </div>

              <div className="mt-2.5 h-1.5 w-full rounded-full bg-[#F0EEE7] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.max(8, barPct)}%`,
                    backgroundColor:
                      ratio > 3
                        ? '#B91C1C'
                        : ratio > 1.5
                          ? '#B45309'
                          : '#2D6A4F',
                  }}
                />
              </div>
              <p className="text-[11px] text-[#717D77] mt-1.5">
                {meta.whoReference}
              </p>
            </button>
          );
        })}
      </div>

      {/* Expanded Pollutant Intelligence Detail */}
      {selectedPollutant && (
        <div className="mt-4 saans-card p-5 bg-[#FAF9F5] border-[#2D6A4F]/40">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#1B4332]" />
              <h3 className="text-sm font-bold text-[#151B18]">
                {POLLUTANT_META[selectedPollutant].symbol} —{' '}
                {POLLUTANT_META[selectedPollutant].name}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setSelectedPollutant(null)}
              className="text-xs text-[#717D77] hover:text-[#151B18] cursor-pointer"
            >
              Close
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-[#4A5550] mt-3">
            <div>
              <div className="font-semibold text-[#151B18] mb-1">
                What it is
              </div>
              <p className="leading-relaxed">
                {POLLUTANT_META[selectedPollutant].whatItIs}
              </p>
            </div>
            <div>
              <div className="font-semibold text-[#151B18] mb-1">
                Common Urban Sources
              </div>
              <p className="leading-relaxed">
                {POLLUTANT_META[selectedPollutant].commonSources}
              </p>
            </div>
            <div>
              <div className="font-semibold text-[#151B18] mb-1">
                Practical Household Note
              </div>
              <p className="leading-relaxed">
                {POLLUTANT_META[selectedPollutant].practicalNote}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ModelAttributionCard({ airData }: { airData: AirQualityData }) {
  return (
    <div className="saans-card p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
      <div className="flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-[#1B4332] shrink-0 mt-0.5" />
        <div className="space-y-1.5">
          <h3 className="text-sm font-semibold text-[#151B18]">
            Model Domain, Resolution & Attribution
          </h3>
          <p className="text-xs text-[#4A5550] leading-relaxed">
            <strong>Selected Model:</strong> {airData.modelName} (
            <span className="font-mono-tabular">{airData.modelDomain}</span>)
            <br />
            <strong>Spatial Resolution:</strong>{' '}
            {airData.spatialResolutionLabel}
          </p>
          <p className="text-xs text-[#4A5550] leading-relaxed">
            {airData.dataIntegrityNote}
          </p>
          <p className="text-[11px] text-[#717D77] pt-1">
            {airData.attribution}
          </p>
        </div>
      </div>
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-[#B45309] shrink-0 mt-0.5" />
        <div className="space-y-1.5">
          <h3 className="text-sm font-semibold text-[#151B18]">
            Modelled Forecast vs. Local Station Monitors
          </h3>
          <p className="text-xs text-[#4A5550] leading-relaxed">
            {airData.modelDomain === 'cams_global'
              ? 'For India and non-European locations, Open-Meteo serves the Copernicus CAMS Global atmospheric model (~45 km grid cells). Grid-cell forecasts capture regional pollution episodes but are NOT official CPCB ground monitoring station readings.'
              : 'Atmospheric model grids represent area averages rather than street-level monitors. Local roadside intersections, construction dust, or smoke can be significantly higher than regional modelled estimates.'}
          </p>
          <p className="text-xs text-[#4A5550] leading-relaxed">
            SAANS keeps US EPA AQI (0–500) and European AQI explicitly separate
            and never silently converts between US, European, and Indian CPCB
            AQI scales.
          </p>
        </div>
      </div>
    </div>
  );
}
