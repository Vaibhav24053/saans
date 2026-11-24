import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Compass,
  Sparkles,
  X,
} from 'lucide-react';
import { useSaans, type NavSection } from '@/context/SaansContext';

interface TourStep {
  title: string;
  body: string;
  view: NavSection;
  actionLabel?: string;
  onAction?: () => void;
}

export function GuidedDemoTour() {
  const {
    isDemoTourOpen,
    setIsDemoTourOpen,
    setActiveView,
    selectDemoScenario,
    applyDemoPersona,
    toggleDemoMode,
  } = useSaans();

  const [idx, setIdx] = useState(0);

  if (!isDemoTourOpen) return null;

  const steps: TourStep[] = [
    {
      title: '1. Household Context & Current Air',
      body: 'SAANS starts with your household preferences and translates live/sample AQI, PM2.5/PM10, and 6-hour trends into YOUR AIR ACTION PLAN.',
      view: 'overview',
      actionLabel: 'Load Severe Winter Smog',
      onAction: () => selectDemoScenario('severe_winter_smog'),
    },
    {
      title: '2. Personalised AI Daily Plan',
      body: 'Inspect the Morning, Afternoon, Evening, and Tomorrow cards — each cites its triggers and separates Personal Exposure from Wider Emissions.',
      view: 'planner',
      actionLabel: 'Apply Young Family (Car, No Purifier)',
      onAction: () => applyDemoPersona('young_family'),
    },
    {
      title: '3. Same Air → Different Household Plan',
      body: 'Keep the exact same pollution data and switch to Rohan & Dad (two-wheeler, senior, HEPA purifier) to watch commute and indoor actions adapt immediately.',
      view: 'planner',
      actionLabel: 'Switch to Rohan & Dad Persona',
      onAction: () => applyDemoPersona('commuter_senior'),
    },
    {
      title: '4. Forecast Change Adapts Timing',
      body: 'Switch to Worsening Evening Inversion in Air Intelligence to see rising evening AQI shift ventilation and errands earlier into the morning.',
      view: 'intelligence',
      actionLabel: 'Load Worsening Forecast',
      onAction: () => selectDemoScenario('worsening_inversion'),
    },
    {
      title: '5. Practical Indoor Air Coach',
      body: 'Make Your Home Air-Ready adapts window timing, cooking exhaust, and dust management to purifier ownership — without pushing costly gear.',
      view: 'indoor',
    },
    {
      title: '6. Transparent Sustainability Impact',
      body: 'Your Choices. Your Impact. separates qualitative exposure protection from UK DESNZ/DEFRA reference commute CO₂e estimates and weekly challenges.',
      view: 'impact',
    },
    {
      title: '7. Ask SAANS + Live Open-Meteo Data',
      body: 'Ask a direct question grounded in the active readings, then switch to Live Data to inspect Open-Meteo Copernicus CAMS forecasts for any city.',
      view: 'ask',
      actionLabel: 'Switch to Live Open-Meteo Data',
      onAction: () => toggleDemoMode(false),
    },
  ];

  const current = steps[idx];

  const goTo = (nextIdx: number) => {
    setIdx(nextIdx);
    setActiveView(steps[nextIdx].view);
  };

  return (
    <div className="fixed bottom-4 right-4 z-40 w-[340px] max-w-[calc(100vw-2rem)] rounded-2xl bg-[#151B18] text-white shadow-2xl border border-white/15 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#95D5B2]">
          <Compass className="w-3.5 h-3.5" />
          <span>
            Guided Walkthrough · {idx + 1}/{steps.length}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsDemoTourOpen(false)}
          className="p-1 rounded-lg text-white/60 hover:text-white hover:bg-white/10 cursor-pointer"
          aria-label="Close guided tour"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <h3 className="text-sm font-semibold text-white">{current.title}</h3>
      <p className="text-xs text-white/80 mt-1 leading-relaxed">
        {current.body}
      </p>

      {current.actionLabel && current.onAction && (
        <button
          type="button"
          onClick={() => {
            current.onAction?.();
            setActiveView(current.view);
          }}
          className="mt-3 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[#2D6A4F] text-white hover:bg-[#387F60] transition-colors cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{current.actionLabel}</span>
        </button>
      )}

      <div className="mt-3.5 pt-3 border-t border-white/10 flex items-center justify-between">
        <button
          type="button"
          disabled={idx === 0}
          onClick={() => goTo(idx - 1)}
          className="inline-flex items-center gap-1 text-xs text-white/75 hover:text-white disabled:opacity-35 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Prev</span>
        </button>
        <div className="flex gap-1">
          {steps.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Step ${i + 1}`}
              className={`h-1.5 rounded-full transition-all cursor-pointer ${
                i === idx ? 'w-5 bg-[#95D5B2]' : 'w-1.5 bg-white/30'
              }`}
            />
          ))}
        </div>
        {idx < steps.length - 1 ? (
          <button
            type="button"
            onClick={() => goTo(idx + 1)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#B7E4C7] hover:text-white cursor-pointer"
          >
            <span>Next</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsDemoTourOpen(false)}
            className="text-xs font-semibold text-[#B7E4C7] hover:text-white cursor-pointer"
          >
            Finish
          </button>
        )}
      </div>
    </div>
  );
}
