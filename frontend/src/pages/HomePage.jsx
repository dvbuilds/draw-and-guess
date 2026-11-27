import { Link, Navigate, useLocation } from 'react-router-dom';
import { SketchPartyIllustration } from '../components/home/SketchPartyIllustration.jsx';
import { Badge, Button, Card } from '../components/ui/index.js';

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
  const location = useLocation();
  const inviteParams = new URLSearchParams(location.search);
  const invitedRoomCode = inviteParams.get('roomCode');

  if (invitedRoomCode) {
    return <Navigate to={`/join${location.search}`} replace />;
  }

  return (
    <div className="space-y-8 sm:space-y-10">
      {/* Hero Banner + Animated Sketch Illustration */}
      <section className="grid gap-8 lg:grid-cols-12 lg:items-center">
        <div className="min-w-0 space-y-5 lg:col-span-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="amber">Sketch &amp; Guess Party Game</Badge>
            <Badge variant="indigo">Play Instantly · No Sign-up</Badge>
          </div>

          <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-5xl">
            Draw fast.{' '}
            <span className="text-indigo-600 underline decoration-amber-400 decoration-4 underline-offset-4">
              Guess faster.
            </span>
          </h1>

          <p className="max-w-xl text-sm leading-relaxed text-slate-600 sm:text-lg">
            Pick a guest nickname, create a custom public or private room, and challenge friends
            with live drawing, progressive hints, and fast-paced chat guessing.
          </p>

          <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:flex-wrap sm:items-center">
            <Link to="/create" className="w-full sm:w-auto">
              <Button variant="primary" size="lg" className="w-full sm:w-auto">
                Create a Room
              </Button>
            </Link>
            <Link to="/join" className="w-full sm:w-auto">
              <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                Join with Code
              </Button>
            </Link>
          </div>

          {/* Studio Palette Preview */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
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
        </div>

        {/* Playful Cartoon Game Illustration */}
        <div className="min-w-0 lg:col-span-6">
          <SketchPartyIllustration />
        </div>
      </section>

      {/* How Draw & Guess Works */}
      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">How Draw &amp; Guess Works</h2>
            <p className="text-sm text-slate-500">
              Jump into a round in seconds — customize categories, languages, timers, and hints.
            </p>
          </div>
          <Badge variant="emerald">Lobby, Canvas &amp; Chat Ready</Badge>
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
