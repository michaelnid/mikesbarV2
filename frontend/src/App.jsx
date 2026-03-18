import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import PlayerDashboard from './pages/PlayerDashboard';
import LeaderboardPage from './pages/LeaderboardPage';
import PlayerProfilePage from './pages/PlayerProfilePage';
import DealerLoginPage from './pages/DealerLoginPage';
import GameSelectionPage from './pages/GameSelectionPage';
import TablePlayersPage from './pages/TablePlayersPage';
import DealerBankPage from './pages/DealerBankPage';
import AdminDashboard from './pages/AdminDashboard';
import AdminLoginPage from './pages/AdminLoginPage';
import ManagementPage from './pages/ManagementPage';
import SignagePage from './pages/SignagePage';
import FotoboxPage from './pages/FotoboxPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Signage Display - Fullscreen, ohne MainLayout */}
        <Route path="signage" element={<SignagePage />} />

        <Route path="/" element={<MainLayout />}>
          <Route index element={<HomePage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="dashboard" element={<PlayerDashboard />} />
          <Route path="leaderboard" element={<LeaderboardPage />} />
          <Route path="player/:userId" element={<PlayerProfilePage />} />
          <Route path="dealer" element={<DealerLoginPage />} />
          <Route path="dealer/games" element={<GameSelectionPage />} />
          <Route path="dealer/select-game" element={<GameSelectionPage />} />
          <Route path="dealer/players" element={<TablePlayersPage />} />
          <Route path="dealer/bank" element={<DealerBankPage />} />
          <Route path="verwaltung" element={<ManagementPage />} />
          <Route path="fotobox" element={<FotoboxPage />} />
          <Route path="admin" element={<AdminLoginPage />} />
          <Route path="admin/dashboard" element={<AdminDashboard />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
