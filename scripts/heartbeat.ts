// Simple heartbeat script to periodically ping the health endpoint.
// If HEALTH_URL env var is set, it will use that URL; otherwise falls back to localhost.
const healthUrl = process.env.HEALTH_URL ?? 'http://localhost:3000/api/health';
const intervalMs = Number(process.env.INTERVAL_MS) ?? 60000; // default 60s
async function checkHealth() {
  try {
    const response = await fetch(healthUrl);
    const data = await response.json();
    const ok = response.ok;
    console.log(`[heartbeat] status: ${ok ? 'OK' : 'FAIL'}, latency ${response.headers.get('x-response-time') ?? 'N/A'}ms`);
    console.log(data);
    if (!ok) {
      console.error(`[heartbeat] Health check returned non-200 status: ${response.status}`);
    }
  } catch (err) {
    console.error('[heartbeat] error:', err instanceof Error ? err.message : String(err));
  }
}
checkHealth();
if (intervalMs > 0) {
  console.log(`[heartbeat] watching ${healthUrl} every ${intervalMs}ms`);
  setInterval(checkHealth, intervalMs);
}
