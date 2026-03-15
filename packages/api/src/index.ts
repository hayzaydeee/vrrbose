import express from 'express';
import cors from 'cors';
import { verifyToken } from '@clerk/backend';

const PORT = process.env['PORT'] ? parseInt(process.env['PORT']) : 3001;
const ALLOWED_ORIGIN = process.env['APP_ORIGIN'] ?? 'https://app.vrrbose.dev';
const CLERK_SECRET_KEY = process.env['CLERK_SECRET_KEY'] ?? '';

// In-memory device grant store: device_id → { token, userId, expiresAt }
interface DeviceGrant {
  token: string;
  userId: string;
  expiresAt: number;
}
const deviceGrants = new Map<string, DeviceGrant>();

// Clean up expired grants every minute
setInterval(() => {
  const now = Date.now();
  for (const [id, grant] of deviceGrants) {
    if (grant.expiresAt < now) deviceGrants.delete(id);
  }
}, 60_000);

const app = express();

app.use(cors({
  origin: [ALLOWED_ORIGIN, 'http://localhost:3000'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// Health
app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

/**
 * POST /auth/device
 * Called by the web UI after the user authenticates with Clerk.
 * Body: { device_id: string, token: string }
 * The token is a Clerk session JWT. We verify it, then store the mapping.
 */
app.post('/auth/device', async (req, res) => {
  const { device_id, token } = req.body as { device_id?: string; token?: string };

  if (!device_id || !token) {
    res.status(400).json({ error: 'device_id and token are required' });
    return;
  }

  // Verify the Clerk JWT to ensure it's genuine
  let userId: string;
  try {
    const payload = await verifyToken(token, { secretKey: CLERK_SECRET_KEY });
    userId = payload.sub;
  } catch {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }

  // Store for 10 minutes (CLI has 5 min timeout, extra buffer)
  deviceGrants.set(device_id, {
    token,
    userId,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });

  res.json({ ok: true });
});

/**
 * GET /auth/device?device_id=xxx
 * Polled by the CLI. Returns the token once available.
 */
app.get('/auth/device', (req, res) => {
  const device_id = req.query['device_id'] as string | undefined;

  if (!device_id) {
    res.status(400).json({ error: 'device_id is required' });
    return;
  }

  const grant = deviceGrants.get(device_id);

  if (!grant) {
    res.status(404).json({ pending: true });
    return;
  }

  if (grant.expiresAt < Date.now()) {
    deviceGrants.delete(device_id);
    res.status(410).json({ error: 'Grant expired' });
    return;
  }

  // One-time use: delete after retrieval
  deviceGrants.delete(device_id);

  res.json({ token: grant.token, user_id: grant.userId });
});

app.listen(PORT, () => {
  console.log(`vrrbose api listening on :${PORT}`);
});
