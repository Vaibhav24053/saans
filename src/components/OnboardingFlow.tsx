import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Home,
  Leaf,
  MapPin,
  Sparkles,
  Users,
  Wind,
} from 'lucide-react';
import type { HouseholdProfile } from '@shared/types';
import { DEFAULT_PROFILE, useSaans } from '@/context/SaansContext';
import { BrandMark } from './BrandMark';
import {
  OnboardingCommuteStep,
  OnboardingHomeGoalsStep,
  OnboardingHouseholdStep,
  OnboardingLocationStep,
} from './onboarding/OnboardingSteps';

const ONBOARDING_STEPS = [
  { num: 1, label: 'Location', icon: MapPin },
  { num: 2, label: 'Household', icon: Users },
  { num: 3, label: 'Commute', icon: Wind },
  { num: 4, label: 'Home & Goals', icon: Home },
] as const;

export function OnboardingFlow() {
  const { completeOnboarding, setIsDemoTourOpen } = useSaans();
  const [step, setStep] = useState<number>(1);
  const [draft, setDraft] = useState<HouseholdProfile>(DEFAULT_PROFILE);

  const handleQuickDemo = () => {
    completeOnboarding(
      {
        ...DEFAULT_PROFILE,
        householdName: 'Meera & Aarav’s Home',
        onboardingCompleted: true,
      },
      true,
    );
    setIsDemoTourOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#F7F6F2] flex flex-col">
      {/* Top minimal bar */}
      <header className="max-w-5xl w-full mx-auto px-5 pt-6 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <BrandMark className="w-9 h-9" />
          <div>
            <span className="text-lg font-bold tracking-tight text-[#151B18]">
              SAANS
            </span>
            <p className="text-[11px] text-[#717D77] -mt-0.5">
              Know the air. Change your day.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleQuickDemo}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#1B4332] text-white hover:bg-[#143326] transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Try Guided Demo</span>
          </button>
          <button
            type="button"
            onClick={() => completeOnboarding(draft, false)}
            className="px-3 py-2 rounded-xl text-xs font-medium text-[#4A5550] hover:bg-[#ECE9DF] transition-colors cursor-pointer"
          >
            Skip setup
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-5 py-6 flex flex-col justify-center">
        {/* Intro editorial headline */}
        <div className="text-center mb-8">
          <h1 className="font-serif-editorial text-4xl sm:text-5xl text-[#151B18] leading-tight">
            Air quality advice built around{' '}
            <span className="italic text-[#1B4332]">your household</span>.
          </h1>
          <p className="mt-2.5 text-sm sm:text-base text-[#4A5550] max-w-xl mx-auto">
            Instead of showing a single AQI number, SAANS combines live forecasts
            with your family’s daily rhythm to recommend practical exposure and
            low-emission choices.
          </p>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-2 sm:gap-4 mb-6">
          {ONBOARDING_STEPS.map((s) => {
            const Icon = s.icon;
            const active = step === s.num;
            const done = step > s.num;
            return (
              <button
                key={s.num}
                type="button"
                onClick={() => setStep(s.num)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#1B4332] text-white'
                    : done
                      ? 'bg-[#E6F0EB] text-[#1B4332]'
                      : 'bg-white border border-[#E6E3DA] text-[#717D77]'
                }`}
              >
                {done ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Icon className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            );
          })}
        </div>

        {/* Main Card */}
        <div className="saans-card p-6 sm:p-8">
          {step === 1 && (
            <OnboardingLocationStep draft={draft} setDraft={setDraft} />
          )}
          {step === 2 && (
            <OnboardingHouseholdStep draft={draft} setDraft={setDraft} />
          )}
          {step === 3 && (
            <OnboardingCommuteStep draft={draft} setDraft={setDraft} />
          )}
          {step === 4 && (
            <OnboardingHomeGoalsStep draft={draft} setDraft={setDraft} />
          )}

          {/* Footer actions */}
          <div className="mt-8 pt-5 border-t border-[#ECE9DF] flex items-center justify-between">
            <div>
              {step > 1 ? (
                <button
                  type="button"
                  onClick={() => setStep((s) => s - 1)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-[#4A5550] hover:bg-[#F0EEE7] transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs text-[#717D77]">
                  <Leaf className="w-3.5 h-3.5 text-[#2D6A4F]" />
                  <span>Stored locally · Edit anytime</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {step < 4 ? (
                <>
                  <button
                    type="button"
                    onClick={() => setStep((s) => s + 1)}
                    className="px-3.5 py-2.5 rounded-xl text-xs font-medium text-[#717D77] hover:text-[#151B18] cursor-pointer"
                  >
                    Skip step
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep((s) => s + 1)}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#1B4332] text-white hover:bg-[#143326] transition-colors cursor-pointer"
                  >
                    <span>Continue</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => completeOnboarding(draft, false)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#1B4332] text-white hover:bg-[#143326] transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Build My Daily Air Plan</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
