import dotenv from 'dotenv';
import express from 'express';
import type { Server } from 'node:http';
import type { Response } from 'express';

import {
  clearDashboardCache,
  getDashboardCacheStats,
  getDashboardData,
  verifyGithubWebhookSignature,
} from './github';

dotenv.config();

const app = express();
const preferredPort = Number(process.env.PORT ?? 8787);
const maxPortAttempts = 10;
const eventClients = new Set<Response>();
const warmupDayOptions = [7, 30, 90, 365];

function broadcastEvent(event: string, data: Record<string, unknown>): void {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  eventClients.forEach((client) => {
    client.write(payload);
  });
}

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-GitHub-Event,X-Hub-Signature-256');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

app.use(
  express.json({
    verify: (req, _res, buffer) => {
      (req as express.Request & { rawBody?: Buffer }).rawBody = buffer;
    },
  }),
);

function getOwner(): string | null {
  return process.env.GITHUB_OWNER ?? process.env.GITHUB_ORG ?? null;
}

function getRepos(): string[] {
  const raw = process.env.GITHUB_REPOS ?? '';
  return raw
    .split(',')
    .map((repo) => repo.trim())
    .filter(Boolean);
}

async function warmDashboardCache(): Promise<void> {
  const owner = getOwner();
  const token = process.env.GITHUB_TOKEN;

  if (!owner || !token) {
    return;
  }

  const repos = getRepos();
  const warmupStart = Date.now();
  console.log(`[dashboard:warmup] start owner=${owner} filters=${warmupDayOptions.join(',')}`);

  const results = await Promise.allSettled(
    warmupDayOptions.map((days) =>
      getDashboardData(
        {
          owner,
          repos,
          token,
          days,
        },
        'webhook-preload',
      ),
    ),
  );

  const fulfilled = results.filter((result) => result.status === 'fulfilled').length;
  const failed = results.length - fulfilled;
  console.log(
    `[dashboard:warmup] done success=${fulfilled} failed=${failed} duration=${Date.now() - warmupStart}ms cacheEntries=${getDashboardCacheStats().entries}`,
  );

  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.error(`[dashboard:warmup] failed days=${warmupDayOptions[index]}`, result.reason);
    }
  });
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    ownerConfigured: Boolean(getOwner()),
    tokenConfigured: Boolean(process.env.GITHUB_TOKEN),
    webhookConfigured: Boolean(process.env.GITHUB_WEBHOOK_SECRET),
    reposConfigured: getRepos(),
    cacheEntries: getDashboardCacheStats().entries,
  });
});

app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  res.write(`event: connected\ndata: ${JSON.stringify({ ok: true, timestamp: new Date().toISOString() })}\n\n`);
  eventClients.add(res);

  const heartbeat = setInterval(() => {
    res.write(`event: heartbeat\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`);
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
    eventClients.delete(res);
    res.end();
  });
});

app.get('/api/dashboard', async (_req, res) => {
  const owner = getOwner();
  const token = process.env.GITHUB_TOKEN;
  const rawDays = typeof _req.query.days === 'string' ? Number(_req.query.days) : 30;

  if (!owner || !token) {
    res.status(503).json({
      error: 'GitHub integration is not fully configured.',
      missing: {
        GITHUB_OWNER: !owner,
        GITHUB_TOKEN: !token,
      },
    });
    return;
  }

  try {
    const payload = await getDashboardData({
      owner,
      repos: getRepos(),
      token,
      days: rawDays,
    });
    res.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      error: 'Failed to load GitHub dashboard data.',
      details: message,
    });
  }
});

app.post('/api/github/webhook', (req, res) => {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    res.status(503).json({
      ok: false,
      error: 'Webhook secret is not configured.',
    });
    return;
  }

  const rawBody = (req as express.Request & { rawBody?: Buffer }).rawBody;
  const signature = req.header('X-Hub-Signature-256');

  if (!rawBody || !verifyGithubWebhookSignature(rawBody, signature, secret)) {
    res.status(401).json({
      ok: false,
      error: 'Invalid webhook signature.',
    });
    return;
  }

  clearDashboardCache();
  broadcastEvent('dashboard-refresh', {
    source: 'github-webhook',
    event: req.header('X-GitHub-Event') ?? 'unknown',
    action: typeof req.body?.action === 'string' ? req.body.action : null,
    timestamp: new Date().toISOString(),
  });
  void warmDashboardCache();

  res.json({
    ok: true,
    event: req.header('X-GitHub-Event') ?? 'unknown',
    action: typeof req.body?.action === 'string' ? req.body.action : null,
    message: 'Webhook accepted and dashboard cache cleared.',
  });
});

function startServer(port: number, attempt = 0): Server {
  const server = app.listen(port, () => {
    console.log(`DevProof API listening on http://localhost:${port}`);
    void warmDashboardCache();
  });

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE' && attempt < maxPortAttempts - 1) {
      const nextPort = port + 1;
      console.warn(`Port ${port} is already in use, trying ${nextPort}...`);
      startServer(nextPort, attempt + 1);
      return;
    }

    console.error(`Failed to start API server on port ${port}.`, error);
    process.exit(1);
  });

  return server;
}

startServer(preferredPort);
