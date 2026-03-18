import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { DEFAULT_AVATAR_URL } from '../constants/assets';

const REFRESH_INTERVAL = 5000; // 5 Sekunden für Live-Updates

export default function ActiveTables({ token, onRefresh }) {
    const [tables, setTables] = useState([]);
    const [loading, setLoading] = useState(true);
    const intervalRef = useRef(null);

    useEffect(() => {
        loadTables();
    }, [onRefresh]);

    // Automatisches Polling für Live-Updates
    useEffect(() => {
        intervalRef.current = setInterval(loadTables, REFRESH_INTERVAL);
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [token]);

    const loadTables = async () => {
        try {
            const data = await api.getActiveTables(token);
            setTables(data);
        } catch (err) {
            console.error('Failed to load tables:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="h-32 bg-neutral-800 rounded-xl animate-pulse"></div>;
    }

    if (tables.length === 0) {
        return (
            <div className="p-6 bg-neutral-800 rounded-xl border border-neutral-700 text-center">
                <p className="text-neutral-500">🎲 Keine aktiven Tische</p>
                <p className="text-neutral-600 text-sm mt-1">Dealer müssen ein Spiel auswählen um aktiv zu werden</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <h3 className="font-bold text-white">🎲 Aktive Tische</h3>
            {tables.map(table => (
                <div key={table.dealerId} className="p-4 bg-neutral-800 rounded-xl border border-neutral-700">
                    <div className="flex justify-between items-start mb-3">
                        <div>
                            <p className="font-bold text-white">{table.dealerName}</p>
                            <p className="text-yellow-500 text-sm">{table.currentGame}</p>
                        </div>
                        <span className="px-2 py-1 bg-emerald-900/50 text-emerald-400 text-xs rounded-full">
                            🟢 Live
                        </span>
                    </div>

                    {table.players && table.players.length > 0 ? (
                        <div className="border-t border-neutral-700 pt-3">
                            <p className="text-neutral-400 text-xs mb-2">Spieler am Tisch ({table.players.length})</p>
                            <div className="flex flex-wrap gap-2">
                                {table.players.map(p => (
                                    <div key={p.id} className="flex items-center gap-2 px-3 py-1 bg-neutral-700 rounded-full">
                                        <div className="w-5 h-5 rounded-full overflow-hidden bg-neutral-600">
                                            <img
                                                src={p.avatarUrl || DEFAULT_AVATAR_URL}
                                                alt={p.username}
                                                className="w-full h-full object-cover"
                                                onError={(e) => e.target.src = DEFAULT_AVATAR_URL}
                                            />
                                        </div>
                                        <span className="text-white text-sm">{p.username}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <p className="text-neutral-600 text-sm border-t border-neutral-700 pt-3">
                            Keine Spieler am Tisch
                        </p>
                    )}
                </div>
            ))}
        </div>
    );
}
