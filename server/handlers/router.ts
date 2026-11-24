import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  fetchOpenMeteoAirQuality,
  reverseGeocodeCoordinates,
  searchLocations,
} from '../lib/airQuality.js';
import {
  askSaansAssistant,
  generateDailyPlan,
  getConfiguredModel,
  isGeminiConfigured,
  sanitizeErrorText,
} from '../lib/gemini.js';
import type { AirQualityData, HouseholdProfile } from '../../shared/types.js';

function sendJson(res: ServerResponse, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf-8').trim();
  if (!raw) return {};
  return JSON.parse(raw) as Record<string, unknown>;
}

export async function handleNodeRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const method = req.method ?? 'GET';
  const urlObj = new URL(req.url ?? '/', 'http://localhost');
  const pathname = urlObj.pathname;

  try {
    if (pathname === '/api/health' && method === 'GET') {
      sendJson(res, 200, {
        status: 'ok',
        geminiConfigured: isGeminiConfigured(),
        model: getConfiguredModel(),
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (pathname === '/api/geocode' && method === 'GET') {
      const q = urlObj.searchParams.get('q') ?? '';
      const latStr = urlObj.searchParams.get('lat');
      const lonStr = urlObj.searchParams.get('lon');

      if (latStr && lonStr) {
        const lat = Number(latStr);
        const lon = Number(lonStr);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
          sendJson(res, 400, { error: 'Invalid coordinates' });
          return;
        }
        const location = await reverseGeocodeCoordinates(lat, lon);
        sendJson(res, 200, { location });
        return;
      }

      if (q.trim().length < 2) {
        sendJson(res, 200, { results: [] });
        return;
      }
      const results = await searchLocations(q);
      sendJson(res, 200, { results });
      return;
    }

    if (pathname === '/api/air-quality' && method === 'GET') {
      const lat = Number(urlObj.searchParams.get('lat'));
      const lon = Number(urlObj.searchParams.get('lon'));
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        sendJson(res, 400, { error: 'Valid lat and lon query parameters are required.' });
        return;
      }
      const name = urlObj.searchParams.get('name') ?? undefined;
      const admin1 = urlObj.searchParams.get('admin1') ?? undefined;
      const country = urlObj.searchParams.get('country') ?? undefined;
      const timezone = urlObj.searchParams.get('timezone') ?? undefined;

      const data = await fetchOpenMeteoAirQuality(lat, lon, {
        name,
        admin1,
        country,
        timezone,
      });
      sendJson(res, 200, data);
      return;
    }

    if (pathname === '/api/daily-plan' && method === 'POST') {
      const body = await readJsonBody(req);
      const profile = body.profile as HouseholdProfile | undefined;
      const airData = body.airData as AirQualityData | undefined;
      if (!profile || !airData) {
        sendJson(res, 400, { error: 'Both profile and airData are required.' });
        return;
      }
      const plan = await generateDailyPlan(profile, airData);
      sendJson(res, 200, plan);
      return;
    }

    if (pathname === '/api/ask' && method === 'POST') {
      const body = await readJsonBody(req);
      const question = typeof body.question === 'string' ? body.question.trim() : '';
      const history = Array.isArray(body.history)
        ? (body.history as Array<{ role: 'user' | 'assistant'; content: string }>)
        : [];
      const profile = body.profile as HouseholdProfile | undefined;
      const airData = body.airData as AirQualityData | undefined;

      if (!question || !profile || !airData) {
        sendJson(res, 400, {
          error: 'question, profile, and airData are required.',
        });
        return;
      }
      const reply = await askSaansAssistant(question, history, profile, airData);
      sendJson(res, 200, reply);
      return;
    }

    sendJson(res, 404, { error: `API route not found: ${pathname}` });
  } catch (error) {
    const safeMessage = sanitizeErrorText(
      error instanceof Error ? error.message : 'Unexpected error',
    );
    console.error(`[SAANS API Error] ${method} ${pathname}: ${safeMessage}`);
    sendJson(res, 502, {
      error: 'Upstream or server error',
      message: safeMessage,
    });
  }
}
