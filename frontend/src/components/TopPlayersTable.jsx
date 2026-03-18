import { useState, useEffect, useRef } from 'react';
import { api, API_BASE_URL } from '../services/api';
import { DEFAULT_AVATAR_URL } from '../constants/assets';

const REFRESH_INTERVAL = 5000; // 5 Sekunden für Live-Updates

export default function TopPlayersTable({ token, onRefresh }) {
    const [winners, setWinners] = useState([]);
    const [losers, setLosers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showType, setShowType] = useState('winners');
    const intervalRef = useRef(null);

    useEffect(() => {
        loadData();
    }, [onRefresh]);

    // Automatisches Polling für Live-Updates
    useEffect(() => {
        intervalRef.current = setInterval(loadData, REFRESH_INTERVAL);
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [token]);

    const loadData = async () => {
        try {
            const [w, l] = await Promise.all([
                api.getTopPlayers(token, 'winners'),
                api.getTopPlayers(token, 'losers')
            ]);
            setWinners(w);
            setLosers(l);
        } catch (err) {
            console.error('Failed to load top players:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="h-48 bg-neutral-800 rounded-xl animate-pulse"></div>;
    }

    const players = showType === 'winners' ? winners : losers;

    return (
        <div className="p-4 bg-neutral-800 rounded-xl border border-neutral-700">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-white">🏆 Top Spieler heute</h3>
                <div className="flex gap-1">
                    <button
                        onClick={() => setShowType('winners')}
                        className={`px-3 py-1 rounded text-sm font-medium ${showType === 'winners' ? 'bg-emerald-600 text-white' : 'bg-neutral-700 text-neutral-400'}`}
                    >
                        Gewinner
                    </button>
                    <button
                        onClick={() => setShowType('losers')}
                        className={`px-3 py-1 rounded text-sm font-medium ${showType === 'losers' ? 'bg-red-600 text-white' : 'bg-neutral-700 text-neutral-400'}`}
                    >
                        Verlierer
                    </button>
                </div>
            </div>

            {players.length === 0 ? (
                <p className="text-neutral-500 text-center py-4">Keine Daten für heute</p>
            ) : (
                <div className="space-y-2">
                    {players.map((p, i) => (
                        <div key={p.id} className="flex items-center justify-between py-2 border-b border-neutral-700 last:border-0">
                            <div className="flex items-center gap-3">
                                <span className={`w-6 text-lg font-bold ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-neutral-400' : i === 2 ? 'text-amber-700' : 'text-neutral-600'}`}>
                                    {i + 1}.
                                </span>
                                <div className="w-8 h-8 rounded-full overflow-hidden bg-neutral-700">
                                    <img
                                        src={p.avatarUrl?.startsWith('http') ? p.avatarUrl : p.avatarUrl ? `${API_BASE_URL.replace('/api', '')}${p.avatarUrl}` : DEFAULT_AVATAR_URL}
                                        alt={p.username}
                                        className="w-full h-full object-cover"
                                        onError={(e) => e.target.src = DEFAULT_AVATAR_URL}
                                    />
                                </div>
                                <span className="text-white">{p.username}</span>
                            </div>
                            <span className={`font-bold ${p.todayChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {p.todayChange >= 0 ? '+' : ''}{p.todayChange?.toFixed(2)} €
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
