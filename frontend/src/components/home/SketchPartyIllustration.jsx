import { Badge, Card } from '../ui/index.js';

export function SketchPartyIllustration() {
  return (
    <Card
      variant="elevated"
      className="relative overflow-hidden border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-amber-50 p-4 sm:p-6"
    >
      {/* Subtle decorative dots in purple & yellow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-amber-300/25 blur-xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-10 -left-10 h-36 w-36 rounded-full bg-indigo-400/20 blur-xl"
      />

      <div className="relative space-y-4">
        {/* Top playful header pills */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge variant="indigo">Live Sketch Arena</Badge>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-100/90 px-2.5 py-0.5 text-[11px] font-extrabold text-amber-900">
            <span aria-hidden="true">★</span> Draw &amp; Guess Together
          </span>
        </div>

        {/* Playful Cartoon SVG Scene */}
        <div className="relative mx-auto w-full max-w-xl">
          <svg
            viewBox="0 0 540 285"
            role="img"
            aria-label="Cartoon characters sketching and guessing doodles on a canvas"
            className="h-auto w-full select-none"
          >
            {/* Soft background cloud & doodle sparkles */}
            <g className="animate-sketch-float" opacity="0.9">
              {/* Floating Sparkle Star Top-Left */}
              <path
                d="M44 46 L48 34 L52 46 L64 50 L52 54 L48 66 L44 54 L32 50 Z"
                fill="#FBBF24"
                stroke="#1E1B4B"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
              {/* Small doodle spiral */}
              <path
                d="M28 110 C22 100, 38 92, 42 104 C46 114, 30 120, 26 114"
                fill="none"
                stroke="#818CF8"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </g>

            {/* Floating Pencil Top-Right */}
            <g className="animate-sketch-float-delayed">
              <g transform="translate(466 36) rotate(22)">
                <rect
                  x="0"
                  y="0"
                  width="18"
                  height="52"
                  rx="4"
                  fill="#FBBF24"
                  stroke="#1E1B4B"
                  strokeWidth="3"
                />
                <rect
                  x="0"
                  y="0"
                  width="18"
                  height="11"
                  rx="3"
                  fill="#F472B6"
                  stroke="#1E1B4B"
                  strokeWidth="3"
                />
                <polygon
                  points="0,52 18,52 9,68"
                  fill="#FEF3C7"
                  stroke="#1E1B4B"
                  strokeWidth="3"
                  strokeLinejoin="round"
                />
                <polygon points="6,62 12,62 9,68" fill="#1E1B4B" />
              </g>
            </g>

            {/* Center Cartoon Sketch Canvas Board */}
            <g transform="translate(132 24)">
              {/* Canvas drop shadow */}
              <rect
                x="6"
                y="8"
                width="268"
                height="194"
                rx="20"
                fill="#C7D2FE"
              />
              {/* Main white board */}
              <rect
                x="0"
                y="0"
                width="268"
                height="194"
                rx="20"
                fill="#FFFFFF"
                stroke="#1E1B4B"
                strokeWidth="4"
              />
              {/* Board top bar */}
              <rect
                x="0"
                y="0"
                width="268"
                height="32"
                rx="18"
                fill="#4F46E5"
                stroke="#1E1B4B"
                strokeWidth="4"
              />
              <rect x="2" y="18" width="264" height="14" fill="#4F46E5" />
              <line x1="2" y1="32" x2="266" y2="32" stroke="#1E1B4B" strokeWidth="3" />

              {/* Decorative board dots & secret word blanks */}
              <circle cx="20" cy="16" r="4.5" fill="#FBBF24" />
              <circle cx="34" cy="16" r="4.5" fill="#FFFFFF" />
              <rect x="78" y="11" width="112" height="10" rx="5" fill="#3730A3" />
              <text
                x="134"
                y="20"
                textAnchor="middle"
                fill="#FEF3C7"
                fontSize="9"
                fontWeight="800"
                letterSpacing="2.5"
              >
                R _ C K _ T
              </text>

              {/* Animated drawn doodle inside the canvas: cute rocket + stars */}
              <path
                d="M134 56 C152 72, 156 106, 148 134 L120 134 C112 106, 116 72, 134 56 Z M120 116 L104 134 L120 132 M148 116 L164 134 L148 132 M127 136 L134 158 L141 136"
                fill="none"
                stroke="#4F46E5"
                strokeWidth="4.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="animate-sketch-draw"
              />
              <circle
                cx="134"
                cy="95"
                r="10"
                fill="#FDE68A"
                stroke="#1E1B4B"
                strokeWidth="3"
              />
              {/* Little hand-drawn stars around rocket */}
              <path
                d="M66 76 L70 68 L74 76 L82 80 L74 84 L70 92 L66 84 L58 80 Z"
                fill="#FBBF24"
                stroke="#1E1B4B"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
              <circle cx="204" cy="74" r="5" fill="#818CF8" />
              <circle cx="218" cy="126" r="3.5" fill="#FBBF24" />

              {/* Paint palette mini strip bottom of canvas */}
              <g transform="translate(22 162)">
                <circle cx="8" cy="8" r="7" fill="#4F46E5" stroke="#1E1B4B" strokeWidth="2" />
                <circle cx="28" cy="8" r="7" fill="#FBBF24" stroke="#1E1B4B" strokeWidth="2" />
                <circle cx="48" cy="8" r="7" fill="#F43F5E" stroke="#1E1B4B" strokeWidth="2" />
                <circle cx="68" cy="8" r="7" fill="#10B981" stroke="#1E1B4B" strokeWidth="2" />
                <rect
                  x="154"
                  y="1"
                  width="68"
                  height="14"
                  rx="7"
                  fill="#EEF2FF"
                  stroke="#C7D2FE"
                  strokeWidth="2"
                />
                <text
                  x="188"
                  y="11"
                  textAnchor="middle"
                  fill="#4338CA"
                  fontSize="8.5"
                  fontWeight="800"
                >
                  00:42 LEFT
                </text>
              </g>
            </g>

            {/* Left Cartoon Artist Character (Purple mascot with beret + paintbrush) */}
            <g transform="translate(28 122)" className="animate-sketch-bounce">
              {/* Cute round body */}
              <ellipse
                cx="52"
                cy="96"
                rx="38"
                ry="34"
                fill="#6366F1"
                stroke="#1E1B4B"
                strokeWidth="4"
              />
              {/* Belly highlight */}
              <ellipse cx="52" cy="106" rx="22" ry="18" fill="#818CF8" opacity="0.55" />
              {/* Purple Beret */}
              <path
                d="M20 66 C18 46, 82 42, 84 66 Z"
                fill="#FBBF24"
                stroke="#1E1B4B"
                strokeWidth="3.5"
              />
              <line x1="51" y1="45" x2="54" y2="37" stroke="#1E1B4B" strokeWidth="3.5" strokeLinecap="round" />
              {/* Happy eyes & rosy cheeks */}
              <circle cx="40" cy="84" r="4.5" fill="#1E1B4B" />
              <circle cx="64" cy="84" r="4.5" fill="#1E1B4B" />
              <circle cx="39" cy="82.5" r="1.5" fill="#FFFFFF" />
              <circle cx="63" cy="82.5" r="1.5" fill="#FFFFFF" />
              <ellipse cx="32" cy="92" rx="4.5" ry="2.5" fill="#FDA4AF" />
              <ellipse cx="72" cy="92" rx="4.5" ry="2.5" fill="#FDA4AF" />
              <path
                d="M45 93 Q52 100 59 93"
                fill="none"
                stroke="#1E1B4B"
                strokeWidth="3"
                strokeLinecap="round"
              />
              {/* Paintbrush held by artist */}
              <g transform="translate(80 54) rotate(28)" className="animate-sketch-wiggle">
                <rect
                  x="0"
                  y="14"
                  width="9"
                  height="38"
                  rx="4"
                  fill="#F59E0B"
                  stroke="#1E1B4B"
                  strokeWidth="2.8"
                />
                <rect x="0" y="10" width="9" height="8" fill="#E2E8F0" stroke="#1E1B4B" strokeWidth="2.5" />
                <path
                  d="M0 10 C0 -2, 9 -2, 9 10 Z"
                  fill="#4F46E5"
                  stroke="#1E1B4B"
                  strokeWidth="2.5"
                />
              </g>
            </g>

            {/* Right Cartoon Guesser Character (Sunny yellow buddy + speech bubble) */}
            <g transform="translate(414 134)" className="animate-sketch-float-delayed">
              {/* Speech Bubble */}
              <g transform="translate(-44 -56)">
                <rect
                  x="0"
                  y="0"
                  width="126"
                  height="34"
                  rx="14"
                  fill="#FFFFFF"
                  stroke="#1E1B4B"
                  strokeWidth="3"
                />
                <polygon
                  points="66,33 78,33 72,44"
                  fill="#FFFFFF"
                  stroke="#1E1B4B"
                  strokeWidth="3"
                  strokeLinejoin="round"
                />
                <rect x="64" y="30" width="16" height="5" fill="#FFFFFF" />
                <text
                  x="63"
                  y="21"
                  textAnchor="middle"
                  fill="#4F46E5"
                  fontSize="11.5"
                  fontWeight="900"
                >
                  A ROCKET!! 🚀
                </text>
              </g>

              {/* Yellow buddy body */}
              <ellipse
                cx="48"
                cy="86"
                rx="36"
                ry="32"
                fill="#FBBF24"
                stroke="#1E1B4B"
                strokeWidth="4"
              />
              {/* Excited sparkle eyes */}
              <circle cx="37" cy="76" r="4.5" fill="#1E1B4B" />
              <circle cx="59" cy="76" r="4.5" fill="#1E1B4B" />
              <circle cx="36" cy="74.5" r="1.5" fill="#FFFFFF" />
              <circle cx="58" cy="74.5" r="1.5" fill="#FFFFFF" />
              <ellipse cx="29" cy="84" rx="4.5" ry="2.5" fill="#FB7185" />
              <ellipse cx="67" cy="84" rx="4.5" ry="2.5" fill="#FB7185" />
              {/* Big cheerful smile */}
              <path
                d="M40 84 Q48 94 56 84 Z"
                fill="#FFFFFF"
                stroke="#1E1B4B"
                strokeWidth="2.8"
                strokeLinejoin="round"
              />
              {/* Waving hands */}
              <circle cx="10" cy="84" r="8" fill="#FDE68A" stroke="#1E1B4B" strokeWidth="3" />
              <circle cx="86" cy="74" r="8" fill="#FDE68A" stroke="#1E1B4B" strokeWidth="3" />
            </g>

            {/* Bottom floating doodle star */}
            <g className="animate-sketch-float" transform="translate(262 238)">
              <path
                d="M14 0 L17.5 9 L27 12 L17.5 15 L14 24 L10.5 15 L1 12 L10.5 9 Z"
                fill="#6366F1"
                stroke="#1E1B4B"
                strokeWidth="2.2"
                strokeLinejoin="round"
              />
            </g>
          </svg>
        </div>

        {/* Clean playful caption row */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-indigo-200/80 bg-white/85 px-3.5 py-2.5 text-xs">
          <span className="font-bold text-slate-800">
            Pick a word, draw clues live, and climb the scoreboard!
          </span>
          <span className="font-extrabold text-indigo-600">2–20 Players · Real-time</span>
        </div>
      </div>
    </Card>
  );
}
