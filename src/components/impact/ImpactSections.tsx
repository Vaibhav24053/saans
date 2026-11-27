import { useEffect, useState } from 'react';
import {
  Award,
  BookOpen,
  Calculator,
  Check,
  ChevronDown,
  ChevronUp,
  Flame,
  Info,
  Leaf,
  Plus,
  RotateCcw,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  calculateCommuteImpact,
  EMISSION_METHODOLOGY,
  TRANSPORT_MODES,
  type TransportModeId,
} from '@shared/emissions';
import { DEFAULT_CHALLENGES } from '@shared/demoScenarios';
import { ImpactCategoryBadge } from '@/components/StatusBadges';
import {
  parseStoredChallengeProgress,
  readStorageJson,
  writeStorageJson,
  type ChallengeProgressState,
} from '@/utils/storage';

const STORAGE_CHALLENGES_KEY = 'saans_challenges_v1';
const DEFAULT_CHALLENGE_STATE: ChallengeProgressState = {
  counts: {},
  streakWeeks: 1,
  lastLoggedDate: null,
};

const TRANSPORT_MODE_LIST = Object.values(TRANSPORT_MODES);

function parseTransportModeId(
  raw: string,
  fallback: TransportModeId,
): TransportModeId {
  const found = TRANSPORT_MODE_LIST.find((m) => m.id === raw);
  return found ? found.id : fallback;
}

