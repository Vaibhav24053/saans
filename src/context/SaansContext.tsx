import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  buildDemoAirQualityData,
  DEMO_PERSONAS,
} from '@shared/demoScenarios';
import type {
  AirQualityData,
  AqiScale,
  ChatMessage,
  DailyPlanResponse,
  DemoPersonaId,
  DemoScenarioId,
  HouseholdProfile,
  LocationInfo,
} from '@shared/types';
import {
  fetchHealthStatus,
  fetchLiveAirQuality,
  requestAskSaans,
  requestDailyPlan,
  type HealthStatus,
} from '@/services/api';
import {
  isAirCacheMatchingLocation,
  parseStoredAirCache,
  parseStoredDemoState,
  parseStoredProfile,
  readStorageJson,
  writeStorageJson,
  type StoredDemoState,
} from '@/utils/storage';

export type NavSection =
  | 'overview'
  | 'planner'
  | 'intelligence'
  | 'indoor'
  | 'impact'
  | 'ask';

const STORAGE_PROFILE_KEY = 'saans_profile_v1';
const STORAGE_DEMO_KEY = 'saans_demo_v1';
const STORAGE_SCALE_KEY = 'saans_scale_v1';
const STORAGE_AIR_CACHE_KEY = 'saans_air_cache_v1';

const DEFAULT_LOCATION: LocationInfo = {
  name: 'New Delhi',
  admin1: 'Delhi',
  country: 'India',
  latitude: 28.6139,
  longitude: 77.209,
  timezone: 'Asia/Kolkata',
  source: 'geocoding',
};

export const DEFAULT_PROFILE: HouseholdProfile = {
  householdName: 'My Household',
  location: DEFAULT_LOCATION,
  adults: 2,
  children: 1,
  olderAdults: 0,
  respiratorySensitivity: 'mild',
  commuteType: 'car',
  commuteDistanceKm: 12,
  outdoorWindow: 'evening',
  homeType: 'apartment',
  hasAirPurifier: false,
  ventilationOption: 'cross_ventilation',
  cookingFuel: 'lpg_gas',
  sustainabilityFocus: 'balanced',
  budgetPreference: 'moderate',
  onboardingCompleted: false,
};

interface SaansContextValue {
  profile: HouseholdProfile;
  updateProfile: (patch: Partial<HouseholdProfile>) => void;
  setLocation: (loc: LocationInfo) => void;
  completeOnboarding: (finalProfile: HouseholdProfile, startInDemo?: boolean) => void;

  demoMode: boolean;
  demoScenarioId: DemoScenarioId;
  activePersonaId: DemoPersonaId | null;
  toggleDemoMode: (enabled: boolean) => void;
  selectDemoScenario: (id: DemoScenarioId) => void;
  applyDemoPersona: (id: DemoPersonaId) => void;

  aqiScale: AqiScale;
  setAqiScale: (scale: AqiScale) => void;

  airData: AirQualityData | null;
  airLoading: boolean;
  airError: string | null;
  isOffline: boolean;
  usingCachedOfflineData: boolean;
  refreshAirData: () => Promise<void>;

  plan: DailyPlanResponse | null;
  planLoading: boolean;
  planError: string | null;
  regeneratePlan: () => Promise<void>;

  chatMessages: ChatMessage[];
  chatLoading: boolean;
  sendChatMessage: (question: string) => Promise<void>;
  clearChat: () => void;

  healthStatus: HealthStatus | null;

  activeView: NavSection;
  setActiveView: (view: NavSection) => void;
  isProfileEditorOpen: boolean;
  setIsProfileEditorOpen: (open: boolean) => void;
  isLocationModalOpen: boolean;
  setIsLocationModalOpen: (open: boolean) => void;
  isDemoTourOpen: boolean;
  setIsDemoTourOpen: (open: boolean) => void;
}

const SaansContext = createContext<SaansContextValue | null>(null);

