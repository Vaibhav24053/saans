import {
  Activity,
  Beaker,
  CalendarCheck2,
  Compass,
  Home,
  LayoutDashboard,
  Leaf,
  MapPin,
  MessageSquareText,
  SlidersHorizontal,
  Sparkles,
  WifiOff,
} from 'lucide-react';
import { useSaans, type NavSection } from '@/context/SaansContext';
import { BrandMark } from '@/components/BrandMark';
import { OnboardingFlow } from '@/components/OnboardingFlow';
import { LocationSearchModal } from '@/components/LocationSearchModal';
import { ProfileEditorDrawer } from '@/components/ProfileEditorDrawer';
import { DemoControlBar } from '@/components/DemoControlBar';
import { GuidedDemoTour } from '@/components/GuidedDemoTour';
import { OverviewView } from '@/views/OverviewView';
import { PlannerView } from '@/views/PlannerView';
import { AirIntelligenceView } from '@/views/AirIntelligenceView';
import { IndoorCoachView } from '@/views/IndoorCoachView';
import { ImpactView } from '@/views/ImpactView';
import { AskSaansView } from '@/views/AskSaansView';

const NAV_ITEMS: Array<{
  id: NavSection;
  label: string;
  shortLabel: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: 'overview', label: 'Today', shortLabel: 'Today', icon: LayoutDashboard },
  {
    id: 'planner',
    label: 'AI Daily Planner',
    shortLabel: 'Planner',
    icon: CalendarCheck2,
  },
  {
    id: 'intelligence',
    label: 'Air Intelligence',
    shortLabel: 'Air Data',
    icon: Activity,
  },
  {
    id: 'indoor',
    label: 'Home Air-Ready',
    shortLabel: 'Indoor',
    icon: Home,
  },
  {
    id: 'impact',
    label: 'Choices & Impact',
    shortLabel: 'Impact',
    icon: Leaf,
  },
  {
    id: 'ask',
    label: 'Ask SAANS',
    shortLabel: 'Ask AI',
    icon: MessageSquareText,
  },
];

