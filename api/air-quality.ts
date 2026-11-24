import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleNodeRequest } from '../server/handlers/router.js';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!req.url?.startsWith('/api/air-quality')) {
    const query = req.url?.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    req.url = `/api/air-quality${query}`;
  }
  await handleNodeRequest(req, res);
}
