import { useState } from 'react';
import {
  CalendarDays,
  Clock,
  Info,
  Moon,
  RefreshCw,
  Sun,
  Sunrise,
  Sunset,
  Users,
} from 'lucide-react';
import { DEMO_PERSONAS } from '@shared/demoScenarios';
import type { PlanItem } from '@shared/types';
import { useSaans } from '@/context/SaansContext';
import { AiSourceBadge, ImpactCategoryBadge } from '@/components/StatusBadges';

type FilterType = 'all' | 'personal_exposure' | 'wider_emissions';

function PlanCard({ item }: { item: PlanItem }) {
  const priorityStyle =
    item.priority === 'high'
      ? 'border-l-4 border-l-[#1B4332]'
      : item.priority === 'medium'
        ? 'border-l-4 border-l-[#8EA89A]'
        : 'border-l-4 border-l-[#D4D0C4]';

  return (
    <article className={`saans-card p-5 ${priorityStyle} flex flex-col justify-between gap-4`}>
      <div>
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-[11px] font-mono-tabular text-[#717D77]">
            <Clock className="w-3.5 h-3.5" />
            <span>{item.timeframe}</span>
            <span>·</span>
            <span className="uppercase font-sans font-semibold text-[#4A5550]">
              {item.priority} priority
            </span>
          </div>
          <ImpactCategoryBadge category={item.impactCategory} />
        </div>

        <h4 className="text-base font-semibold text-[#151B18] mt-2">
          {item.title}
        </h4>
        <p className="text-sm text-[#151B18] mt-1.5 leading-relaxed font-medium">
          {item.action}
        </p>

        <div className="mt-3 pt-3 border-t border-[#F0EEE7] space-y-2 text-xs text-[#4A5550]">
          <p>
            <strong className="text-[#151B18]">Why recommended: </strong>
            {item.whyRecommended}
          </p>
          <p>
            <strong className="text-[#151B18]">Expected benefit: </strong>
            {item.expectedBenefit}
          </p>
        </div>
      </div>

      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-[#717D77] mb-1.5">
          Influenced by
        </div>
        <div className="flex flex-wrap gap-1.5">
          {item.triggers.map((t, i) => (
            <span
              key={i}
              className="px-2.5 py-0.5 rounded-full text-[11px] bg-[#F4F2EC] text-[#4A5550] border border-[#E6E3DA]"
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}

export function PlannerView() {
  const {
    profile,
    airData,
    plan,
    planLoading,
    regeneratePlan,
    applyDemoPersona,
    activePersonaId,
    setIsProfileEditorOpen,
  } = useSaans();

  const [filter, setFilter] = useState<FilterType>('all');

  const filterItems = (items: PlanItem[]) => {
    if (filter === 'all') return items;
    return items.filter(
      (i) => i.impactCategory === filter || i.impactCategory === 'both',
    );
  };

  const blocks = [
    { key: 'morning' as const, label: 'Morning', sub: 'Commute, exercise & early air', icon: Sunrise },
    { key: 'afternoon' as const, label: 'Afternoon', sub: 'Forecast window & errands', icon: Sun },
    { key: 'evening' as const, label: 'Evening', sub: 'Cooking, indoor air & sleep prep', icon: Sunset },
    { key: 'tomorrow' as const, label: 'Tomorrow', sub: 'Upcoming outlook & preparation', icon: CalendarDays },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#2D6A4F]">
            Personalised AI Schedule
          </p>
          <h1 className="font-serif-editorial text-3xl sm:text-4xl text-[#151B18] mt-1">
            Daily Air Planner
          </h1>
          <p className="text-sm text-[#4A5550] mt-1 max-w-2xl">
            Every recommendation links real environmental conditions in{' '}
            <strong>{airData?.location.name ?? profile.location.name}</strong> to{' '}
            <strong>{profile.householdName || 'your household'}</strong> — and
            clearly distinguishes personal exposure steps from wider emissions choices.
          </p>
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
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#1B4332] text-white hover:bg-[#143326] disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${planLoading ? 'animate-spin' : ''}`} />
            <span>{planLoading ? 'Updating…' : 'Regenerate Plan'}</span>
          </button>
        </div>
      </div>

      {/* Live Personalization Comparison Strip */}
      <div className="saans-card p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Users className="w-4 h-4 text-[#1B4332] shrink-0" />
          <div className="text-xs text-[#4A5550]">
            <strong className="text-[#151B18]">See personalisation live:</strong>{' '}
            Switch household profiles on the exact same air-quality data to watch
            this schedule adapt.
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
          {DEMO_PERSONAS.map((persona) => {
            const active = activePersonaId === persona.id;
            return (
              <button
                key={persona.id}
                type="button"
                onClick={() => applyDemoPersona(persona.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#1B4332] text-white border-[#1B4332]'
                    : 'bg-[#FAF9F6] text-[#151B18] border-[#E6E3DA] hover:border-[#2D6A4F]'
                }`}
              >
                {persona.name.split(' (')[0]}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setIsProfileEditorOpen(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#1B4332] hover:bg-[#E6F0EB] cursor-pointer"
          >
            Customise…
          </button>
        </div>
      </div>

      {/* Filter Pills */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          {(
            [
              { id: 'all', label: 'All Actions' },
              { id: 'personal_exposure', label: 'Personal Exposure' },
              { id: 'wider_emissions', label: 'Wider Emissions' },
            ] as Array<{ id: FilterType; label: string }>
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                filter === f.id
                  ? 'bg-[#151B18] text-white border-[#151B18]'
                  : 'bg-white text-[#4A5550] border-[#E6E3DA] hover:border-[#151B18]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {plan && (
          <span className="text-xs text-[#717D77]">
            Generated{' '}
            {new Date(plan.generatedAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        )}
      </div>

      {planLoading && !plan ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-52 rounded-2xl bg-[#ECEAE2]" />
          ))}
        </div>
      ) : plan ? (
        <div className="space-y-8">
          {blocks.map((block) => {
            const Icon = block.icon;
            const items = filterItems(plan.blocks[block.key]);
            if (items.length === 0) return null;
            return (
              <section key={block.key} className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#E6F0EB] text-[#1B4332] flex items-center justify-center">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-[#151B18]">
                      {block.label}
                    </h2>
                    <p className="text-xs text-[#717D77]">{block.sub}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {items.map((item) => (
                    <PlanCard key={item.id} item={item} />
                  ))}
                </div>
              </section>
            );
          })}

          <div className="saans-card-subtle p-4 flex items-start gap-2.5 text-xs text-[#4A5550]">
            <Info className="w-4 h-4 text-[#2D6A4F] shrink-0 mt-0.5" />
            <div>
              <strong className="text-[#151B18]">Transparency & Guardrails: </strong>
              {plan.transparencyNote}
              {plan.fallbackReason && (
                <span className="block mt-1 text-[#717D77]">
                  ({plan.fallbackReason})
                </span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="saans-card p-8 text-center text-sm text-[#4A5550]">
          <Moon className="w-8 h-8 mx-auto mb-2 text-[#717D77]" />
          No daily plan generated yet. Click “Regenerate Plan” above to create one.
        </div>
      )}
    </div>
  );
}
