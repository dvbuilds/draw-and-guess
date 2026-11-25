import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { MainLayout } from '../components/layout/MainLayout.jsx';
import { CreateRoomPage } from '../pages/CreateRoomPage.jsx';
import { GamePage } from '../pages/GamePage.jsx';
import { HomePage } from '../pages/HomePage.jsx';
import { JoinRoomPage } from '../pages/JoinRoomPage.jsx';
import { LobbyPage } from '../pages/LobbyPage.jsx';
import { NotFoundPage } from '../pages/NotFoundPage.jsx';
import { ResultsPage } from '../pages/ResultsPage.jsx';

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/create" element={<CreateRoomPage />} />
          <Route path="/join" element={<JoinRoomPage />} />
          <Route path="/lobby/:roomCode" element={<LobbyPage />} />
          <Route path="/game/:roomCode" element={<GamePage />} />
          <Route path="/results/:roomCode" element={<ResultsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
