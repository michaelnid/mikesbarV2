import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, API_BASE_URL } from '../services/api';
import * as signalR from '@microsoft/signalr';
import { DEFAULT_AVATAR_URL } from '../constants/assets';

export default function LeaderboardPage() {
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();
    const connectionRef = useRef(null);

    useEffect(() => {
        loadLeaderboard();

        // Auto-refresh alle 5 Sekunden
        const interval = setInterval(() => {
            loadLeaderboard(false); // silent refresh ohne Loading-Spinner
        }, 5000);

        // SignalR-Verbindung für Live-Updates
        const baseUrl = new URL(API_BASE_URL);
        baseUrl.pathname = '/hubs/stats';
        const hubUrl = baseUrl.toString();

        const connection = new signalR.HubConnectionBuilder()
            .withUrl(hubUrl)
            .withAutomaticReconnect()
            .build();

        connection.on('StatsUpdated', () => {
            loadLeaderboard(false);
        });

        connection.start()
            .then(() => connection.invoke('JoinStatsChannel'))
            .catch(err => console.error('SignalR Error:', err));

        connectionRef.current = connection;

        return () => {
            clearInterval(interval);
            if (connectionRef.current) {
                connectionRef.current.stop();
            }
        };
    }, []);

    const loadLeaderboard = async (showLoading = true) => {
        try {
            if (showLoading) setIsLoading(true);
            const data = await api.getLeaderboard();
            setUsers(data);
        } catch (error) {
            console.error("Failed to load leaderboard", error);
        } finally {
            if (showLoading) setIsLoading(false);
        }
    };

    const getMedalStyle = (index) => {
        switch (index) {
            case 0:
                return 'bg-gradient-to-br from-yellow-400 to-amber-500 text-black shadow-lg shadow-yellow-500/30';
            case 1:
                return 'bg-gradient-to-br from-gray-300 to-gray-400 text-black shadow-lg shadow-gray-400/30';
            case 2:
                return 'bg-gradient-to-br from-orange-600 to-orange-700 text-white shadow-lg shadow-orange-600/30';
            default:
                return 'bg-neutral-800 text-neutral-400';
        }
    };

    const getRowStyle = (index) => {
        switch (index) {
            case 0:
                return 'border-yellow-500/30 bg-gradient-to-r from-yellow-500/10 to-transparent';
            case 1:
                return 'border-gray-400/30 bg-gradient-to-r from-gray-400/10 to-transparent';
            case 2:
                return 'border-orange-600/30 bg-gradient-to-r from-orange-600/10 to-transparent';
            default:
                return 'border-white/5 hover:border-white/10';
        }
    };

    return (
        <div className="flex-1 flex flex-col min-h-screen bg-neutral-950 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-grid opacity-30" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-gradient-radial from-amber-500/10 via-transparent to-transparent rounded-full blur-3xl pointer-events-none" />

            {/* Header */}
            <header className="relative z-20 glass border-b border-white/5">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 rounded-xl hover:bg-white/10 transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-neutral-400">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                        </svg>
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 flex items-center justify-center">
                            <span className="text-xl">🏆</span>
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-white">Leaderboard</h1>
                            <p className="text-xs text-neutral-500">Top Spieler nach Guthaben</p>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto relative z-10 pb-8">
                <div className="max-w-4xl mx-auto px-4 py-6">

                    {/* Top 3 Podium (Desktop) */}
                    {users.length >= 3 && (
                        <div className="hidden sm:grid grid-cols-3 gap-4 mb-8">
                            {/* 2nd Place */}
                            <div className="glass-card rounded-2xl p-6 text-center mt-8 animate-fade-in-up opacity-0 delay-100" style={{ animationFillMode: 'forwards' }}>
                                <div className="w-16 h-16 mx-auto rounded-full overflow-hidden border-3 border-gray-400 mb-3 shadow-lg shadow-gray-400/20">
                                    <img
                                        src={users[1]?.avatarUrl?.startsWith('http') ? users[1].avatarUrl : users[1]?.avatarUrl ? `${API_BASE_URL.replace('/api', '')}${users[1]?.avatarUrl}` : DEFAULT_AVATAR_URL}
                                        alt=""
                                        className="w-full h-full object-cover"
                                        onError={(e) => e.target.src = DEFAULT_AVATAR_URL}
                                    />
                                </div>
                                <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 text-black font-bold text-sm mb-2">2</div>
                                <h3 className="font-bold text-white truncate">{users[1]?.username}</h3>
                                <p className="text-lg font-mono font-bold text-gray-300">{users[1]?.balance.toFixed(2)} €</p>
                            </div>

                            {/* 1st Place */}
                            <div className="glass-card rounded-2xl p-6 text-center border-yellow-500/30 bg-gradient-to-b from-yellow-500/10 to-transparent animate-fade-in-down">
                                <div className="w-20 h-20 mx-auto rounded-full overflow-hidden border-3 border-yellow-500 mb-3 shadow-lg shadow-yellow-500/30">
                                    <img
                                        src={users[0]?.avatarUrl?.startsWith('http') ? users[0].avatarUrl : users[0]?.avatarUrl ? `${API_BASE_URL.replace('/api', '')}${users[0]?.avatarUrl}` : DEFAULT_AVATAR_URL}
                                        alt=""
                                        className="w-full h-full object-cover"
                                        onError={(e) => e.target.src = DEFAULT_AVATAR_URL}
                                    />
                                </div>
                                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 text-black font-bold mb-2">
                                    <span className="text-lg">👑</span>
                                </div>
                                <h3 className="font-bold text-xl text-yellow-400 truncate">{users[0]?.username}</h3>
                                <p className="text-2xl font-mono font-bold text-yellow-500">{users[0]?.balance.toFixed(2)} €</p>
                            </div>

                            {/* 3rd Place */}
                            <div className="glass-card rounded-2xl p-6 text-center mt-12 animate-fade-in-up opacity-0 delay-200" style={{ animationFillMode: 'forwards' }}>
                                <div className="w-14 h-14 mx-auto rounded-full overflow-hidden border-3 border-orange-600 mb-3 shadow-lg shadow-orange-600/20">
                                    <img
                                        src={users[2]?.avatarUrl?.startsWith('http') ? users[2].avatarUrl : users[2]?.avatarUrl ? `${API_BASE_URL.replace('/api', '')}${users[2]?.avatarUrl}` : DEFAULT_AVATAR_URL}
                                        alt=""
                                        className="w-full h-full object-cover"
                                        onError={(e) => e.target.src = DEFAULT_AVATAR_URL}
                                    />
                                </div>
                                <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-orange-600 to-orange-700 text-white font-bold text-sm mb-2">3</div>
                                <h3 className="font-bold text-white truncate">{users[2]?.username}</h3>
                                <p className="text-lg font-mono font-bold text-orange-400">{users[2]?.balance.toFixed(2)} €</p>
                            </div>
                        </div>
                    )}

                    {/* Loading State */}
                    {isLoading && (
                        <div className="space-y-3">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="glass-card rounded-xl p-4 animate-pulse">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-lg bg-neutral-700" />
                                        <div className="w-12 h-12 rounded-full bg-neutral-700" />
                                        <div className="flex-1 h-4 bg-neutral-700 rounded" />
                                        <div className="w-24 h-6 bg-neutral-700 rounded" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Leaderboard List */}
                    {!isLoading && (
                        <div className="space-y-2">
                            {users.map((user, index) => (
                                <div
                                    key={user.id}
                                    onClick={() => navigate(`/player/${user.id}`)}
                                    className={`glass-card rounded-xl p-4 cursor-pointer transition-all active:scale-[0.99] border ${getRowStyle(index)} animate-fade-in-up opacity-0`}
                                    style={{ animationFillMode: 'forwards', animationDelay: `${Math.min(index * 50, 500)}ms` }}
                                >
                                    <div className="flex items-center gap-4">
                                        {/* Rank */}
                                        <div className={`w-10 h-10 flex items-center justify-center font-bold rounded-xl ${getMedalStyle(index)}`}>
                                            {index < 3 ? (
                                                <span className="text-lg">{index === 0 ? '👑' : index === 1 ? '🥈' : '🥉'}</span>
                                            ) : (
                                                index + 1
                                            )}
                                        </div>

                                        {/* Avatar */}
                                        <div className={`w-12 h-12 rounded-full overflow-hidden border-2 ${index === 0 ? 'border-yellow-500' : index === 1 ? 'border-gray-400' : index === 2 ? 'border-orange-600' : 'border-neutral-700'}`}>
                                            <img
                                                src={user.avatarUrl?.startsWith('http') ? user.avatarUrl : user.avatarUrl ? `${API_BASE_URL.replace('/api', '')}${user.avatarUrl}` : DEFAULT_AVATAR_URL}
                                                alt=""
                                                className="w-full h-full object-cover"
                                                onError={(e) => e.target.src = DEFAULT_AVATAR_URL}
                                            />
                                        </div>

                                        {/* Username */}
                                        <div className="flex-1 min-w-0">
                                            <div className={`font-bold truncate ${index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-300' : index === 2 ? 'text-orange-400' : 'text-white'}`}>
                                                {user.username}
                                            </div>
                                        </div>

                                        {/* Balance */}
                                        <div className={`font-mono font-bold text-lg ${index === 0 ? 'text-yellow-500' : index === 1 ? 'text-gray-300' : index === 2 ? 'text-orange-400' : 'text-neutral-300'}`}>
                                            {user.balance.toFixed(2)} €
                                        </div>

                                        {/* Arrow */}
                                        <div className="text-neutral-600">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Empty State */}
                    {!isLoading && users.length === 0 && (
                        <div className="text-center py-12">
                            <div className="text-6xl mb-4">🏆</div>
                            <h3 className="text-xl font-bold text-neutral-400">Noch keine Spieler</h3>
                            <p className="text-neutral-500">Sei der Erste im Leaderboard!</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
