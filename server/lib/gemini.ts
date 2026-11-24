import { GoogleGenAI, Type } from '@google/genai';
import { formatTimeRange, getUsAqiCategory, POLLUTANT_META } from '../../shared/aqi.js';
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

export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';

export function getConfiguredModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);
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
    .replace(/\bAIza[0-9A-Za-z_-]{20,}\b/g, '[REDACTED]')
    .replace(/\bAQ\.[0-9A-Za-z._-]{20,}\b/g, '[REDACTED]');
}

function parseHttpStatus(value: unknown): number | undefined {
  const num = typeof value === 'number' ? value : typeof value === 'string' && /^\d{3}$/.test(value.trim()) ? Number(value.trim()) : NaN;
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
    const direct =
      parseHttpStatus(errObj.status) ??
      parseHttpStatus(errObj.statusCode) ??
      parseHttpStatus(errObj.code) ??
      parseHttpStatus(errObj.response?.status) ??
      parseHttpStatus(errObj.cause?.status) ??
      parseHttpStatus(errObj.cause?.code);
    if (direct !== undefined) return direct;
  }

  const jsonCodeMatch = rawMessage.match(/"code"\s*:\s*(\d{3})\b/);
  if (jsonCodeMatch) {
    const parsed = parseHttpStatus(jsonCodeMatch[1]);
    if (parsed !== undefined) return parsed;
  }

  const httpStatusMatch = rawMessage.match(
    /\b(?:http(?:\s+status)?|status(?:\s+code)?)\s*[:=]?\s*(\d{3})\b/i,
  );
  if (httpStatusMatch) {
    const parsed = parseHttpStatus(httpStatusMatch[1]);
    if (parsed !== undefined) return parsed;
  }

  return undefined;
}

