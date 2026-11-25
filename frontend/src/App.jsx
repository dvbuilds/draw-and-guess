import { GameProvider } from './context/GameContext.jsx';
import { LanguageProvider } from './context/LanguageContext.jsx';
import { PlayerProvider } from './context/PlayerContext.jsx';
import { RoomProvider } from './context/RoomContext.jsx';
import { SocketProvider } from './context/SocketContext.jsx';
import { AppRouter } from './routes/AppRouter.jsx';

export default function App() {
  return (
    <LanguageProvider>
      <PlayerProvider>
        <SocketProvider>
          <RoomProvider>
            <GameProvider>
              <AppRouter />
            </GameProvider>
          </RoomProvider>
        </SocketProvider>
      </PlayerProvider>
    </LanguageProvider>
  );
}
