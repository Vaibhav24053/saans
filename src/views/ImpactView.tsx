import { Shield } from 'lucide-react';
import { US_AQI_THRESHOLDS } from '@shared/aqi';
import type { TransportModeId } from '@shared/emissions';
import type { CommuteType } from '@shared/types';
import { useSaans } from '@/context/SaansContext';
import { ImpactCategoryBadge } from '@/components/StatusBadges';
import {
  CommuteCalculatorSection,
  WeeklyChallengesSection,
} from '@/components/impact/ImpactSections';

function mapProfileCommuteToMode(commute: CommuteType): TransportModeId {
  switch (commute) {
    case 'car':
      return 'petrol_car_solo';
    case 'two_wheeler':
      return 'two_wheeler';
    case 'public_transport':
      return 'local_bus';
    case 'walking':
    case 'cycling':
      return 'walk_cycle';
    case 'wfh':
      return 'wfh';
  }
}

export function ImpactView() {
  const { profile, airData } = useSaans();

  const initialBaselineMode = mapProfileCommuteToMode(profile.commuteType);
  const initialOneWayKm = Math.max(2, profile.commuteDistanceKm || 10);
  const highAqi =
    (airData?.current.usAqi ?? 100) >= US_AQI_THRESHOLDS.UNHEALTHY;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-[#2D6A4F]">
          Sustainability & Household Strategy
        </p>
        <h1 className="font-serif-editorial text-3xl sm:text-4xl text-[#151B18] mt-1">
          Your Choices. Your Impact.
        </h1>
        <p className="text-sm text-[#4A5550] mt-1 max-w-2xl">
          SAANS deliberately separates{' '}
          <strong>household exposure protection</strong> (what you breathe
          today) from <strong>low-emission lifestyle choices</strong> (what your
          routines emit over time).
        </p>
      </div>

      {/* SECTION A: HOUSEHOLD EXPOSURE STRATEGY */}
      <section className="saans-card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-start sm:items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#E8F2F8] text-[#1F5489] flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#151B18]">
                A. Household Exposure Strategy
              </h2>
              <p className="text-xs text-[#717D77]">
                Qualitative exposure-management steps — SAANS never fabricates
                percentage exposure reductions.
              </p>
            </div>
          </div>
          <div className="self-start sm:self-center shrink-0">
            <ImpactCategoryBadge category="personal_exposure" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          <div className="p-4 rounded-xl bg-[#FAF9F6] border border-[#E6E3DA]">
            <div className="text-xs font-semibold text-[#151B18]">
              Activity Rescheduling
            </div>
            <p className="text-xs text-[#4A5550] mt-1 leading-relaxed">
              {highAqi
                ? 'Moving outdoor play and brisk exercise indoors today directly lowers breathing-rate inhalation of elevated PM2.5.'
                : 'Aligning outdoor errands with the relatively lower forecast window reduces time spent in peak traffic haze.'}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-[#FAF9F6] border border-[#E6E3DA]">
            <div className="text-xs font-semibold text-[#151B18]">
              Commute Micro-Environment
            </div>
            <p className="text-xs text-[#4A5550] mt-1 leading-relaxed">
              Enclosed metro/AC coaches, car cabin recirculation, or a snug N95
              mask on open two-wheelers curb roadway exhaust exposure.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-[#FAF9F6] border border-[#E6E3DA]">
            <div className="text-xs font-semibold text-[#151B18]">
              Indoor Source Control
            </div>
            <p className="text-xs text-[#4A5550] mt-1 leading-relaxed">
              Running kitchen exhaust while cooking, damp-mopping dust, and
              avoiding indoor incense prevent trapped indoor particulate spikes.
            </p>
          </div>
        </div>
      </section>

      {/* SECTION B: LOW-EMISSION COMMUTE SCENARIO CALCULATOR (re-initialises when household commute profile changes) */}
      <CommuteCalculatorSection
        key={`${profile.commuteType}:${profile.commuteDistanceKm}`}
        initialBaselineMode={initialBaselineMode}
        initialOneWayKm={initialOneWayKm}
        highAqi={highAqi}
        currentUsAqi={airData?.current.usAqi ?? null}
      />

      {/* SECTION C: FAMILY & COMMUNITY CHALLENGES */}
      <WeeklyChallengesSection />
    </div>
  );
}