export function classifyGeminiError(
  error: unknown,
  model: string,
): { code: FallbackCode; userMessage: string } {
  const rawMessage = error instanceof Error ? error.message : String(error ?? '');
  const lower = rawMessage.toLowerCase();
  const status = extractHttpStatus(error, rawMessage);

  // 1. Transient upstream gateway/availability failures (502/503/504) must NOT be misclassified as model_unavailable
  if (
    status === 502 ||
    status === 503 ||
    status === 504 ||
    lower.includes('bad gateway') ||
    lower.includes('service unavailable') ||
    lower.includes('gateway timeout') ||
    lower.includes('"status":"unavailable"') ||
    lower.includes('"status": "unavailable"') ||
    lower.includes('high demand') ||
    lower.includes('overloaded') ||
    lower.includes('temporarily unavailable') ||
    lower.includes('econnreset') ||
    lower.includes('econnrefused') ||
    lower.includes('enotfound') ||
    lower.includes('etimedout') ||
    lower.includes('fetch failed')
  ) {
    return {
      code: 'upstream_error',
      userMessage:
        'Gemini API is temporarily unavailable. Showing SAANS personalised rules-based fallback.',
    };
  }

  // 2. Rate limits / quota exhaustion (429)
  if (
    status === 429 ||
    lower.includes('resource_exhausted') ||
    lower.includes('rate limit') ||
    lower.includes('too many requests') ||
    lower.includes('quota')
  ) {
    return {
      code: 'rate_limited',
      userMessage:
        'Gemini API rate limit or quota reached. Showing SAANS personalised rules-based fallback.',
    };
  }

  // 3. Authentication or permission failures (401 / 403)
  if (
    status === 401 ||
    status === 403 ||
    lower.includes('api_key_invalid') ||
    lower.includes('api key not valid') ||
    lower.includes('permission_denied') ||
    lower.includes('unauthenticated') ||
    lower.includes('unauthorized') ||
    lower.includes('forbidden') ||
    lower.includes('invalid api key')
  ) {
    return {
      code: 'invalid_credentials',
      userMessage:
        'Gemini API authentication or permission error. Check GEMINI_API_KEY and API permissions in the server .env file. Showing SAANS rules-based fallback.',
    };
  }

  // 4. Missing / unsupported model (404)
  if (
    status === 404 ||
    lower.includes('not_found') ||
    lower.includes('is not found') ||
    lower.includes('model not found') ||
    lower.includes('no longer available')
  ) {
    return {
      code: 'model_unavailable',
      userMessage: `Configured Gemini model (${model}) is unavailable for this API endpoint or key. Showing SAANS rules-based fallback.`,
    };
  }

  // 5. Client-side / request timeouts
  if (
    status === 408 ||
    lower.includes('timed out') ||
    lower.includes('timeout') ||
    lower.includes('aborterror')
  ) {
    return {
      code: 'timeout',
      userMessage:
        'Gemini API request timed out. Showing SAANS personalised rules-based fallback.',
    };
  }

  // 6. Structured JSON / schema validation failures
  if (
    error instanceof SyntaxError ||
    lower.includes('validation failed') ||
    lower.includes('unexpected token') ||
    lower.includes('invalid json') ||
    lower.includes('empty response') ||
    lower.includes('empty answer')
  ) {
    return {
      code: 'validation_failed',
      userMessage:
        'Gemini output did not pass structured schema validation. Showing SAANS validated rules-based fallback.',
    };
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

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  attemptTimeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

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
      const retryable = isRetryableGeminiError(error, model);
      if (!retryable || attempt >= maxRetries) {
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

  const currentPrefix = air.currentTimeLocal.slice(0, 13);
  let startIdx = air.hourly.findIndex((h) => h.time.startsWith(currentPrefix));
  if (startIdx < 0) startIdx = 0;
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

export async function generateDailyPlan(
  profile: HouseholdProfile,
  air: AirQualityData,
): Promise<DailyPlanResponse> {
  const model = getConfiguredModel();
  const ai = getAiClient();
  if (!ai) {
    return generateFallbackDailyPlan(
      profile,
      air,
      `GEMINI_API_KEY is not configured on the server. Showing SAANS personalised rules-based plan (configure GEMINI_API_KEY for ${model}).`,
      'missing_key',
    );
  }

  const context = buildCompactContext(profile, air);
  const prompt = `Generate a personalised Daily Air Action Plan in strict JSON for this household and environmental snapshot.

REQUIREMENTS:
- Provide 2 focused, high-value items per block (morning, afternoon, evening, tomorrow).
- Each item must cite 2-3 short concrete "triggers" referencing either the actual environmental data (e.g. "US AQI 188", "PM2.5 43.7 µg/m³", "Worsening 6h trend") or household preference (e.g. "1 child", "Two-wheeler 9 km", "No air purifier", "LPG cooking").
- Ensure at least 2 items across the day thoughtfully cover sustainable low-emission habits tailored to this household ("wider_emissions" or "both"), without exaggerating ambient AQI impact.
- Keep "avoidToday" and "prioritiseToday" to 2-3 crisp bullets each.

SUPPLIED CONTEXT JSON:
${JSON.stringify(context, null, 2)}`;

  try {
    const response = await executeGeminiWithRetry(
      () =>
        ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction: SYSTEM_GUARDRAILS,
            temperature: 0.35,
            responseMimeType: 'application/json',
            responseSchema: dailyPlanResponseSchema,
          },
        }),
      model,
      { maxRetries: 2, baseDelayMs: 500, maxDelayMs: 2000, attemptTimeoutMs: 20000 },
    );

    const text = response.text;
    if (!text) {
      throw new Error('Gemini returned an empty response payload.');
    }

    const parsed = JSON.parse(text);
    const validated = DailyPlanPayloadSchema.safeParse(parsed);
    if (!validated.success) {
      throw new Error(
        `Gemini output validation failed: ${validated.error.issues[0]?.message ?? 'invalid schema'}`,
      );
    }

    return {
      ...validated.data,
      source: 'gemini',
      model,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    const classified = classifyGeminiError(error, model);
    return generateFallbackDailyPlan(
      profile,
      air,
      classified.userMessage,
      classified.code,
    );
  }
}

export async function askSaansAssistant(
  question: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  profile: HouseholdProfile,
  air: AirQualityData,
): Promise<AskSaansResponse> {
  const model = getConfiguredModel();
  const ai = getAiClient();
  if (!ai) {
    return generateFallbackAskResponse(
      question,
      profile,
      air,
      `GEMINI_API_KEY is not configured on the server. Showing SAANS contextual rules-based answer (configure GEMINI_API_KEY for ${model}).`,
      'missing_key',
    );
  }

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

  try {
    const response = await executeGeminiWithRetry(
      () =>
        ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction: SYSTEM_GUARDRAILS,
            temperature: 0.4,
            responseMimeType: 'application/json',
            responseSchema: askResponseSchema,
          },
        }),
      model,
      { maxRetries: 2, baseDelayMs: 500, maxDelayMs: 2000, attemptTimeoutMs: 18000 },
    );

    const text = response.text;
    if (!text) {
      throw new Error('Gemini returned an empty answer.');
    }

    const parsed = JSON.parse(text);
    const validated = AskSaansPayloadSchema.safeParse(parsed);
    if (!validated.success) {
      throw new Error(
        `Gemini ask response validation failed: ${validated.error.issues[0]?.message ?? 'invalid schema'}`,
      );
    }

    return {
      ...validated.data,
      source: 'gemini',
      model,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    const classified = classifyGeminiError(error, model);
    return generateFallbackAskResponse(
      question,
      profile,
      air,
      classified.userMessage,
      classified.code,
    );
  }
}
