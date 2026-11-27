import { useState } from 'react';
import { Check, Sparkles, Users, X } from 'lucide-react';
import { DEMO_PERSONAS } from '@shared/demoScenarios';
import type {
  BudgetPreference,
  CommuteType,
  CookingFuel,
  DemoPersonaId,
  HomeType,
  HouseholdProfile,
  OutdoorWindowPref,
  RespiratorySensitivity,
  SustainabilityFocus,
  VentilationOption,
} from '@shared/types';
import { useSaans } from '@/context/SaansContext';

export function ProfileEditorDrawer() {
  const {
    profile,
    updateProfile,
    isProfileEditorOpen,
    setIsProfileEditorOpen,
    applyDemoPersona,
    activePersonaId,
  } = useSaans();

  if (!isProfileEditorOpen) return null;

  return (
    <ProfileEditorDrawerContent
      initialProfile={profile}
      activePersonaId={activePersonaId}
      onClose={() => setIsProfileEditorOpen(false)}
      onSave={(next) => {
        updateProfile(next);
        setIsProfileEditorOpen(false);
      }}
      onApplyPersona={(id) => {
        applyDemoPersona(id);
        setIsProfileEditorOpen(false);
      }}
    />
  );
}

function ProfileEditorDrawerContent({
  initialProfile,
  activePersonaId,
  onClose,
  onSave,
  onApplyPersona,
}: {
  initialProfile: HouseholdProfile;
  activePersonaId: DemoPersonaId | null;
  onClose: () => void;
  onSave: (next: HouseholdProfile) => void;
  onApplyPersona: (id: DemoPersonaId) => void;
}) {
  const [draft, setDraft] = useState<HouseholdProfile>(initialProfile);

  const handleSave = () => {
    onSave(draft);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[#151B18]/40 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Edit household preferences"
    >
      <div className="w-full max-w-md bg-white h-full shadow-2xl border-l border-[#E6E3DA] flex flex-col">
        <div className="px-5 py-4 border-b border-[#E6E3DA] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#1B4332]" />
            <h2 className="text-base font-semibold text-[#151B18]">
              Household Profile
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#717D77] hover:bg-[#F0EEE7] cursor-pointer"
            aria-label="Close profile editor"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Quick Demo Personas */}
          <div className="p-4 rounded-xl bg-[#F4F6F3] border border-[#DCE5DD]">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1B4332] mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Quick-Switch Household Personas</span>
            </div>
            <p className="text-[11px] text-[#4A5550] mb-3">
              Test how identical air quality produces tailored daily advice for
              different households.
            </p>
            <div className="space-y-2">
              {DEMO_PERSONAS.map((persona) => {
                const isSelected = activePersonaId === persona.id;
                return (
                  <button
                    key={persona.id}
                    type="button"
                    onClick={() => onApplyPersona(persona.id)}
                    className={`w-full text-left p-2.5 rounded-lg border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#1B4332] text-white border-[#1B4332]'
                        : 'bg-white border-[#E6E3DA] hover:border-[#2D6A4F]'
                    }`}
                  >
                    <div className="text-xs font-semibold">{persona.name}</div>
                    <div
                      className={`text-[11px] mt-0.5 ${
                        isSelected ? 'text-[#CBE6D6]' : 'text-[#717D77]'
                      }`}
                    >
                      {persona.subtitle}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#4A5550] mb-1">
                Household Name
              </label>
              <input
                type="text"
                value={draft.householdName}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, householdName: e.target.value }))
                }
                className="w-full px-3 py-2 text-sm rounded-xl border border-[#D4D0C4] bg-[#FAF9F6]"
              />
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {(
                [
                  { k: 'adults', label: 'Adults', min: 1 },
                  { k: 'children', label: 'Children', min: 0 },
                  { k: 'olderAdults', label: '60+ Seniors', min: 0 },
                ] as const
              ).map((f) => (
                <div
                  key={f.k}
                  className="p-2.5 rounded-xl border border-[#E6E3DA] bg-[#FAF9F6]"
                >
                  <div className="text-[11px] font-medium text-[#4A5550] mb-1.5">
                    {f.label}
                  </div>
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((p) => ({
                          ...p,
                          [f.k]: Math.max(f.min, p[f.k] - 1),
                        }))
                      }
                      className="w-6 h-6 rounded bg-white border border-[#D4D0C4] text-xs font-semibold cursor-pointer"
                    >
                      −
                    </button>
                    <span className="font-mono-tabular text-sm font-semibold">
                      {draft[f.k]}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((p) => ({
                          ...p,
                          [f.k]: Math.min(8, p[f.k] + 1),
                        }))
                      }
                      className="w-6 h-6 rounded bg-white border border-[#D4D0C4] text-xs font-semibold cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#4A5550] mb-1">
                Sensitivity Precaution Preference (non-medical)
              </label>
              <select
                value={draft.respiratorySensitivity}
                onChange={(e) =>
                  setDraft((p) => ({
                    ...p,
                    respiratorySensitivity: e.target
                      .value as RespiratorySensitivity,
                  }))
                }
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#D4D0C4] bg-[#FAF9F6]"
              >
                <option value="none">Standard urban precautions</option>
                <option value="mild">Cautious on moderate/hazy days</option>
                <option value="elevated">High precaution / indoor priority</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#4A5550] mb-1">
                  Daily Commute
                </label>
                <select
                  value={draft.commuteType}
                  onChange={(e) =>
                    setDraft((p) => ({
                      ...p,
                      commuteType: e.target.value as CommuteType,
                    }))
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#D4D0C4] bg-[#FAF9F6]"
                >
                  <option value="public_transport">Public Transport</option>
                  <option value="car">Private Car</option>
                  <option value="two_wheeler">Two-Wheeler</option>
                  <option value="walking">Walking</option>
                  <option value="cycling">Cycling</option>
                  <option value="wfh">Work From Home</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#4A5550] mb-1">
                  One-Way Distance (km)
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={draft.commuteDistanceKm}
                  onChange={(e) =>
                    setDraft((p) => ({
                      ...p,
                      commuteDistanceKm: Math.max(1, Number(e.target.value) || 1),
                    }))
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#D4D0C4] bg-[#FAF9F6] font-mono-tabular"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#4A5550] mb-1">
                Typical Outdoor Activity Window
              </label>
              <select
                value={draft.outdoorWindow}
                onChange={(e) =>
                  setDraft((p) => ({
                    ...p,
                    outdoorWindow: e.target.value as OutdoorWindowPref,
                  }))
                }
                className="w-full px-3 py-2 text-xs rounded-xl border border-[#D4D0C4] bg-[#FAF9F6]"
              >
                <option value="early_morning">Early Morning (6–9 AM)</option>
                <option value="mid_morning">Mid-Morning (9–12 PM)</option>
                <option value="afternoon">Afternoon (12–4 PM)</option>
                <option value="evening">Evening (5–8 PM)</option>
                <option value="flexible">Flexible</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#4A5550] mb-1">
                  Home Type
                </label>
                <select
                  value={draft.homeType}
                  onChange={(e) =>
                    setDraft((p) => ({
                      ...p,
                      homeType: e.target.value as HomeType,
                    }))
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#D4D0C4] bg-[#FAF9F6]"
                >
                  <option value="apartment">Apartment</option>
                  <option value="independent_house">Independent House</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#4A5550] mb-1">
                  Air Purifier
                </label>
                <select
                  value={draft.hasAirPurifier ? 'yes' : 'no'}
                  onChange={(e) =>
                    setDraft((p) => ({
                      ...p,
                      hasAirPurifier: e.target.value === 'yes',
                    }))
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#D4D0C4] bg-[#FAF9F6]"
                >
                  <option value="yes">Yes (HEPA available)</option>
                  <option value="no">No air purifier</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#4A5550] mb-1">
                  Ventilation
                </label>
                <select
                  value={draft.ventilationOption}
                  onChange={(e) =>
                    setDraft((p) => ({
                      ...p,
                      ventilationOption: e.target.value as VentilationOption,
                    }))
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#D4D0C4] bg-[#FAF9F6]"
                >
                  <option value="cross_ventilation">Cross-ventilation</option>
                  <option value="exhaust_fan">Exhaust fan</option>
                  <option value="ac_recirculate">AC recirculate</option>
                  <option value="limited">Limited windows</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#4A5550] mb-1">
                  Cooking Fuel
                </label>
                <select
                  value={draft.cookingFuel}
                  onChange={(e) =>
                    setDraft((p) => ({
                      ...p,
                      cookingFuel: e.target.value as CookingFuel,
                    }))
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#D4D0C4] bg-[#FAF9F6]"
                >
                  <option value="lpg_gas">LPG / Piped Gas</option>
                  <option value="induction_electric">Induction / Electric</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#4A5550] mb-1">
                  Priority Focus
                </label>
                <select
                  value={draft.sustainabilityFocus}
                  onChange={(e) =>
                    setDraft((p) => ({
                      ...p,
                      sustainabilityFocus: e.target
                        .value as SustainabilityFocus,
                    }))
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#D4D0C4] bg-[#FAF9F6]"
                >
                  <option value="balanced">Balanced</option>
                  <option value="exposure_first">Exposure first</option>
                  <option value="low_emission_priority">Low emissions</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#4A5550] mb-1">
                  Budget Comfort
                </label>
                <select
                  value={draft.budgetPreference}
                  onChange={(e) =>
                    setDraft((p) => ({
                      ...p,
                      budgetPreference: e.target.value as BudgetPreference,
                    }))
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#D4D0C4] bg-[#FAF9F6]"
                >
                  <option value="zero_cost">Zero-cost steps</option>
                  <option value="moderate">Moderate</option>
                  <option value="flexible">Flexible</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-[#E6E3DA] flex items-center justify-end gap-2 bg-[#FAF9F6]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-[#4A5550] hover:bg-[#ECE9DF] cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#1B4332] text-white hover:bg-[#143326] cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Save & Update Plan</span>
          </button>
        </div>
      </div>
    </div>
  );
}
