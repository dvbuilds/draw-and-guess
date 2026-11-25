import { SocketProvider } from './context/SocketContext.jsx';
import { AppRouter } from './routes/AppRouter.jsx';

export default function App() {
  return (
    <SocketProvider>
      <AppRouter />
    </SocketProvider>
  );
}
