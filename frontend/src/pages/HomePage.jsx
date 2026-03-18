import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, API_BASE_URL } from '../services/api';
import logoWhite from '../assets/mikesbar-logo-white.png';
import { DEFAULT_AVATAR_URL } from '../constants/assets';
import { hasPermission } from '../utils/permissions';

export default function HomePage() {
    const navigate = useNavigate();
    const storedUser = JSON.parse(localStorage.getItem('user') || 'null');
    const token = localStorage.getItem('token');
    const [user, setUser] = useState(storedUser);
    const [status, setStatus] = useState({ server: 'Checking...', database: 'Checking...' });

    useEffect(() => {
        api.getHealth().then(setStatus);
        const healthInterval = setInterval(() => api.getHealth().then(setStatus), 15000);

        if (token && storedUser) {
            api.getMe(token).then(data => {
                setUser(data);
                localStorage.setItem('user', JSON.stringify(data));
            }).catch(() => { });
        }

        return () => clearInterval(healthInterval);
    }, []);

    return (
        <div className="flex-1 flex flex-col min-h-screen bg-neutral-950 relative overflow-hidden">
            <div className="absolute inset-0 bg-grid opacity-50" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-radial from-yellow-500/10 via-transparent to-transparent rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-gradient-radial from-blue-500/5 via-transparent to-transparent rounded-full blur-3xl pointer-events-none" />

            <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 sm:px-6 lg:px-8 relative z-10">
                <div className="text-center mb-10">
                    <div className="relative inline-block mb-6">
                        <div className="w-32 h-32 sm:w-40 sm:h-40 lg:w-48 lg:h-48 mx-auto">
                            <img
                                src={logoWhite}
                                alt="Mike's Bar Logo"
                                className="w-full h-full object-contain drop-shadow-[0_0_30px_rgba(234,179,8,0.3)] rounded-full"
                            />
                        </div>
                        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-yellow-500/20 to-transparent blur-2xl scale-150 -z-10" />
                    </div>

                    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight mb-2">
                        <span className="bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-500 bg-clip-text text-transparent">
                            mikesBAR
                        </span>
                    </h1>
                    <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-yellow-500/80 tracking-[0.3em] uppercase">
                        CORE FRAMEWORK
                    </h2>
                    <p className="mt-6 max-w-2xl text-sm sm:text-base text-neutral-300">
                        Die alten Casino-Spiele wurden aus diesem Repository entfernt. Es bleibt der Kern für Benutzer,
                        Dealer, Sessions, Guthaben, Statistiken und die pluginbasierte Einbindung neuer Live-Games.
                    </p>
                </div>

                <div className={`w-full max-w-4xl flex flex-wrap gap-4 ${!user ? 'justify-center' : ''}`}>
                    <button
                        onClick={() => navigate(user ? '/dashboard' : '/login')}
                        className={`glass-card rounded-2xl p-6 sm:p-8 cursor-pointer text-left active:scale-95 transition-transform w-full ${user ? 'sm:w-[calc(50%-0.5rem)]' : 'sm:w-auto sm:min-w-[360px]'}`}
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 flex items-center justify-center shrink-0">
                                {user ? (
                                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden border-2 border-yellow-500/50">
                                        <img
                                            src={user.avatarUrl?.startsWith('http') ? user.avatarUrl : user.avatarUrl ? `${API_BASE_URL.replace('/api', '')}${user.avatarUrl}` : DEFAULT_AVATAR_URL}
                                            alt="Avatar"
                                            className="w-full h-full object-cover"
                                            onError={(e) => e.target.src = DEFAULT_AVATAR_URL}
                                        />
                                    </div>
                                ) : (
                                    <span className="text-3xl">👤</span>
                                )}
                            </div>
                            <div>
                                <h3 className="text-lg sm:text-xl font-bold text-white">{user ? user.username : 'Spieler Login'}</h3>
                                <p className="text-sm text-neutral-400">{user ? 'Zum Dashboard' : 'Anmelden'}</p>
                            </div>
                        </div>
                    </button>

                    {user && (
                        <button
                            onClick={() => navigate('/leaderboard')}
                            className="glass-card rounded-2xl p-6 sm:p-8 cursor-pointer text-left active:scale-95 transition-transform w-full sm:w-[calc(50%-0.5rem)]"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-600/10 flex items-center justify-center shrink-0">
                                    <span className="text-3xl">🏆</span>
                                </div>
                                <div>
                                    <h3 className="text-lg sm:text-xl font-bold text-white">Leaderboard</h3>
                                    <p className="text-sm text-neutral-400">Top Spieler und Rankings</p>
                                </div>
                            </div>
                        </button>
                    )}

                    {user && hasPermission(user, 'DEALER') && (
                        <button
                            onClick={() => navigate('/dealer')}
                            className="glass-card rounded-2xl p-6 sm:p-8 cursor-pointer text-left active:scale-95 transition-transform w-full sm:w-[calc(50%-0.5rem)]"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-700/10 flex items-center justify-center shrink-0">
                                    <span className="text-3xl">🃏</span>
                                </div>
                                <div>
                                    <h3 className="text-lg sm:text-xl font-bold text-white">Dealer Core</h3>
                                    <p className="text-sm text-neutral-400">Tische, Spieler-Sessions und Plugin-Auswahl</p>
                                </div>
                            </div>
                        </button>
                    )}

                    {user && hasPermission(user, 'ADMIN') && (
                        <button
                            onClick={() => navigate('/admin/dashboard')}
                            className="glass-card rounded-2xl p-6 sm:p-8 cursor-pointer text-left active:scale-95 transition-transform w-full sm:w-[calc(50%-0.5rem)]"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-700/10 flex items-center justify-center shrink-0">
                                    <span className="text-3xl">🛠️</span>
                                </div>
                                <div>
                                    <h3 className="text-lg sm:text-xl font-bold text-white">Admin</h3>
                                    <p className="text-sm text-neutral-400">Benutzer, Rechte, Plugin-Freigaben und Übersicht</p>
                                </div>
                            </div>
                        </button>
                    )}

                    {user && (
                        <button
                            onClick={() => navigate('/fotobox')}
                            className="glass-card rounded-2xl p-6 sm:p-8 cursor-pointer text-left active:scale-95 transition-transform w-full sm:w-[calc(50%-0.5rem)]"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-600/10 flex items-center justify-center shrink-0">
                                    <span className="text-3xl">📸</span>
                                </div>
                                <div>
                                    <h3 className="text-lg sm:text-xl font-bold text-white">Fotobox</h3>
                                    <p className="text-sm text-neutral-400">Zusatzmodul außerhalb des Spielkerns</p>
                                </div>
                            </div>
                        </button>
                    )}
                </div>

                <div className="mt-10 rounded-2xl border border-white/10 bg-black/20 px-6 py-4 text-xs uppercase tracking-[0.25em] text-neutral-400">
                    API {status.server} · DB {status.database}
                </div>
            </div>
        </div>
    );
}
