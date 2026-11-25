import { GameProvider } from './context/GameContext.jsx';
import { PlayerProvider } from './context/PlayerContext.jsx';
import { RoomProvider } from './context/RoomContext.jsx';
import { SocketProvider } from './context/SocketContext.jsx';
import { AppRouter } from './routes/AppRouter.jsx';

export default function App() {
  return (
    <PlayerProvider>
      <SocketProvider>
        <RoomProvider>
          <GameProvider>
            <AppRouter />
          </GameProvider>
        </RoomProvider>
      </SocketProvider>
    </PlayerProvider>
  );
}
