import { useCallback, useEffect, useState } from 'react';
import { PlayerIdentityCard } from '../components/player/PlayerIdentityCard.jsx';
import { Badge, Button, Card, StatusIndicator } from '../components/ui/index.js';
import { env } from '../config/env.js';
import { useSocket } from '../hooks/useSocket.js';
import { getHealthStatus } from '../services/healthService.js';

const PALETTE_SWATCHES = [
  'bg-rose-500',
  'bg-amber-400',
  'bg-emerald-500',
  'bg-sky-500',
  'bg-indigo-600',
  'bg-slate-900',
];

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Sketch a Prompt',
    description:
      'One player picks a secret word and illustrates it on a shared real-time canvas.',
    accent: 'bg-rose-100 text-rose-700 border-rose-200',
  },
  {
    step: '02',
    title: 'Guess in Live Chat',
    description:
      'Other players race against the round timer to type the hidden word in chat.',
    accent: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  {
    step: '03',
    title: 'Score & Rotate',
    description:
      'Faster guesses earn more points before the brush passes to the next artist.',
    accent: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
];

export function HomePage() {
  const { status: socketStatus, isConnected, socketId, error: socketError, connect, disconnect, ping } =
    useSocket();

  const [health, setHealth] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState(null);

  const [pingResult, setPingResult] = useState(null);
  const [pingLoading, setPingLoading] = useState(false);
  const [pingError, setPingError] = useState(null);

  const checkHealth = useCallback(async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      const data = await getHealthStatus();
      setHealth(data);
    } catch (err) {
      setHealth(null);
      setHealthError(err?.message || 'Health check failed');
    } finally {
      setHealthLoading(false);
    }
  }, []);

  const handlePing = useCallback(async () => {
    setPingLoading(true);
    setPingError(null);
    const startedAt = performance.now();
    try {
      const data = await ping();
      const latencyMs = Math.round(performance.now() - startedAt);
      setPingResult({ ...data, latencyMs });
    } catch (err) {
      setPingResult(null);
      setPingError(err?.message || 'Ping failed');
    } finally {
      setPingLoading(false);
    }
  }, [ping]);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  const apiIndicatorState = healthLoading
    ? 'connecting'
    : health
      ? 'connected'
      : healthError
        ? 'error'
        : 'disconnected';

  return (
    <div className="space-y-10">
      {/* Hero Banner + Player Identity Entry */}
      <section className="grid gap-6 lg:grid-cols-12 lg:items-start">
        <div className="space-y-5 lg:col-span-7">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="amber">Sketch &amp; Guess Party Game</Badge>
            <Badge variant="slate">Guest Identity Ready</Badge>
          </div>

          <h1 className="text-4xl font-black tracking-tight text-slate-900 sm:text-5xl">
            Draw fast.{' '}
            <span className="text-indigo-600 underline decoration-amber-400 decoration-4 underline-offset-4">
              Guess faster.
            </span>
          </h1>

          <p className="max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
            Pick a guest nickname to establish your player identity. Your session token is
            saved locally and restored automatically when you return.
          </p>

          {/* Decorative Color Swatches */}
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Studio Palette
            </span>
            <div className="flex items-center gap-1.5">
              {PALETTE_SWATCHES.map((swatch) => (
                <span
                  key={swatch}
                  className={`h-4 w-4 rounded-full border border-slate-900/15 ${swatch}`}
                />
              ))}
            </div>
          </div>

          {/* Live Connection Diagnostics Card */}
          <Card className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-extrabold text-slate-900">
                  Backend Connection
                </h2>
                <p className="text-xs text-slate-500">
                  REST &amp; Socket.IO diagnostics
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={checkHealth} disabled={healthLoading}>
                  {healthLoading ? 'Checking...' : 'Check Health'}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handlePing}
                  disabled={!isConnected || pingLoading}
                >
                  {pingLoading ? 'Pinging...' : 'Socket Ping'}
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {/* REST /api/health Status */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    GET /api/health
                  </span>
                  <StatusIndicator
                    state={apiIndicatorState}
                    label={
                      healthLoading
                        ? 'Checking'
                        : health
                          ? 'Healthy'
                          : healthError
                            ? 'Unreachable'
                            : 'Idle'
                    }
                  />
                </div>

                {health ? (
                  <dl className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                    <div>
                      <dt className="text-slate-400">Database</dt>
                      <dd className="font-semibold capitalize text-slate-800">{health.db}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Uptime</dt>
                      <dd className="font-semibold text-slate-800">{health.uptime}s</dd>
                    </div>
                  </dl>
                ) : (
                  <p className="text-xs text-rose-600">
                    {healthError || `Waiting for ${env.API_BASE_URL}`}
                  </p>
                )}
              </div>

              {/* Socket.IO Status */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    Socket.IO
                  </span>
                  <StatusIndicator state={socketStatus} label={socketStatus} />
                </div>

                <div className="text-xs text-slate-600 space-y-1">
                  <p className="truncate">
                    <span className="text-slate-400">ID: </span>
                    <span className="font-mono font-semibold text-slate-800">
                      {socketId || '—'}
                    </span>
                  </p>
                  {pingResult && (
                    <p className="text-emerald-700 font-medium">
                      Ack: &ldquo;{pingResult.message}&rdquo; ({pingResult.latencyMs}ms)
                    </p>
                  )}
                  {(pingError || socketError) && (
                    <p className="text-rose-600">{pingError || socketError}</p>
                  )}
                </div>

                <div>
                  {isConnected ? (
                    <Button variant="ghost" size="sm" onClick={disconnect} className="px-2 py-1">
                      Disconnect
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={connect} className="px-2 py-1">
                      Reconnect
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Guest Player Identity Card */}
        <div className="lg:col-span-5">
          <PlayerIdentityCard />
        </div>
      </section>

      {/* Game Flow Preview (Static UI Only) */}
      <section className="space-y-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">How Draw &amp; Guess Works</h2>
            <p className="text-sm text-slate-500">
              Upcoming lobby and gameplay modules will build on your guest identity.
            </p>
          </div>
          <Badge variant="slate">Rooms &amp; Canvas coming in Phase 3+</Badge>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {HOW_IT_WORKS.map((item) => (
            <Card key={item.step} className="flex flex-col justify-between gap-3">
              <div className="space-y-2.5">
                <span
                  className={`inline-flex rounded-lg border px-2 py-0.5 text-xs font-black ${item.accent}`}
                >
                  Step {item.step}
                </span>
                <h3 className="text-base font-extrabold text-slate-900">{item.title}</h3>
                <p className="text-sm leading-relaxed text-slate-600">{item.description}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
