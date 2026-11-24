import { Beaker, Radio, Users } from 'lucide-react';
import { DEMO_PERSONAS, DEMO_SCENARIOS } from '@shared/demoScenarios';
import { useSaans } from '@/context/SaansContext';

export function DemoControlBar() {
  const {
    demoMode,
    demoScenarioId,
    activePersonaId,
    toggleDemoMode,
    selectDemoScenario,
    applyDemoPersona,
  } = useSaans();

  if (!demoMode) return null;

  return (
    <div className="mb-5 rounded-2xl bg-[#1B4332] text-white p-4 shadow-sm border border-[#143326]">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center shrink-0 mt-0.5">
            <Beaker className="w-4 h-4 text-[#B7E4C7]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-[#B7E4C7]">
                Demo Mode Active
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 text-white/90">
                Sample Dataset · Not Live Readings
              </span>
            </div>
            <p className="text-xs text-[#D8EFE1] mt-0.5">
              Switch environmental scenarios or household personas to see SAANS
              dynamically adapt the daily plan, indoor coach, and Ask SAANS.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => toggleDemoMode(false)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white text-[#1B4332] hover:bg-[#E6F0EB] transition-colors self-start lg:self-center shrink-0 cursor-pointer"
        >
          <Radio className="w-3.5 h-3.5" />
          <span>Switch to Live Open-Meteo Data</span>
        </button>
      </div>

      <div className="mt-3.5 pt-3.5 border-t border-white/15 grid grid-cols-1 xl:grid-cols-2 gap-3">
        {/* Scenarios */}
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#95D5B2] mb-1.5">
            1. Pollution Scenario
          </div>
          <div className="flex flex-wrap gap-1.5">
            {DEMO_SCENARIOS.map((sc) => {
              const active = sc.id === demoScenarioId;
              return (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => selectDemoScenario(sc.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    active
                      ? 'bg-white text-[#1B4332] font-semibold shadow-sm'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  {sc.shortLabel}
                  <span
                    className={`ml-1.5 text-[10px] ${
                      active ? 'text-[#2D6A4F]' : 'text-[#B7E4C7]'
                    }`}
                  >
                    ({sc.cityLabel.replace(' (Sample)', '')})
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Personas */}
        <div>
          <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-[#95D5B2] mb-1.5">
            <Users className="w-3 h-3" />
            <span>2. Household Persona (Same Air → Different Plan)</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {DEMO_PERSONAS.map((p) => {
              const active = activePersonaId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyDemoPersona(p.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#B7E4C7] text-[#143326] font-semibold'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  {p.name.split(' (')[0]}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
