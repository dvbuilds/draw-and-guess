import { PlayerProvider } from './context/PlayerContext.jsx';
import { SocketProvider } from './context/SocketContext.jsx';
import { AppRouter } from './routes/AppRouter.jsx';

export default function App() {
  return (
    <PlayerProvider>
      <SocketProvider>
        <AppRouter />
      </SocketProvider>
    </PlayerProvider>
  );
}
