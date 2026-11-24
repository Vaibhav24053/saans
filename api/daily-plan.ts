import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleNodeRequest } from '../server/handlers/router.js';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  req.url = '/api/daily-plan';
  await handleNodeRequest(req, res);
}