const DEFAULT_DEMO_STATE: StoredDemoState = {
  enabled: false,
  scenarioId: 'severe_winter_smog',
  personaId: null,
};

function loadStoredProfile(): HouseholdProfile {
  return readStorageJson(STORAGE_PROFILE_KEY, DEFAULT_PROFILE, (raw) =>
    parseStoredProfile(raw, DEFAULT_PROFILE),
  );
}

function loadStoredDemo(): StoredDemoState {
  return readStorageJson(
    STORAGE_DEMO_KEY,
    DEFAULT_DEMO_STATE,
    parseStoredDemoState,
  );
}

function buildPlanFingerprint(
  profile: HouseholdProfile,
  airData: AirQualityData | null,
): string {
  if (!airData) return '';
  return JSON.stringify({
    loc: `${airData.location.name}:${airData.location.latitude.toFixed(2)}`,
    demo: airData.demoScenarioId ?? 'live',
    aqi: airData.current.usAqi,
    pm25: airData.current.pm25,
    trend: airData.summary.trendDirection,
    adults: profile.adults,
    children: profile.children,
    olderAdults: profile.olderAdults,
    sens: profile.respiratorySensitivity,
    commute: profile.commuteType,
    dist: profile.commuteDistanceKm,
    win: profile.outdoorWindow,
    home: profile.homeType,
    purifier: profile.hasAirPurifier,
    vent: profile.ventilationOption,
    fuel: profile.cookingFuel,
    sustain: profile.sustainabilityFocus,
    budget: profile.budgetPreference,
  });
}

