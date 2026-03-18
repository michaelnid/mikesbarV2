import { useState, useEffect, useRef } from 'react';
import { api, API_BASE_URL } from '../services/api';
import * as signalR from '@microsoft/signalr';
import logoWhite from '../assets/mikesbar-logo-white.png';
import { DEFAULT_AVATAR_URL } from '../constants/assets';

const REFRESH_INTERVAL = 5000;

export default function SignagePage() {
    const [users, setUsers] = useState([]);
    const [tables, setTables] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());
    const connectionRef = useRef(null);
    const intervalRef = useRef(null);

    const loadLeaderboard = async () => {
        try {
            const data = await api.getLeaderboard();
            setUsers(data);
        } catch (error) {
            console.error("Failed to load leaderboard", error);
        }
    };

    const loadTables = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/stats/active-tables-public`);
            if (response.ok) {
                const data = await response.json();
                setTables(data);
            } else {
                const token = localStorage.getItem('token');
                if (token) {
                    const data = await api.getActiveTables(token);
                    setTables(data);
                }
            }
        } catch (err) {
            console.error('Failed to load tables:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadLeaderboard();
        loadTables();

        const clockInterval = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);

        intervalRef.current = setInterval(() => {
            loadLeaderboard();
            loadTables();
        }, REFRESH_INTERVAL);

        const connectSignalR = async () => {
            try {
                // Safely build hub URL
                const baseUrl = new URL(API_BASE_URL);
                baseUrl.pathname = '/hubs/stats';
                console.log('SignalR Signage Hub URL:', baseUrl.toString());

                const connection = new signalR.HubConnectionBuilder()
                    .withUrl(baseUrl.toString())
                    .withAutomaticReconnect()
                    .build();

                connection.on('StatsUpdated', () => {
                    loadLeaderboard();
                    loadTables();
                });

                connection.on('TableUpdated', () => {
                    loadTables();
                });

                await connection.start();
                connectionRef.current = connection;
                console.log('SignalR connected for signage');
            } catch (err) {
                console.error('SignalR connection failed:', err);
            }
        };

        connectSignalR();

        return () => {
            clearInterval(clockInterval);
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (connectionRef.current) {
                connectionRef.current.stop();
            }
        };
    }, []);

    const formatTime = (date) => {
        return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    const formatDate = (date) => {
        return date.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    };

    const getMedalStyle = (index) => {
        switch (index) {
            case 0:
                return 'bg-gradient-to-br from-yellow-400 to-amber-500 text-black shadow-lg shadow-yellow-500/40';
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
                return 'bg-gradient-to-r from-yellow-500/15 via-yellow-500/5 to-transparent border-yellow-500/40';
            case 1:
                return 'bg-gradient-to-r from-gray-400/15 via-gray-400/5 to-transparent border-gray-400/40';
            case 2:
                return 'bg-gradient-to-r from-orange-600/15 via-orange-600/5 to-transparent border-orange-600/40';
            default:
                return 'bg-neutral-900/50 border-white/5 hover:border-white/10';
        }
    };

    return (
        <div className="min-h-screen bg-neutral-950 text-white overflow-hidden relative">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-grid opacity-20" />
            <div className="absolute top-0 left-1/4 w-[800px] h-[600px] bg-gradient-radial from-yellow-500/10 via-transparent to-transparent rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-gradient-radial from-emerald-500/10 via-transparent to-transparent rounded-full blur-3xl pointer-events-none" />

            {/* Header */}
            <header className="relative z-20 glass border-b border-white/10">
                <div className="flex justify-between items-center px-8 py-5">
                    <div className="flex items-center gap-5">
                        <div className="w-16 h-16 animate-float">
                            <img
                                src={logoWhite}
                                alt="Mike's Bar Logo"
                                className="w-full h-full object-contain drop-shadow-[0_0_20px_rgba(234,179,8,0.4)]"
                            />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-500 bg-clip-text text-transparent">
                                mikesBAR
                            </h1>
                            <p className="text-yellow-500/60 text-sm tracking-widest uppercase">PARTYPOKER</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-5xl font-mono font-black text-white tracking-tight">
                            {formatTime(currentTime)}
                        </div>
                        <div className="text-neutral-400 text-sm mt-1">{formatDate(currentTime)}</div>
                    </div>
                </div>
            </header>

            {/* Main Content - Split Layout */}
            <div className="flex h-[calc(100vh-120px)] relative z-10">

                {/* Left Side - Money Leaderboard */}
                <div className="w-1/2 p-6 border-r border-white/10 overflow-hidden flex flex-col">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 flex items-center justify-center">
                            <span className="text-2xl">🏆</span>
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white">Money Leaderboard</h2>
                            <p className="text-neutral-500 text-sm">Top Spieler nach Guthaben</p>
                        </div>
                        <div className="ml-auto flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full">
                            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.6)]"></div>
                            <span className="text-emerald-400 text-sm font-bold">LIVE</span>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                        {users.map((user, index) => (
                            <div
                                key={user.id}
                                className={`flex items-center gap-4 p-4 rounded-2xl border transition-all duration-500 ${getRowStyle(index)}`}
                                style={{ animationDelay: `${index * 100}ms` }}
                            >
                                {/* Rank */}
                                <div className={`w-14 h-14 flex items-center justify-center font-bold text-xl rounded-xl ${getMedalStyle(index)}`}>
                                    {index < 3 ? (
                                        <span className="text-2xl">{index === 0 ? '👑' : index === 1 ? '🥈' : '🥉'}</span>
                                    ) : (
                                        index + 1
                                    )}
                                </div>

                                {/* Avatar */}
                                <div className={`w-16 h-16 rounded-full overflow-hidden border-3 ${index === 0 ? 'border-yellow-500 shadow-lg shadow-yellow-500/30' :
                                    index === 1 ? 'border-gray-400' :
                                        index === 2 ? 'border-orange-600' :
                                            'border-neutral-700'
                                    }`}>
                                    <img
                                        src={user.avatarUrl?.startsWith('http') ? user.avatarUrl : user.avatarUrl ? `${API_BASE_URL.replace('/api', '')}${user.avatarUrl}` : DEFAULT_AVATAR_URL}
                                        alt=""
                                        className="w-full h-full object-cover"
                                        onError={(e) => e.target.src = DEFAULT_AVATAR_URL}
                                    />
                                </div>

                                {/* Name */}
                                <div className="flex-1">
                                    <div className={`text-xl font-bold ${index === 0 ? 'text-yellow-400' :
                                        index === 1 ? 'text-gray-300' :
                                            index === 2 ? 'text-orange-400' :
                                                'text-white'
                                        }`}>
                                        {user.username}
                                    </div>
                                </div>

                                {/* Balance */}
                                <div className={`font-mono text-2xl font-black ${index === 0 ? 'text-yellow-400' : 'text-yellow-500'
                                    }`}>
                                    {user.balance?.toFixed(2) || '0.00'} €
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right Side - Active Tables */}
                <div className="w-1/2 p-6 overflow-hidden flex flex-col">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 flex items-center justify-center">
                            <span className="text-2xl">🎲</span>
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white">Aktive Tische</h2>
                            <p className="text-neutral-500 text-sm">Laufende Spiele</p>
                        </div>
                        <div className="ml-auto flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full">
                            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.6)]"></div>
                            <span className="text-emerald-400 text-sm font-bold">LIVE</span>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2">
                        {loading ? (
                            <div className="space-y-4">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="h-44 glass-card rounded-2xl animate-pulse"></div>
                                ))}
                            </div>
                        ) : tables.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full opacity-40">
                                <div className="w-20 h-20 flex items-center justify-center mb-4">
                                    <span className="text-4xl">🎰</span>
                                </div>
                                <p className="text-neutral-400 text-lg font-medium">Keine aktiven Tische</p>
                                <p className="text-neutral-600 text-sm mt-1">Warte auf Dealer...</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {tables.map(table => (
                                    <div
                                        key={table.dealerId}
                                        className="glass-card rounded-2xl p-6 relative overflow-hidden"
                                    >
                                        {/* Glow Effect */}
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-radial from-emerald-500/10 to-transparent rounded-full blur-2xl pointer-events-none" />

                                        {/* Table Header */}
                                        <div className="flex justify-between items-start mb-5 relative">
                                            <div className="flex items-center gap-4">
                                                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 flex items-center justify-center">
                                                    <span className="text-2xl">🎴</span>
                                                </div>
                                                <div>
                                                    <p className="text-xl font-bold text-white">{table.dealerName}</p>
                                                    <p className="text-yellow-500 font-semibold">{table.currentGame}</p>
                                                </div>
                                            </div>
                                            <span className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-bold rounded-full flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                                                LIVE
                                            </span>
                                        </div>

                                        {/* Players */}
                                        {table.players && table.players.length > 0 ? (
                                            <div className="border-t border-white/10 pt-5">
                                                <p className="text-neutral-400 text-sm mb-4 flex items-center gap-2">
                                                    <span>👥</span>
                                                    Spieler am Tisch ({table.players.length})
                                                </p>
                                                <div className="flex flex-wrap gap-3">
                                                    {table.players.map(p => (
                                                        <div
                                                            key={p.id}
                                                            className="flex items-center gap-3 px-4 py-2 bg-neutral-800/50 rounded-full border border-white/10 hover:border-white/20 transition-colors"
                                                        >
                                                            <div className="w-10 h-10 rounded-full overflow-hidden bg-neutral-700 border-2 border-yellow-500/30">
                                                                <img
                                                                    src={p.avatarUrl || DEFAULT_AVATAR_URL}
                                                                    alt={p.username}
                                                                    className="w-full h-full object-cover"
                                                                    onError={(e) => e.target.src = DEFAULT_AVATAR_URL}
                                                                />
                                                            </div>
                                                            <span className="text-white font-medium">{p.username}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="border-t border-white/10 pt-5">
                                                <p className="text-neutral-500 text-sm flex items-center gap-2">
                                                    <span className="animate-pulse">⏳</span>
                                                    Warte auf Spieler...
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Footer */}
            <footer className="fixed bottom-0 left-0 right-0 h-14 glass border-t border-white/10 flex items-center justify-center z-20">
                <p className="text-neutral-500 text-sm flex items-center gap-3">
                    <span className="text-yellow-500">mikesBAR</span>
                    <span className="text-neutral-700">•</span>
                    <span>Digital Signage Display</span>
                    <span className="text-neutral-700">•</span>
                    <span className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        Verbunden
                    </span>
                </p>
            </footer>
        </div>
    );
}
