import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import dotenv from 'dotenv';
import { handleNodeRequest } from './handlers/router.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load project root .env regardless of current working directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();
const app = express();
const PORT = Number(process.env.PORT) || 3001;

// Route all /api/* traffic through our shared handler
app.use('/api', (req, res) => {
  // Express strips '/api' from req.url; restore it for handleNodeRequest
  req.url = `/api${req.url}`;
  void handleNodeRequest(req, res);
});

// Serve built Vite static frontend in production
const distDir = path.resolve(__dirname, '../../dist');
app.use(express.static(distDir));
app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`SAANS production server running at http://localhost:${PORT}`);
});