export function SaansProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<HouseholdProfile>(loadStoredProfile);
  const [demoState, setDemoState] = useState<StoredDemoState>(loadStoredDemo);
  const [aqiScale, setAqiScaleState] = useState<AqiScale>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_SCALE_KEY);
      return saved === 'european_aqi' ? 'european_aqi' : 'us_aqi';
    } catch {
      return 'us_aqi';
    }
  });

  const [airData, setAirData] = useState<AirQualityData | null>(null);
  const [airLoading, setAirLoading] = useState<boolean>(true);
  const [airError, setAirError] = useState<string | null>(null);
  const [usingCachedOfflineData, setUsingCachedOfflineData] = useState<boolean>(false);
  const [isOffline, setIsOffline] = useState<boolean>(() => !navigator.onLine);

  const [plan, setPlan] = useState<DailyPlanResponse | null>(null);
  const [planLoading, setPlanLoading] = useState<boolean>(false);
  const [planError, setPlanError] = useState<string | null>(null);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState<boolean>(false);
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);

  const [activeView, setActiveView] = useState<NavSection>('overview');
  const [isProfileEditorOpen, setIsProfileEditorOpen] = useState<boolean>(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState<boolean>(false);
  const [isDemoTourOpen, setIsDemoTourOpen] = useState<boolean>(false);

  const lastPlanFingerprintRef = useRef<string>('');
  const airRequestIdRef = useRef<number>(0);
  const planRequestIdRef = useRef<number>(0);

  // Persist profile, demo state, and scale
  useEffect(() => {
    writeStorageJson(STORAGE_PROFILE_KEY, profile);
  }, [profile]);

  useEffect(() => {
    writeStorageJson(STORAGE_DEMO_KEY, demoState);
  }, [demoState]);

  const setAqiScale = useCallback((scale: AqiScale) => {
    setAqiScaleState(scale);
    try {
      localStorage.setItem(STORAGE_SCALE_KEY, scale);
    } catch {
      // Ignore
    }
  }, []);

  // Online / offline listeners
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Health check once on mount
  useEffect(() => {
    fetchHealthStatus()
      .then(setHealthStatus)
      .catch(() => {
        setHealthStatus(null);
      });
  }, []);

  // Load air quality data whenever location or demo mode changes
  const refreshAirData = useCallback(async () => {
    const requestId = ++airRequestIdRef.current;
    setAirError(null);
    setUsingCachedOfflineData(false);

    if (demoState.enabled) {
      setAirLoading(true);
      const demoAir = buildDemoAirQualityData(demoState.scenarioId);
      setAirData(demoAir);
      setAirLoading(false);
      return;
    }

    setAirLoading(true);
    try {
      const live = await fetchLiveAirQuality(profile.location);
      if (requestId !== airRequestIdRef.current) return;
      setAirData(live);
      writeStorageJson(STORAGE_AIR_CACHE_KEY, live);
    } catch (err) {
      if (requestId !== airRequestIdRef.current) return;
      const message =
        err instanceof Error
          ? err.message
          : 'Unable to fetch air-quality forecast right now.';
      setAirError(message);

      // Attempt offline cached snapshot only when it matches the active household location
      const cached = readStorageJson<AirQualityData | null>(
        STORAGE_AIR_CACHE_KEY,
        null,
        parseStoredAirCache,
      );
      if (cached && isAirCacheMatchingLocation(cached, profile.location)) {
        setAirData(cached);
        setUsingCachedOfflineData(true);
      } else {
        setAirData(null);
      }
    } finally {
      if (requestId === airRequestIdRef.current) {
        setAirLoading(false);
      }
    }
  }, [demoState.enabled, demoState.scenarioId, profile.location]);

  useEffect(() => {
    if (!profile.onboardingCompleted) return;
    const timer = setTimeout(() => {
      void refreshAirData();
    }, 0);
    return () => clearTimeout(timer);
  }, [profile.onboardingCompleted, refreshAirData]);

  // Fingerprint so plan automatically regenerates when meaningful inputs change
  const planFingerprint = useMemo(
    () => buildPlanFingerprint(profile, airData),
    [airData, profile],
  );

  const runPlanGeneration = useCallback(
    async (force = false) => {
      if (!airData || !profile.onboardingCompleted) return;
      if (!force && planFingerprint === lastPlanFingerprintRef.current) return;

      const requestId = ++planRequestIdRef.current;
      lastPlanFingerprintRef.current = planFingerprint;
      setPlanLoading(true);
      setPlanError(null);
      try {
        const generated = await requestDailyPlan(profile, airData);
        if (requestId !== planRequestIdRef.current) return;
        setPlan(generated);
      } catch (err) {
        if (requestId !== planRequestIdRef.current) return;
        setPlanError(
          err instanceof Error
            ? err.message
            : 'Unable to generate your personalised daily plan right now.',
        );
      } finally {
        if (requestId === planRequestIdRef.current) {
          setPlanLoading(false);
        }
      }
    },
    [airData, profile, planFingerprint],
  );

  useEffect(() => {
    if (!airData || !profile.onboardingCompleted) return;
    const timer = setTimeout(() => {
      void runPlanGeneration(false);
    }, 0);
    return () => clearTimeout(timer);
  }, [airData, profile.onboardingCompleted, runPlanGeneration]);

  const regeneratePlan = useCallback(async () => {
    await runPlanGeneration(true);
  }, [runPlanGeneration]);

  const updateProfile = useCallback((patch: Partial<HouseholdProfile>) => {
    setProfile((prev) => ({ ...prev, ...patch }));
    setDemoState((prev) => ({ ...prev, personaId: null }));
  }, []);

  const setLocation = useCallback((loc: LocationInfo) => {
    setProfile((prev) => ({ ...prev, location: loc }));
    setDemoState((prev) => ({ ...prev, enabled: false }));
  }, []);

  const completeOnboarding = useCallback(
    (finalProfile: HouseholdProfile, startInDemo = false) => {
      setProfile({ ...finalProfile, onboardingCompleted: true });
      if (startInDemo) {
        setDemoState({
          enabled: true,
          scenarioId: 'severe_winter_smog',
          personaId: 'young_family',
        });
      }
    },
    [],
  );

  const toggleDemoMode = useCallback((enabled: boolean) => {
    setDemoState((prev) => ({ ...prev, enabled }));
    setChatMessages([]);
  }, []);

  const selectDemoScenario = useCallback((scenarioId: DemoScenarioId) => {
    setDemoState((prev) => ({ ...prev, enabled: true, scenarioId }));
    setChatMessages([]);
  }, []);

  const applyDemoPersona = useCallback((personaId: DemoPersonaId) => {
    const found = DEMO_PERSONAS.find((p) => p.id === personaId);
    if (!found) return;
    setProfile((prev) => ({
      ...prev,
      ...found.profile,
      onboardingCompleted: true,
    }));
    setDemoState((prev) => ({ ...prev, personaId }));
  }, []);

  const sendChatMessage = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!trimmed || !airData) return;

      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: 'user',
        content: trimmed,
        timestamp: new Date().toISOString(),
      };

      const historyPayload = chatMessages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      setChatMessages((prev) => [...prev, userMsg]);
      setChatLoading(true);

      try {
        const reply = await requestAskSaans(trimmed, historyPayload, profile, airData);
        const assistantMsg: ChatMessage = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: reply.answer,
          timestamp: reply.generatedAt,
          meta: {
            keyTakeaway: reply.keyTakeaway,
            impactFraming: reply.impactFraming,
            dataPointsUsed: reply.dataPointsUsed,
            followUpSuggestions: reply.followUpSuggestions,
            source: reply.source,
            model: reply.model,
            fallbackReason: reply.fallbackReason,
            generatedAt: reply.generatedAt,
          },
        };
        setChatMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        const assistantErr: ChatMessage = {
          id: `e-${Date.now()}`,
          role: 'assistant',
          content: `I couldn't reach the SAANS assistant right now (${
            err instanceof Error ? err.message : 'network error'
          }). Please check your connection and try again.`,
          timestamp: new Date().toISOString(),
        };
        setChatMessages((prev) => [...prev, assistantErr]);
      } finally {
        setChatLoading(false);
      }
    },
    [airData, chatMessages, profile],
  );

  const clearChat = useCallback(() => setChatMessages([]), []);

  const value: SaansContextValue = useMemo(
    () => ({
      profile,
      updateProfile,
      setLocation,
      completeOnboarding,
      demoMode: demoState.enabled,
      demoScenarioId: demoState.scenarioId,
      activePersonaId: demoState.personaId,
      toggleDemoMode,
      selectDemoScenario,
      applyDemoPersona,
      aqiScale,
      setAqiScale,
      airData,
      airLoading,
      airError,
      isOffline,
      usingCachedOfflineData,
      refreshAirData,
      plan,
      planLoading,
      planError,
      regeneratePlan,
      chatMessages,
      chatLoading,
      sendChatMessage,
      clearChat,
      healthStatus,
      activeView,
      setActiveView,
      isProfileEditorOpen,
      setIsProfileEditorOpen,
      isLocationModalOpen,
      setIsLocationModalOpen,
      isDemoTourOpen,
      setIsDemoTourOpen,
    }),
    [
      profile,
      updateProfile,
      setLocation,
      completeOnboarding,
      demoState.enabled,
      demoState.scenarioId,
      demoState.personaId,
      toggleDemoMode,
      selectDemoScenario,
      applyDemoPersona,
      aqiScale,
      setAqiScale,
      airData,
      airLoading,
      airError,
      isOffline,
      usingCachedOfflineData,
      refreshAirData,
      plan,
      planLoading,
      planError,
      regeneratePlan,
      chatMessages,
      chatLoading,
      sendChatMessage,
      clearChat,
      healthStatus,
      activeView,
      isProfileEditorOpen,
      isLocationModalOpen,
      isDemoTourOpen,
    ],
  );

  return <SaansContext.Provider value={value}>{children}</SaansContext.Provider>;
}

export function useSaans(): SaansContextValue {
  const ctx = useContext(SaansContext);
  if (!ctx) {
    throw new Error('useSaans must be used within a SaansProvider');
  }
  return ctx;
}