export default function App() {
  const {
    profile,
    setLocation,
    airData,
    demoMode,
    toggleDemoMode,
    isOffline,
    usingCachedOfflineData,
    healthStatus,
    activeView,
    setActiveView,
    setIsProfileEditorOpen,
    isLocationModalOpen,
    setIsLocationModalOpen,
    setIsDemoTourOpen,
  } = useSaans();

  if (!profile.onboardingCompleted) {
    return <OnboardingFlow />;
  }

  return (
    <div className="min-h-screen bg-[#F7F6F2] text-[#151B18] flex flex-col lg:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white border-r border-[#E6E3DA] z-20">
        <div className="px-5 pt-6 pb-5 flex items-center gap-2.5">
          <BrandMark className="w-9 h-9" />
          <div>
            <div className="text-lg font-bold tracking-tight text-[#151B18]">
              SAANS
            </div>
            <div className="text-[11px] text-[#717D77] -mt-0.5">
              Know the air. Change your day.
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-1" aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveView(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#1B4332] text-white shadow-xs'
                    : 'text-[#4A5550] hover:bg-[#F2F0E9] hover:text-[#151B18]'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer: Demo Walkthrough + Engine Status */}
        <div className="p-4 border-t border-[#ECE9DF] space-y-2.5">
          <button
            type="button"
            onClick={() => {
              if (!demoMode) toggleDemoMode(true);
              setIsDemoTourOpen(true);
            }}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[#F4F7F4] text-[#1B4332] border border-[#D4E3DA] hover:bg-[#E6F0EB] transition-colors cursor-pointer"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Guided Demo Tour</span>
          </button>

          <div className="px-3 py-2 rounded-xl bg-[#FAF9F6] border border-[#E6E3DA] text-[11px] text-[#4A5550]">
            <div className="flex items-center gap-1.5 font-semibold text-[#151B18]">
              <Sparkles className="w-3 h-3 text-[#2D6A4F]" />
              <span>
                {healthStatus?.geminiConfigured
                  ? `Gemini ${healthStatus.model}`
                  : 'Rules-Based Mode'}
              </span>
            </div>
            <p className="text-[10px] text-[#717D77] mt-0.5">
              {healthStatus?.geminiConfigured
                ? 'Server-side Gemini API active'
                : 'Add GEMINI_API_KEY in .env for Gemini'}
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content Shell */}
      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen pb-20 lg:pb-8">
        {/* Top Utility Header */}
        <header className="sticky top-0 z-10 bg-[#F7F6F2]/90 backdrop-blur-md border-b border-[#E6E3DA]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-2">
            {/* Mobile Brand */}
            <div className="flex items-center gap-2 lg:hidden">
              <BrandMark className="w-7 h-7" />
              <span className="font-bold text-base tracking-tight">SAANS</span>
            </div>

            {/* Location Pill */}
            <button
              type="button"
              onClick={() => setIsLocationModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#E6E3DA] hover:border-[#2D6A4F] text-xs font-medium text-[#151B18] transition-colors cursor-pointer max-w-[180px] sm:max-w-xs truncate"
            >
              <MapPin className="w-3.5 h-3.5 text-[#1B4332] shrink-0" />
              <span className="truncate">
                {airData?.location.name ?? profile.location.name}
              </span>
              {demoMode && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#E6F0EB] text-[#1B4332] font-semibold">
                  Sample
                </span>
              )}
            </button>

            {/* Right Controls */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggleDemoMode(!demoMode)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                  demoMode
                    ? 'bg-[#1B4332] text-white border-[#1B4332]'
                    : 'bg-white text-[#151B18] border-[#E6E3DA] hover:border-[#2D6A4F]'
                }`}
              >
                <Beaker className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">
                  {demoMode ? 'Demo Mode: On' : 'Demo Mode'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setIsProfileEditorOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#E6E3DA] hover:border-[#2D6A4F] text-xs font-medium text-[#151B18] transition-colors cursor-pointer"
                aria-label="Edit household preferences"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#2D6A4F]" />
                <span className="hidden sm:inline max-w-[130px] truncate">
                  {profile.householdName || 'Household'}
                </span>
              </button>
            </div>
          </div>
        </header>

        {/* Main View Canvas */}
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6">
          {(isOffline || usingCachedOfflineData) && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-[#FEF0E1] border border-[#F4C99E] text-xs text-[#9C4212] flex items-center gap-2">
              <WifiOff className="w-4 h-4 shrink-0" />
              <span>
                {isOffline
                  ? 'You appear to be offline. Displaying cached data where available — switch to Demo Mode to explore sample scenarios offline.'
                  : 'Live fetch was temporarily unreachable; showing your most recent cached air-quality snapshot.'}
              </span>
            </div>
          )}

          <DemoControlBar />

          {activeView === 'overview' && <OverviewView />}
          {activeView === 'planner' && <PlannerView />}
          {activeView === 'intelligence' && <AirIntelligenceView />}
          {activeView === 'indoor' && <IndoorCoachView />}
          {activeView === 'impact' && <ImpactView />}
          {activeView === 'ask' && <AskSaansView />}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav
        aria-label="Mobile navigation"
        className="lg:hidden fixed bottom-0 inset-x-0 z-20 bg-white border-t border-[#E6E3DA] px-1 py-1.5 grid grid-cols-6 gap-0.5"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveView(item.id)}
              className={`flex flex-col items-center justify-center py-1 rounded-lg text-[10px] font-medium transition-colors cursor-pointer ${
                active ? 'text-[#1B4332] bg-[#E6F0EB]' : 'text-[#717D77]'
              }`}
            >
              <Icon className="w-4 h-4 mb-0.5" />
              <span className="truncate">{item.shortLabel}</span>
            </button>
          );
        })}
      </nav>

      {/* Modals & Drawers */}
      <LocationSearchModal
        open={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        onSelect={(loc) => setLocation(loc)}
        currentLocation={profile.location}
      />
      <ProfileEditorDrawer />
      <GuidedDemoTour />
    </div>
  );
}
