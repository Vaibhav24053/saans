import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleNodeRequest } from '../server/handlers/router.js';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!req.url?.startsWith('/api/geocode')) {
    const query = req.url?.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    req.url = `/api/geocode${query}`;
  }
  await handleNodeRequest(req, res);
}
