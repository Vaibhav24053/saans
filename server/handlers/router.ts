import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  fetchOpenMeteoAirQuality,
  isValidCoordinates,
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
import {
  AskSaansRequestSchema,
  DailyPlanRequestSchema,
} from '../../shared/types.js';

const MAX_BODY_BYTES = 512 * 1024; // 512 KB

class HttpError extends Error {
  readonly status: number;
  readonly allow?: string;

  constructor(status: number, message: string, allow?: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.allow = allow;
  }
}

function sendJson(
  res: ServerResponse,
  status: number,
  payload: unknown,
  extraHeaders?: Record<string, string>,
): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (extraHeaders) {
    for (const [key, value] of Object.entries(extraHeaders)) {
      res.setHeader(key, value);
    }
  }
  res.end(JSON.stringify(payload));
}

function assertMethod(method: string, allowed: string): void {
  if (method !== allowed) {
    throw new HttpError(
      405,
      `Method ${method} is not allowed for this route. Use ${allowed}.`,
      allowed,
    );
  }
}

function parseCoordinatePair(
  latStr: string | null,
  lonStr: string | null,
): { lat: number; lon: number } | null {
  if (latStr === null || lonStr === null) return null;
  const trimmedLat = latStr.trim();
  const trimmedLon = lonStr.trim();
  if (!trimmedLat || !trimmedLon) return null;

  const lat = Number(trimmedLat);
  const lon = Number(trimmedLon);
  if (!isValidCoordinates(lat, lon)) return null;
  return { lat, lon };
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
    totalBytes += buf.length;
    if (totalBytes > MAX_BODY_BYTES) {
      throw new HttpError(413, 'Request payload exceeds the maximum allowed size.');
    }
    chunks.push(buf);
  }

  const raw = Buffer.concat(chunks).toString('utf-8').trim();
  if (!raw) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new HttpError(400, 'Invalid JSON request body.');
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new HttpError(400, 'Request body must be a JSON object.');
  }

  return parsed as Record<string, unknown>;
}

function formatValidationIssue(
  issues: Array<{ path: ReadonlyArray<PropertyKey>; message: string }>,
): string {
  const first = issues[0];
  if (!first) return 'Invalid request payload.';
  const field = first.path.length > 0 ? first.path.map(String).join('.') : 'body';
  return `Invalid request field "${field}": ${first.message}`;
}

export async function handleNodeRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const method = (req.method ?? 'GET').toUpperCase();
  const urlObj = new URL(req.url ?? '/', 'http://localhost');
  const pathname = urlObj.pathname;

  try {
    if (pathname === '/api/health') {
      assertMethod(method, 'GET');
      sendJson(res, 200, {
        status: 'ok',
        geminiConfigured: isGeminiConfigured(),
        model: getConfiguredModel(),
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (pathname === '/api/geocode') {
      assertMethod(method, 'GET');
      const q = urlObj.searchParams.get('q') ?? '';
      const latStr = urlObj.searchParams.get('lat');
      const lonStr = urlObj.searchParams.get('lon');

      if (latStr !== null || lonStr !== null) {
        const coords = parseCoordinatePair(latStr, lonStr);
        if (!coords) {
          sendJson(res, 400, {
            error:
              'Invalid coordinates. Provide valid numeric lat (-90 to 90) and lon (-180 to 180).',
          });
          return;
        }
        const location = await reverseGeocodeCoordinates(coords.lat, coords.lon);
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

    if (pathname === '/api/air-quality') {
      assertMethod(method, 'GET');
      const coords = parseCoordinatePair(
        urlObj.searchParams.get('lat'),
        urlObj.searchParams.get('lon'),
      );
      if (!coords) {
        sendJson(res, 400, {
          error:
            'Valid lat (-90 to 90) and lon (-180 to 180) query parameters are required.',
        });
        return;
      }
      const name = urlObj.searchParams.get('name') ?? undefined;
      const admin1 = urlObj.searchParams.get('admin1') ?? undefined;
      const country = urlObj.searchParams.get('country') ?? undefined;
      const timezone = urlObj.searchParams.get('timezone') ?? undefined;

      const data = await fetchOpenMeteoAirQuality(coords.lat, coords.lon, {
        name,
        admin1,
        country,
        timezone,
      });
      sendJson(res, 200, data);
      return;
    }

    if (pathname === '/api/daily-plan') {
      assertMethod(method, 'POST');
      const body = await readJsonBody(req);
      if (!body.profile || !body.airData) {
        sendJson(res, 400, { error: 'Both profile and airData are required.' });
        return;
      }
      const parsed = DailyPlanRequestSchema.safeParse(body);
      if (!parsed.success) {
        sendJson(res, 400, {
          error: formatValidationIssue(parsed.error.issues),
        });
        return;
      }
      const plan = await generateDailyPlan(parsed.data.profile, parsed.data.airData);
      sendJson(res, 200, plan);
      return;
    }

    if (pathname === '/api/ask') {
      assertMethod(method, 'POST');
      const body = await readJsonBody(req);
      const question = typeof body.question === 'string' ? body.question.trim() : '';
      if (!question || !body.profile || !body.airData) {
        sendJson(res, 400, {
          error: 'question, profile, and airData are required.',
        });
        return;
      }
      const parsed = AskSaansRequestSchema.safeParse(body);
      if (!parsed.success) {
        sendJson(res, 400, {
          error: formatValidationIssue(parsed.error.issues),
        });
        return;
      }
      const reply = await askSaansAssistant(
        parsed.data.question,
        parsed.data.history,
        parsed.data.profile,
        parsed.data.airData,
      );
      sendJson(res, 200, reply);
      return;
    }

    sendJson(res, 404, { error: `API route not found: ${pathname}` });
  } catch (error) {
    if (error instanceof HttpError) {
      sendJson(
        res,
        error.status,
        { error: sanitizeErrorText(error.message) },
        error.allow ? { Allow: error.allow } : undefined,
      );
      return;
    }

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
