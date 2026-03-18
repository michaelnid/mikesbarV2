import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';

const REFRESH_INTERVAL = 5000; // 5 Sekunden für Live-Updates

export default function StatsWidgets({ token, onRefresh }) {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const intervalRef = useRef(null);

    useEffect(() => {
        loadStats();
    }, [onRefresh]);

    // Automatisches Polling für Live-Updates
    useEffect(() => {
        intervalRef.current = setInterval(loadStats, REFRESH_INTERVAL);
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [token]);

    const loadStats = async () => {
        try {
            const data = await api.getDashboardStats(token);
            setStats(data);
        } catch (err) {
            console.error('Failed to load stats:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="grid grid-cols-2 gap-4 animate-pulse">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-neutral-800 rounded-xl"></div>)}
        </div>;
    }

    if (!stats) return null;

    const widgets = [
        { icon: '👥', label: 'Spieler', value: stats.totalPlayers, color: 'text-blue-400' },
        { icon: '🕴️', label: 'Aktive Dealer', value: stats.activeDealers, color: 'text-emerald-400' },
        { icon: '💰', label: 'Guthaben im Umlauf', value: `${stats.totalBalance?.toFixed(2)} €`, color: 'text-yellow-400' },
        { icon: '📊', label: 'Transaktionen heute', value: stats.todayTransactionCount, color: 'text-purple-400' }
    ];

    return (
        <div className="grid grid-cols-2 gap-4">
            {widgets.map((w, i) => (
                <div key={i} className="p-4 bg-neutral-800 rounded-xl border border-neutral-700">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-xl">{w.icon}</span>
                        <span className="text-neutral-400 text-sm">{w.label}</span>
                    </div>
                    <p className={`text-2xl font-bold ${w.color}`}>{w.value}</p>
                </div>
            ))}

            {/* Extra row: Today's deposits/withdrawals */}
            <div className="col-span-2 p-4 bg-neutral-800 rounded-xl border border-neutral-700 flex justify-around">
                <div className="text-center">
                    <p className="text-emerald-400 text-xl font-bold">+{stats.todayDeposits?.toFixed(2)} €</p>
                    <p className="text-neutral-500 text-sm">Einzahlungen heute</p>
                </div>
                <div className="text-center">
                    <p className="text-red-400 text-xl font-bold">-{stats.todayWithdrawals?.toFixed(2)} €</p>
                    <p className="text-neutral-500 text-sm">Auszahlungen heute</p>
                </div>
            </div>
        </div>
    );
}
