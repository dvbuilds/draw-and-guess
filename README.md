# Draw & Guess

A multiplayer drawing and guessing game inspired by skribbl.io. Players join a room, one person draws a word, everyone else tries to guess it, and the player with the most points at the end wins.

**Live demo:** https://draw-and-guess-chi.vercel.app/

> The backend is on a free tier, so the first request can take 30–60 seconds while the server wakes up. If the page seems stuck at first, give it a minute.

## What it does

- Create a public or private room (private rooms are joined with an invite link)
- Join with a room code or a link
- Lobby with the player list, host starts the game
- Turn-based rounds, one drawer at a time, everyone gets a turn
- Drawer picks from a few random words, others see blanks
- Real-time drawing over WebSockets (pen, colors, brush sizes, eraser, undo, clear)
- Guess in the chat, first correct guesses score points
- Hints that reveal letters as the timer runs down
- Countdown timer, round results, final leaderboard and winner
- Host can kick or ban players, and players can start a vote kick
- Word lists in English, Spanish and French, with categories

### Room settings

| Setting | Range |
| --- | --- |
| Max players | 2 – 20 |
| Rounds | 2 – 10 |
| Draw time | 15 – 240 seconds |
| Words to choose from | 1 – 5 |
| Hints | 0 – 5 (or off) |
| Word mode | Normal, Hidden, Combination |
| Language | English, Spanish, French |

Hidden mode doesn't tell the guessers the category, and Combination mode only uses words made of two parts (like "ice cream" or "snowman").

## Tech stack

- **Frontend:** React 19, Vite, Tailwind CSS, React Router
- **Canvas:** plain HTML5 Canvas with my own drawing logic
- **Backend:** Node.js, Express
- **Realtime:** Socket.IO
- **Database:** MongoDB with Mongoose (rooms, players, word list)

## Running it locally

You need Node.js 20 or newer and a MongoDB database (local or a free Atlas cluster).

```bash
git clone <this-repo-url>
cd draw-and-guess-main
```

### Backend

```bash
cd backend
npm install
```

Create a `.env` file in `backend/`:

```env
MONGO_URI=mongodb://localhost:27017/draw-and-guess
CLIENT_URL=http://localhost:5173
NODE_ENV=development
PORT=5000
```

| Variable | What it's for |
| --- | --- |
| `MONGO_URI` | MongoDB connection string (required, the server won't start without it) |
| `CLIENT_URL` | Frontend URL, used for CORS and for building invite links. Defaults to `http://localhost:5173` |
| `NODE_ENV` | `development` or `production` |
| `PORT` | Port the server runs on. Defaults to `5000` |

Then start it:

```bash
npm run dev
```

The word list is seeded automatically when the server starts. You can also run `npm run seed:words` by hand if you want.

### Frontend

```bash
cd frontend
npm install
```

The frontend works without any config if the backend is on port 5000. If yours is somewhere else, create `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

Then:

```bash
npm run dev
```

Open http://localhost:5173. To test properly, open the game in two or three different tabs (or an incognito window) and join the same room as different players.

### Tests

```bash
cd backend && npm test
cd frontend && npm test
```

## How it works

There's a REST API for the things that don't need to be live (creating a room, joining, guest player identity, word lists, health check), and Socket.IO for everything that happens during the game.

**Drawing.** The drawer's canvas records pointer movement and sends it in small batches of points (a "segment") with the color, width and tool. The server checks that the sender is really the current drawer and that the data looks valid, keeps the strokes in memory for that room, and broadcasts them to everyone else. Other clients redraw each segment on their own canvas. Coordinates are stored relative to the canvas size so different screen sizes line up. Anyone who joins or reconnects mid-round asks for a sync and gets all the strokes so far. Undo and clear work the same way, the server updates its copy and tells everybody.

**Game state.** The room document in MongoDB is the source of truth: current round, turn order, current drawer, current word, who has guessed, scores. The server decides everything, clients only send requests and react to events. Turn timers and hint timers run on the server, so players can't mess with them.

**Guessing.** A guess is cleaned up (trimmed, lowercased, extra symbols removed, unicode normalized) and then compared to the cleaned-up word. It has to match exactly, partial matches don't count. A correct guess gives the guesser 100 points and the drawer 50 points. Both numbers are defaults stored in the room settings. A round ends when the time runs out or when everyone has guessed it. The drawer can't guess, and nobody can score twice in one round.

**Hints.** If hints are on, they're spread evenly over the draw time. With 3 hints and 80 seconds, letters get revealed at 20s, 40s and 60s. At least one letter always stays hidden.

### Socket events

These are the main ones (the names are a bit different from the assignment's suggested list).

| Client to server | What it does |
| --- | --- |
| `lobby:join` / `lobby:leave` | Enter or leave a room's lobby |
| `game:start` | Host starts the game |
| `word:select` | Drawer picks a word |
| `drawing:stroke` | Drawer sends a stroke segment |
| `drawing:undo` / `drawing:clear` | Undo the last stroke or clear the canvas |
| `drawing:sync` | Ask for the current drawing (joining late, reconnecting) |
| `guess:submit` | Send a guess |
| `chat:send` | Send a chat message |
| `moderation:kick` / `moderation:ban` | Host moderation |
| `vote_kick:start` / `vote_kick:cast` | Vote kick |

| Server to clients | What it does |
| --- | --- |
| `player_joined`, `player_left`, `room:members_updated` | Player list changes |
| `game_start`, `game_turn`, `round_started` | Game and turn changes |
| `word_options`, `word_assigned`, `word_selected` | Word choices for the drawer, and the blanks for everyone else |
| `turn_timer_started`, `turn_timer_expired` | Timer |
| `word_hint` | A new hint pattern like `_ a _ _ o _` |
| `drawing:stroke`, `drawing:undone`, `drawing:cleared` | Drawing updates |
| `guess_feedback`, `scoreboard_updated` | Guess results and live scores |
| `chat:message`, `room:announcement` | Chat and announcements |
| `round_complete`, `game_complete`, `leaderboard_final` | Round and game results |

## Project structure

```
backend/
  src/
    config/        env and database setup
    controllers/   REST controllers
    routes/        REST routes
    models/        Room, Player, Word (Mongoose)
    services/      game logic (lobby, timer, scoring, hints, drawing, guesses, moderation...)
    sockets/       Socket.IO event wiring
    data/          seed word lists
  tests/
frontend/
  src/
    pages/         home, create, join, lobby, game, results
    components/    canvas, toolbar, chat, scoreboard, room and lobby UI
    context/       player, room, socket and game state
    hooks/
    services/      API and socket clients
    utils/         drawing engine, validation, translations
```

## Deployment

- **Frontend** is deployed on Vercel. `vercel.json` rewrites every route to `index.html` so links like `/lobby/ABCD1234` work on refresh.
- **Backend** is deployed on Render as a normal Node web service (`npm install` to build, `npm start` to run). Vercel can't host the backend because it needs a long-running server for WebSockets.
- **Database** is MongoDB Atlas.

Environment variables in production:

- Backend: `MONGO_URI`, `CLIENT_URL` (the deployed frontend URL, no trailing slash), `NODE_ENV=production`. Render sets `PORT` itself.
- Frontend: `VITE_API_BASE_URL` (deployed backend URL + `/api`) and `VITE_SOCKET_URL` (deployed backend URL).

If the game loads but players can't connect, the first thing to check is that `CLIENT_URL` on the backend matches the frontend URL exactly.

## Things I didn't build

Ready-up in the lobby, spectator mode, custom word lists, round replay and player reports. Avatars are generated from the player's name rather than chosen.