export function CommuteCalculatorSection({
  initialBaselineMode,
  initialOneWayKm,
  highAqi,
  currentUsAqi,
}: {
  initialBaselineMode: TransportModeId;
  initialOneWayKm: number;
  highAqi: boolean;
  currentUsAqi: number | null;
}) {
  const [baselineMode, setBaselineMode] =
    useState<TransportModeId>(initialBaselineMode);
  const [alternativeMode, setAlternativeMode] =
    useState<TransportModeId>('metro_rail');
  const [oneWayKm, setOneWayKm] = useState<number>(initialOneWayKm);
  const [daysPerWeek, setDaysPerWeek] = useState<number>(3);
  const [showMethodology, setShowMethodology] = useState<boolean>(false);

  const calc = calculateCommuteImpact(
    baselineMode,
    alternativeMode,
    oneWayKm,
    daysPerWeek,
  );

  const chartData = [
    {
      name: calc.baselineMode.shortLabel,
      kg: calc.baselineWeeklyKg,
      fill: '#9C4212',
    },
    {
      name: calc.alternativeMode.shortLabel,
      kg: calc.alternativeWeeklyKg,
      fill: '#1B4332',
    },
  ];

  const signPrefix = calc.changeDirection === 'lower' ? '−' : '+';

  return (
    <section className="saans-card p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-start sm:items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#E6F4EC] text-[#1E563B] flex items-center justify-center shrink-0">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[#151B18]">
              B. Low-Emission Commute Scenario Calculator
            </h2>
            <p className="text-xs text-[#717D77]">
              Uses documented{' '}
              <strong>UK DESNZ/DEFRA 2024 reference factors</strong> (benchmark
              only — not India-specific emission factors).
            </p>
          </div>
        </div>
        <div className="self-start sm:self-center shrink-0">
          <ImpactCategoryBadge category="wider_emissions" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Controls */}
        <div className="lg:col-span-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#4A5550] mb-1.5">
                Usual commute mode
              </label>
              <select
                value={baselineMode}
                onChange={(e) =>
                  setBaselineMode((prev) =>
                    parseTransportModeId(e.target.value, prev),
                  )
                }
                className="w-full px-3 py-2.5 text-xs rounded-xl border border-[#D4D0C4] bg-[#FAF9F6] text-[#151B18]"
              >
                {TRANSPORT_MODE_LIST.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} ({m.gramsCo2ePerPassengerKm} g/km)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#4A5550] mb-1.5">
                Alternative mode to compare
              </label>
              <select
                value={alternativeMode}
                onChange={(e) =>
                  setAlternativeMode((prev) =>
                    parseTransportModeId(e.target.value, prev),
                  )
                }
                className="w-full px-3 py-2.5 text-xs rounded-xl border border-[#D4D0C4] bg-[#FAF9F6] text-[#151B18]"
              >
                {TRANSPORT_MODE_LIST.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} ({m.gramsCo2ePerPassengerKm} g/km)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs font-semibold text-[#4A5550] mb-1">
              <span>One-way commute distance</span>
              <span className="font-mono-tabular text-[#1B4332]">
                {oneWayKm} km ({oneWayKm * 2} km round trip)
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={50}
              value={oneWayKm}
              onChange={(e) => setOneWayKm(Number(e.target.value))}
              className="w-full accent-[#1B4332]"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-semibold text-[#4A5550] mb-1">
              <span>Swapped commute days per week</span>
              <span className="font-mono-tabular text-[#1B4332]">
                {daysPerWeek} day{daysPerWeek > 1 ? 's' : ''}/week
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={6}
              value={daysPerWeek}
              onChange={(e) => setDaysPerWeek(Number(e.target.value))}
              className="w-full accent-[#1B4332]"
            />
          </div>

          <div className="p-3.5 rounded-xl bg-[#F4F6F3] border border-[#DCE5DD] text-xs text-[#2D4739]">
            <strong>Exposure trade-off note:</strong>{' '}
            {calc.alternativeMode.exposureNote}
            {alternativeMode === 'walk_cycle' && highAqi && (
              <span className="block mt-1 text-[#991B1B] font-medium">
                Caution: Current modelled AQI is elevated ({currentUsAqi} US
                AQI). While walking/cycling has zero tailpipe emissions,
                consider enclosed metro or transit until air improves.
              </span>
            )}
          </div>
        </div>

        {/* Results + Bar Chart */}
        <div className="lg:col-span-6 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-[#F3F8F5] border border-[#CBE2D5]">
              <div className="text-[11px] font-medium text-[#4A5550]">
                Weekly CO₂e
              </div>
              <div className="font-mono-tabular text-lg sm:text-xl font-bold text-[#1B4332] mt-1">
                {calc.changeDirection === 'same'
                  ? '0 kg'
                  : `${signPrefix}${Math.abs(calc.weeklySavedKg)} kg`}
              </div>
              <div className="text-[10px] text-[#2D6A4F] mt-0.5 leading-snug">
                {calc.comparisonLabel}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-[#FAF9F6] border border-[#E6E3DA]">
              <div className="text-[11px] font-medium text-[#4A5550]">
                Monthly (4 wks)
              </div>
              <div className="font-mono-tabular text-lg sm:text-xl font-bold text-[#151B18] mt-1">
                {calc.changeDirection === 'same'
                  ? '0 kg'
                  : `${signPrefix}${Math.abs(calc.monthlySavedKg)} kg`}
              </div>
              <div className="text-[10px] text-[#717D77] mt-0.5">
                UK ref. CO₂e
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-[#FAF9F6] border border-[#E6E3DA]">
              <div className="text-[11px] font-medium text-[#4A5550]">
                Annual (48 wks)
              </div>
              <div className="font-mono-tabular text-lg sm:text-xl font-bold text-[#151B18] mt-1">
                {calc.changeDirection === 'same'
                  ? '0 kg'
                  : `${signPrefix}${Math.abs(calc.yearlySavedKg)} kg`}
              </div>
              <div className="text-[10px] text-[#717D77] mt-0.5">
                12 × 4 active wks
              </div>
            </div>
          </div>

          <div className="h-44 w-full bg-[#FAF9F6] rounded-xl border border-[#E6E3DA] p-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 4, right: 20, left: 10, bottom: 4 }}
              >
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: '#717D77' }}
                  unit=" kg"
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={92}
                  tick={{ fontSize: 11, fill: '#151B18' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(val: number) => [
                    `${val} kg CO₂e / week`,
                    'Estimated Emissions',
                  ]}
                  contentStyle={{
                    borderRadius: '10px',
                    border: '1px solid #E6E3DA',
                    fontSize: '12px',
                  }}
                />
                <Bar
                  dataKey="kg"
                  radius={[0, 8, 8, 0]}
                  barSize={28}
                  isAnimationActive={false}
                >
                  {chartData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Honest Impact Boundary + Expandable Methodology */}
      <div className="pt-3 border-t border-[#ECE9DF] space-y-3">
        <div className="flex items-start gap-2 text-xs text-[#4A5550]">
          <Info className="w-4 h-4 text-[#1B4332] shrink-0 mt-0.5" />
          <p>
            <strong>Important distinction:</strong> Lower-emission transport
            choices reduce cumulative greenhouse gas and tailpipe emissions over
            time — an individual household’s commute switch does{' '}
            <strong>not</strong> directly lower today’s ambient neighborhood AQI
            on its own.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowMethodology((s) => !s)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1B4332] hover:underline cursor-pointer"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>
            {showMethodology
              ? 'Hide Emissions Factors & Methodology'
              : 'View Documented Emissions Factors & Methodology'}
          </span>
          {showMethodology ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>

        {showMethodology && (
          <div className="p-4 rounded-xl bg-[#FAF9F6] border border-[#E6E3DA] text-xs text-[#4A5550] space-y-3">
            <div>
              <strong className="text-[#151B18]">Reference Source: </strong>
              {EMISSION_METHODOLOGY.sourceTitle}
            </div>
            <div>
              <strong className="text-[#151B18]">Formula: </strong>
              <code className="font-mono-tabular text-[11px] bg-white px-2 py-0.5 rounded border border-[#E6E3DA] inline-block mt-0.5">
                {EMISSION_METHODOLOGY.formulaText}
              </code>
            </div>
            <div>
              <strong className="text-[#151B18]">Time Horizon Basis: </strong>
              {EMISSION_METHODOLOGY.horizonBasis}
            </div>
            <div>
              <strong className="text-[#151B18]">
                Active Comparison Assumptions:{' '}
              </strong>
              <span>
                {calc.baselineMode.label} (
                {calc.baselineMode.gramsCo2ePerPassengerKm}{' '}
                {calc.baselineMode.unitBasis},{' '}
                {calc.baselineMode.occupancyAssumption}) vs.{' '}
                {calc.alternativeMode.label} (
                {calc.alternativeMode.gramsCo2ePerPassengerKm}{' '}
                {calc.alternativeMode.unitBasis},{' '}
                {calc.alternativeMode.occupancyAssumption}) over {calc.weeklyKm}{' '}
                km/week.
              </span>
            </div>
            <ul className="list-disc pl-5 space-y-1">
              {EMISSION_METHODOLOGY.caveats.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

export function WeeklyChallengesSection() {
  const [challengeState, setChallengeState] = useState<ChallengeProgressState>(
    () =>
      readStorageJson(
        STORAGE_CHALLENGES_KEY,
        DEFAULT_CHALLENGE_STATE,
        parseStoredChallengeProgress,
      ),
  );

  useEffect(() => {
    writeStorageJson(STORAGE_CHALLENGES_KEY, challengeState);
  }, [challengeState]);

  const logChallenge = (id: string, target: number) => {
    const today = new Date().toISOString().slice(0, 10);
    setChallengeState((prev) => {
      const current = prev.counts[id] ?? 0;
      const next = Math.min(target, current + 1);
      return {
        counts: { ...prev.counts, [id]: next },
        streakWeeks: prev.streakWeeks || 1,
        lastLoggedDate: today,
      };
    });
  };

  const resetChallenges = () => {
    setChallengeState(DEFAULT_CHALLENGE_STATE);
  };

  const completedChallenges = DEFAULT_CHALLENGES.filter(
    (c) => (challengeState.counts[c.id] ?? 0) >= c.weeklyTarget,
  ).length;

  const totalActionsLogged = Object.values(challengeState.counts).reduce(
    (s, n) => s + n,
    0,
  );

  return (
    <section className="saans-card p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#FBF3DC] text-[#7A5410] flex items-center justify-center shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[#151B18]">
              C. Weekly Family Clean-Air Challenges
            </h2>
            <p className="text-xs text-[#717D77]">
              Track your household’s real actions locally — no fabricated global
              counters or synthetic community stats.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FBF3DC] text-[#7A5410] text-xs font-semibold border border-[#EAD59B]">
            <Flame className="w-3.5 h-3.5" />
            <span>
              Week {challengeState.streakWeeks} · {completedChallenges}/
              {DEFAULT_CHALLENGES.length} complete
            </span>
          </div>
          {totalActionsLogged > 0 && (
            <button
              type="button"
              onClick={resetChallenges}
              className="p-1.5 rounded-lg text-[#717D77] hover:bg-[#F0EEE7] hover:text-[#151B18] cursor-pointer"
              title="Reset weekly challenge progress"
              aria-label="Reset weekly challenge progress"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {DEFAULT_CHALLENGES.map((ch) => {
          const count = challengeState.counts[ch.id] ?? 0;
          const done = count >= ch.weeklyTarget;
          const pct = Math.round((count / ch.weeklyTarget) * 100);

          return (
            <div
              key={ch.id}
              className={`p-4 rounded-xl border flex flex-col justify-between gap-3 transition-colors ${
                done
                  ? 'bg-[#F3F8F5] border-[#B8DFC9]'
                  : 'bg-[#FAF9F6] border-[#E6E3DA]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <ImpactCategoryBadge category={ch.impactType} />
                  <span className="font-mono-tabular text-xs font-semibold text-[#4A5550]">
                    {count}/{ch.weeklyTarget}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-[#151B18]">
                  {ch.title}
                </h3>
                <p className="text-xs text-[#4A5550] mt-1 leading-relaxed">
                  {ch.description}
                </p>
                <p className="text-[11px] text-[#2D6A4F] mt-2 flex items-start gap-1">
                  <Leaf className="w-3 h-3 shrink-0 mt-0.5" />
                  <span>{ch.impactNote}</span>
                </p>
              </div>

              <div className="space-y-2">
                <div className="h-1.5 w-full rounded-full bg-[#E6E3DA] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#1B4332] transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <button
                  type="button"
                  disabled={done}
                  onClick={() => logChallenge(ch.id, ch.weeklyTarget)}
                  className={`w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                    done
                      ? 'bg-[#E6F4EC] text-[#1E563B] cursor-default'
                      : 'bg-white border border-[#D4D0C4] text-[#151B18] hover:border-[#1B4332] hover:text-[#1B4332]'
                  }`}
                >
                  {done ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Completed This Week</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>
                        Log Action ({count + 1}/{ch.weeklyTarget})
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
