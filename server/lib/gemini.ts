import { GoogleGenAI, Type } from '@google/genai';
import type { z } from 'zod';
import {
  findCurrentHourIndex,
  formatTimeRange,
  getUsAqiCategory,
  POLLUTANT_META,
} from '../../shared/aqi.js';
import {
  AskSaansPayloadSchema,
  DailyPlanPayloadSchema,
  type AirQualityData,
  type AskSaansResponse,
  type DailyPlanResponse,
  type FallbackCode,
  type HouseholdProfile,
} from '../../shared/types.js';
import {
  generateFallbackAskResponse,
  generateFallbackDailyPlan,
} from './fallbackEngine.js';

export interface GeminiContentClient {
  models: {
    generateContent: (params: {
      model: string;
      contents: string;
      config?: Record<string, unknown>;
    }) => Promise<{ text?: string }>;
  };
}

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  attemptTimeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

export interface GeminiCallOptions {
  client?: GeminiContentClient;
  retryOptions?: RetryOptions;
}

export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';

export function getConfiguredModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
}

export function isGeminiConfigured(): boolean {
  return Boolean(
    process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0,
  );
}

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
}

export function sanitizeErrorText(text: string): string {
  const configuredKey = process.env.GEMINI_API_KEY?.trim();
  let sanitized = text;
  if (configuredKey && configuredKey.length >= 8) {
    sanitized = sanitized.split(configuredKey).join('[REDACTED]');
  }
  return sanitized
    .replace(/([?&](?:key|api_key|apikey|token)=)[^&\s"']+/gi, '$1[REDACTED]')
    .replace(/\b(Bearer\s+)[A-Za-z0-9._-]+/gi, '$1[REDACTED]')
    .replace(/\b(x-goog-api-key\s*[:=]\s*)[^\s"',}]+/gi, '$1[REDACTED]')
    .replace(/\bAIza[0-9A-Za-z_-]{20,}\b/g, '[REDACTED]')
    .replace(/\bAQ\.[0-9A-Za-z._-]{20,}\b/g, '[REDACTED]');
}

function parseHttpStatus(value: unknown): number | undefined {
  let num = NaN;
  if (typeof value === 'number') {
    num = value;
  } else if (typeof value === 'string' && /^\d{3}$/.test(value.trim())) {
    num = Number(value.trim());
  }
  return Number.isInteger(num) && num >= 100 && num <= 599 ? num : undefined;
}

function extractHttpStatus(error: unknown, rawMessage: string): number | undefined {
  if (typeof error === 'object' && error !== null) {
    const errObj = error as {
      status?: unknown;
      statusCode?: unknown;
      code?: unknown;
      response?: { status?: unknown };
      cause?: { status?: unknown; code?: unknown };
    };
    const candidates = [
      errObj.status,
      errObj.statusCode,
      errObj.code,
      errObj.response?.status,
      errObj.cause?.status,
      errObj.cause?.code,
    ];
    for (const candidate of candidates) {
      const parsed = parseHttpStatus(candidate);
      if (parsed !== undefined) return parsed;
    }
  }

  const patterns = [
    /"code"\s*:\s*(\d{3})\b/,
    /\b(?:http(?:\s+status)?|status(?:\s+code)?)\s*[:=]?\s*(\d{3})\b/i,
  ];
  for (const pattern of patterns) {
    const match = rawMessage.match(pattern);
    if (match) {
      const parsed = parseHttpStatus(match[1]);
      if (parsed !== undefined) return parsed;
    }
  }

  return undefined;
}

interface ErrorClassificationRule {
  code: FallbackCode;
  statuses?: readonly number[];
  keywords?: readonly string[];
  matchError?: (error: unknown) => boolean;
  buildMessage: (model: string) => string;
}

// Ordered strictly by precedence: transient upstream failures (502/503/504) must never be misclassified as model_unavailable
const ERROR_CLASSIFICATION_RULES: readonly ErrorClassificationRule[] = [
  {
    code: 'upstream_error',
    statuses: [502, 503, 504],
    keywords: [
      'bad gateway',
      'service unavailable',
      'gateway timeout',
      '"status":"unavailable"',
      '"status": "unavailable"',
      'high demand',
      'overloaded',
      'temporarily unavailable',
      'econnreset',
      'econnrefused',
      'enotfound',
      'etimedout',
      'fetch failed',
    ],
    buildMessage: () =>
      'Gemini API is temporarily unavailable. Showing SAANS personalised rules-based fallback.',
  },
  {
    code: 'rate_limited',
    statuses: [429],
    keywords: ['resource_exhausted', 'rate limit', 'too many requests', 'quota'],
    buildMessage: () =>
      'Gemini API rate limit or quota reached. Showing SAANS personalised rules-based fallback.',
  },
  {
    code: 'invalid_credentials',
    statuses: [401, 403],
    keywords: [
      'api_key_invalid',
      'api key not valid',
      'permission_denied',
      'unauthenticated',
      'unauthorized',
      'forbidden',
      'invalid api key',
    ],
    buildMessage: () =>
      'Gemini API authentication or permission error. Check GEMINI_API_KEY and API permissions in the server .env file. Showing SAANS rules-based fallback.',
  },
  {
    code: 'model_unavailable',
    statuses: [404],
    keywords: [
      'not_found',
      'is not found',
      'model not found',
      'no longer available',
    ],
    buildMessage: (model) =>
      `Configured Gemini model (${model}) is unavailable for this API endpoint or key. Showing SAANS rules-based fallback.`,
  },
  {
    code: 'timeout',
    statuses: [408],
    keywords: ['timed out', 'timeout', 'aborterror'],
    buildMessage: () =>
      'Gemini API request timed out. Showing SAANS personalised rules-based fallback.',
  },
  {
    code: 'validation_failed',
    keywords: [
      'validation failed',
      'unexpected token',
      'invalid json',
      'empty response',
      'empty answer',
    ],
    matchError: (error) => error instanceof SyntaxError,
    buildMessage: () =>
      'Gemini output did not pass structured schema validation. Showing SAANS validated rules-based fallback.',
  },
];

export function classifyGeminiError(
  error: unknown,
  model: string,
): { code: FallbackCode; userMessage: string } {
  const rawMessage = error instanceof Error ? error.message : String(error ?? '');
  const lower = rawMessage.toLowerCase();
  const status = extractHttpStatus(error, rawMessage);

  for (const rule of ERROR_CLASSIFICATION_RULES) {
    const statusMatch =
      status !== undefined && Boolean(rule.statuses?.includes(status));
    const keywordMatch = Boolean(rule.keywords?.some((kw) => lower.includes(kw)));
    const customMatch = Boolean(rule.matchError?.(error));
    if (statusMatch || keywordMatch || customMatch) {
      return { code: rule.code, userMessage: rule.buildMessage(model) };
    }
  }

  return {
    code: 'upstream_error',
    userMessage:
      'Gemini API is temporarily unavailable. Showing SAANS personalised rules-based fallback.',
  };
}

export function isRetryableGeminiError(error: unknown, model: string): boolean {
  const { code } = classifyGeminiError(error, model);
  return code === 'upstream_error' || code === 'timeout';
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Gemini request timed out after ${ms}ms`)),
      ms,
    );
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function executeGeminiWithRetry<T>(
  operation: () => Promise<T>,
  model: string,
  options: RetryOptions = {},
): Promise<T> {
  const maxRetries = Math.max(0, options.maxRetries ?? 2);
  const baseDelayMs = options.baseDelayMs ?? 500;
  const maxDelayMs = options.maxDelayMs ?? 2000;
  const attemptTimeoutMs = options.attemptTimeoutMs ?? 18000;
  const sleep = options.sleep ?? defaultSleep;

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await withTimeout(operation(), attemptTimeoutMs);
    } catch (error) {
      lastError = error;
      if (!isRetryableGeminiError(error, model) || attempt >= maxRetries) {
        throw error;
      }
      const delayMs = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt));
      await sleep(delayMs);
    }
  }
  throw lastError;
}

function buildCompactContext(profile: HouseholdProfile, air: AirQualityData) {
  const cat = getUsAqiCategory(air.current.usAqi);
  const dominantMeta = POLLUTANT_META[air.summary.dominantPollutant];

  const startIdx = findCurrentHourIndex(air.hourly, air.currentTimeLocal);
  const sampledHourly = air.hourly
    .slice(startIdx, startIdx + 24)
    .filter((_, idx) => idx % 2 === 0)
    .map((pt) => ({
      time: pt.time,
      usAqi: pt.usAqi,
      pm25: pt.pm25,
      pm10: pt.pm10,
      no2: pt.no2,
    }));

  return {
    location: {
      name: air.location.name,
      region: air.location.admin1,
      country: air.location.country,
      timezone: air.timezone,
      dataMode: air.isDemo
        ? `DEMO SCENARIO (${air.demoScenarioName})`
        : `LIVE MODELLED (${air.modelName}, ${air.spatialResolutionLabel})`,
    },
    currentAirQuality: {
      scale: 'US EPA AQI (0-500)',
      usAqi: air.current.usAqi ?? 'Unavailable (do not fabricate)',
      usAqiCategory: cat.label,
      europeanAqi: air.current.europeanAqi ?? 'Unavailable',
      pm25_ugm3: air.current.pm25 ?? 'Unavailable',
      pm10_ugm3: air.current.pm10 ?? 'Unavailable',
      no2_ugm3: air.current.no2 ?? 'Unavailable',
      so2_ugm3: air.current.so2 ?? 'Unavailable',
      o3_ugm3: air.current.o3 ?? 'Unavailable',
      dominantPollutant: dominantMeta.symbol,
      localTime: air.currentTimeLocal,
    },
    forecastSummary: {
      trendDirection6h: air.summary.trendDirection,
      trendDelta6h: air.summary.trendDelta6h,
      trendNote: air.summary.trendNote,
      relativelyLowerWindow: air.summary.lowerWindow
        ? `${formatTimeRange(air.summary.lowerWindow.startTime, air.summary.lowerWindow.endTime)} (avg ~${air.summary.lowerWindow.avgUsAqi} US AQI, PM2.5 ~${air.summary.lowerWindow.avgPm25} µg/m³)`
        : 'Unavailable',
      upcomingPeakWindow: air.summary.peakWindow
        ? `${formatTimeRange(air.summary.peakWindow.startTime, air.summary.peakWindow.endTime)} (peak ~${air.summary.peakWindow.peakUsAqi} US AQI)`
        : 'Unavailable',
      tomorrowOutlook: air.summary.tomorrowOutlook ?? 'Unavailable',
      sampledNext24h: sampledHourly,
    },
    householdProfile: {
      householdName: profile.householdName,
      adults: profile.adults,
      children: profile.children,
      olderAdults: profile.olderAdults,
      respiratorySensitivityPreference: profile.respiratorySensitivity,
      commuteType: profile.commuteType,
      commuteDistanceOneWayKm: profile.commuteDistanceKm,
      preferredOutdoorWindow: profile.outdoorWindow,
      homeType: profile.homeType,
      hasAirPurifier: profile.hasAirPurifier,
      ventilationOption: profile.ventilationOption,
      cookingFuel: profile.cookingFuel,
      sustainabilityFocus: profile.sustainabilityFocus,
      budgetPreference: profile.budgetPreference,
    },
  };
}

const SYSTEM_GUARDRAILS = `You are SAANS ("Know the air. Change your day."), an empathetic, sharp, practical urban air-quality and household lifestyle companion.

STRICT GROUNDING & SAFETY RULES (NON-NEGOTIABLE):
1. Use ONLY the supplied environmental readings, forecast summary, and household profile. NEVER invent or fabricate AQI numbers, pollutant values, station names, or percentages. If a field says "Unavailable", acknowledge it honestly.
2. NEVER label any forecast window as "completely safe" or "100% safe" — use honest language such as "relatively lower-pollution window".
3. NEVER claim that an individual household's action (like taking the metro or skipping idling) will immediately lower the city's or neighbourhood's ambient AQI. Clearly separate "personal_exposure" reduction from "wider_emissions" reduction.
4. NEVER make medical diagnoses, prescribe medication, or claim to treat asthma or respiratory disease. Treat "respiratorySensitivityPreference" purely as a practical comfort/precaution preference.
5. Do NOT present modelled Open-Meteo / Copernicus CAMS estimates as official CPCB ground station readings.
6. Respect the household's actual setup: if hasAirPurifier is false, give practical zero/low-cost indoor steps first and never push expensive purchases as default.
7. Be direct, specific, human, and concise. Avoid generic environmental essays. Every recommendation must visibly reflect THIS household's members, commute, home setup, and THIS forecast trajectory.`;

const planItemSchema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING },
    title: { type: Type.STRING },
    action: { type: Type.STRING },
    whyRecommended: { type: Type.STRING },
    triggers: { type: Type.ARRAY, items: { type: Type.STRING } },
    expectedBenefit: { type: Type.STRING },
    impactCategory: {
      type: Type.STRING,
      enum: ['personal_exposure', 'wider_emissions', 'both'],
    },
    priority: { type: Type.STRING, enum: ['high', 'medium', 'low'] },
    timeframe: { type: Type.STRING },
  },
  required: [
    'id',
    'title',
    'action',
    'whyRecommended',
    'triggers',
    'expectedBenefit',
    'impactCategory',
    'priority',
    'timeframe',
  ],
};

const dailyPlanResponseSchema = {
  type: Type.OBJECT,
  properties: {
    headline: { type: Type.STRING },
    heroSummary: {
      type: Type.OBJECT,
      properties: {
        currentConditions: { type: Type.STRING },
        avoidToday: { type: Type.ARRAY, items: { type: Type.STRING } },
        prioritiseToday: { type: Type.ARRAY, items: { type: Type.STRING } },
        bestLowerWindowNote: { type: Type.STRING },
        immediateAction: { type: Type.STRING },
      },
      required: [
        'currentConditions',
        'avoidToday',
        'prioritiseToday',
        'bestLowerWindowNote',
        'immediateAction',
      ],
    },
    blocks: {
      type: Type.OBJECT,
      properties: {
        morning: { type: Type.ARRAY, items: planItemSchema },
        afternoon: { type: Type.ARRAY, items: planItemSchema },
        evening: { type: Type.ARRAY, items: planItemSchema },
        tomorrow: { type: Type.ARRAY, items: planItemSchema },
      },
      required: ['morning', 'afternoon', 'evening', 'tomorrow'],
    },
    transparencyNote: { type: Type.STRING },
  },
  required: ['headline', 'heroSummary', 'blocks', 'transparencyNote'],
};

const askResponseSchema = {
  type: Type.OBJECT,
  properties: {
    answer: { type: Type.STRING },
    keyTakeaway: { type: Type.STRING },
    impactFraming: {
      type: Type.STRING,
      enum: ['personal_exposure', 'wider_emissions', 'both', 'informational'],
    },
    dataPointsUsed: { type: Type.ARRAY, items: { type: Type.STRING } },
    followUpSuggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: [
    'answer',
    'keyTakeaway',
    'impactFraming',
    'dataPointsUsed',
    'followUpSuggestions',
  ],
};

async function invokeStructuredGemini<TPayload, TResponse>(params: {
  prompt: string;
  temperature: number;
  responseSchema: Record<string, unknown>;
  zodSchema: z.ZodType<TPayload>;
  emptyErrorMessage: string;
  validationErrorPrefix: string;
  missingKeyMessage: (model: string) => string;
  defaultTimeoutMs: number;
  options: GeminiCallOptions;
  onSuccess: (payload: TPayload, model: string) => TResponse;
  onFallback: (reason: string, code: FallbackCode) => TResponse;
}): Promise<TResponse> {
  const model = getConfiguredModel();
  const ai: GeminiContentClient | null = params.options.client ?? getAiClient();
  if (!ai) {
    return params.onFallback(params.missingKeyMessage(model), 'missing_key');
  }

  try {
    const response = await executeGeminiWithRetry(
      () =>
        ai.models.generateContent({
          model,
          contents: params.prompt,
          config: {
            systemInstruction: SYSTEM_GUARDRAILS,
            temperature: params.temperature,
            responseMimeType: 'application/json',
            responseSchema: params.responseSchema,
          },
        }),
      model,
      {
        maxRetries: 2,
        baseDelayMs: 500,
        maxDelayMs: 2000,
        attemptTimeoutMs: params.defaultTimeoutMs,
        ...params.options.retryOptions,
      },
    );

    const text = response.text;
    if (!text) {
      throw new Error(params.emptyErrorMessage);
    }

    const parsed: unknown = JSON.parse(text);
    const validated = params.zodSchema.safeParse(parsed);
    if (!validated.success) {
      throw new Error(
        `${params.validationErrorPrefix}: ${validated.error.issues[0]?.message ?? 'invalid schema'}`,
      );
    }

    return params.onSuccess(validated.data, model);
  } catch (error) {
    const classified = classifyGeminiError(error, model);
    return params.onFallback(classified.userMessage, classified.code);
  }
}

export async function generateDailyPlan(
  profile: HouseholdProfile,
  air: AirQualityData,
  options: GeminiCallOptions = {},
): Promise<DailyPlanResponse> {
  const context = buildCompactContext(profile, air);
  const prompt = `Generate a personalised Daily Air Action Plan in strict JSON for this household and environmental snapshot.

REQUIREMENTS:
- Provide 2 focused, high-value items per block (morning, afternoon, evening, tomorrow).
- Each item must cite 2-3 short concrete "triggers" referencing either the actual environmental data (e.g. "US AQI 188", "PM2.5 43.7 µg/m³", "Worsening 6h trend") or household preference (e.g. "1 child", "Two-wheeler 9 km", "No air purifier", "LPG cooking").
- Ensure at least 2 items across the day thoughtfully cover sustainable low-emission habits tailored to this household ("wider_emissions" or "both"), without exaggerating ambient AQI impact.
- Keep "avoidToday" and "prioritiseToday" to 2-3 crisp bullets each.

SUPPLIED CONTEXT JSON:
${JSON.stringify(context, null, 2)}`;

  return invokeStructuredGemini({
    prompt,
    temperature: 0.35,
    responseSchema: dailyPlanResponseSchema,
    zodSchema: DailyPlanPayloadSchema,
    emptyErrorMessage: 'Gemini returned an empty response payload.',
    validationErrorPrefix: 'Gemini output validation failed',
    missingKeyMessage: (model) =>
      `GEMINI_API_KEY is not configured on the server. Showing SAANS personalised rules-based plan (configure GEMINI_API_KEY for ${model}).`,
    defaultTimeoutMs: 20000,
    options,
    onSuccess: (data, model): DailyPlanResponse => ({
      ...data,
      source: 'gemini',
      model,
      generatedAt: new Date().toISOString(),
    }),
    onFallback: (reason, code) =>
      generateFallbackDailyPlan(profile, air, reason, code),
  });
}

export async function askSaansAssistant(
  question: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  profile: HouseholdProfile,
  air: AirQualityData,
  options: GeminiCallOptions = {},
): Promise<AskSaansResponse> {
  const context = buildCompactContext(profile, air);
  const recentHistory = history.slice(-6);

  const prompt = `Answer the user's question directly and practically using ONLY the supplied environmental data and household profile.

CONVERSATION HISTORY:
${recentHistory.length > 0 ? JSON.stringify(recentHistory, null, 2) : 'None'}

USER QUESTION:
${question}

SUPPLIED CONTEXT JSON:
${JSON.stringify(context, null, 2)}

Keep the answer crisp (2-4 short paragraphs or bullet points), cite the exact supplied readings used in "dataPointsUsed", and suggest 3 concise relevant follow-up questions in "followUpSuggestions".`;

  return invokeStructuredGemini({
    prompt,
    temperature: 0.4,
    responseSchema: askResponseSchema,
    zodSchema: AskSaansPayloadSchema,
    emptyErrorMessage: 'Gemini returned an empty answer.',
    validationErrorPrefix: 'Gemini ask response validation failed',
    missingKeyMessage: (model) =>
      `GEMINI_API_KEY is not configured on the server. Showing SAANS contextual rules-based answer (configure GEMINI_API_KEY for ${model}).`,
    defaultTimeoutMs: 18000,
    options,
    onSuccess: (data, model): AskSaansResponse => ({
      ...data,
      source: 'gemini',
      model,
      generatedAt: new Date().toISOString(),
    }),
    onFallback: (reason, code) =>
      generateFallbackAskResponse(question, profile, air, reason, code),
  });
}
