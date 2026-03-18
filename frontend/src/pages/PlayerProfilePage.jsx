import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, API_BASE_URL } from '../services/api';
import { DEFAULT_AVATAR_URL } from '../constants/assets';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler,
} from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

export default function PlayerProfilePage() {
    const { userId } = useParams();
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [chartData, setChartData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [chartDays, setChartDays] = useState(7);

    // Check authentication on mount
    const token = localStorage.getItem('token');

    useEffect(() => {
        // Redirect to login if not authenticated
        if (!token) {
            navigate('/login');
            return;
        }
        loadProfile();
    }, [userId, token]);

    useEffect(() => {
        loadChartData();
    }, [userId, chartDays]);

    useEffect(() => {
        const interval = setInterval(() => {
            refreshData();
        }, 10000);
        return () => clearInterval(interval);
    }, [userId, chartDays]);

    const refreshData = async () => {
        try {
            const [profileData, chartDataNew] = await Promise.all([
                api.getPlayerProfile(userId),
                api.getPlayerChartData(userId, chartDays)
            ]);
            setProfile(profileData);
            setChartData(chartDataNew);
        } catch (err) {
            console.error('Failed to refresh data:', err);
        }
    };

    const loadProfile = async () => {
        try {
            setLoading(true);
            const data = await api.getPlayerProfile(userId);
            setProfile(data);
        } catch (err) {
            setError('Spieler nicht gefunden');
        } finally {
            setLoading(false);
        }
    };

    const loadChartData = async () => {
        try {
            const data = await api.getPlayerChartData(userId, chartDays);
            setChartData(data);
        } catch (err) {
            console.error('Failed to load chart data:', err);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-neutral-950 flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-grid opacity-30" />
                <div className="relative z-10 flex flex-col items-center gap-4">
                    <div className="w-16 h-16 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-neutral-400 text-sm">Lade Profil...</p>
                </div>
            </div>
        );
    }

    if (error || !profile) {
        return (
            <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-grid opacity-30" />
                <div className="relative z-10 text-center">
                    <span className="text-6xl mb-4 block">😕</span>
                    <p className="text-white text-xl mb-6">{error || 'Spieler nicht gefunden'}</p>
                    <button
                        onClick={() => navigate(-1)}
                        className="px-8 py-3 bg-gradient-to-r from-yellow-500 to-amber-500 text-black font-bold rounded-xl hover:from-yellow-400 hover:to-amber-400 transition-all"
                    >
                        Zurück
                    </button>
                </div>
            </div>
        );
    }

    // Line Chart Config
    const lineChartData = chartData ? {
        labels: chartData.map(d => d.date),
        datasets: [
            {
                label: 'Einnahmen',
                data: chartData.map(d => d.income),
                borderColor: 'rgba(16, 185, 129, 1)',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                fill: true,
                tension: 0.4,
            },
            {
                label: 'Ausgaben',
                data: chartData.map(d => d.expenses),
                borderColor: 'rgba(239, 68, 68, 1)',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                fill: true,
                tension: 0.4,
            }
        ]
    } : null;

    const lineChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'top', labels: { color: '#a3a3a3' } }
        },
        scales: {
            x: { ticks: { color: '#a3a3a3' }, grid: { color: 'rgba(255,255,255,0.05)' } },
            y: { ticks: { color: '#a3a3a3' }, grid: { color: 'rgba(255,255,255,0.05)' } }
        }
    };

    // Doughnut Chart Config
    const gameColors = [
        'rgba(234, 179, 8, 0.9)',
        'rgba(16, 185, 129, 0.9)',
        'rgba(239, 68, 68, 0.9)',
        'rgba(59, 130, 246, 0.9)',
        'rgba(168, 85, 247, 0.9)',
        'rgba(236, 72, 153, 0.9)',
    ];

    const doughnutData = {
        labels: profile.gameBreakdown.map(g => g.game),
        datasets: [{
            data: profile.gameBreakdown.map(g => g.transactionCount),
            backgroundColor: gameColors,
            borderWidth: 0,
        }]
    };

    const doughnutOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'bottom', labels: { color: '#a3a3a3', padding: 15 } }
        }
    };

    const formatCurrency = (value) => `${value >= 0 ? '+' : ''}${value.toFixed(2)} €`;
    const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

    return (
        <div className="min-h-screen bg-neutral-950 text-white relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-grid opacity-30" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-gradient-radial from-yellow-500/10 via-transparent to-transparent rounded-full blur-3xl pointer-events-none" />

            {/* Header */}
            <header className="relative z-20 glass border-b border-white/5">
                <div className="max-w-4xl mx-auto px-4 py-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors mb-4"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                        </svg>
                        Zurück
                    </button>

                    <div className="flex items-center gap-5">
                        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-yellow-500/50 overflow-hidden bg-neutral-800 shadow-[0_0_30px_rgba(234,179,8,0.2)]">
                            <img
                                src={profile.avatarUrl?.startsWith('http') ? profile.avatarUrl : profile.avatarUrl ? `${API_BASE_URL.replace('/api', '')}${profile.avatarUrl}` : DEFAULT_AVATAR_URL}
                                alt="Avatar"
                                className="w-full h-full object-cover"
                                onError={(e) => e.target.src = DEFAULT_AVATAR_URL}
                            />
                        </div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-yellow-400 to-amber-500 bg-clip-text text-transparent">
                                {profile.username}
                            </h1>
                            <p className="text-neutral-400 text-sm mt-1">Mitglied seit {formatDate(profile.createdAt)}</p>
                            <p className="text-3xl sm:text-4xl font-black mt-2">
                                <span className="bg-gradient-to-r from-white to-neutral-300 bg-clip-text text-transparent">
                                    {profile.balance.toFixed(2)}
                                </span>
                                <span className="text-xl text-yellow-500 ml-2">€</span>
                            </p>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <div className="relative z-10 max-w-4xl mx-auto p-4 sm:p-6 space-y-6 pb-20">

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 animate-fade-in-up">
                    <StatCard label="Einzahlungen" value={`+${profile.statistics.totalDeposits.toFixed(2)} €`} color="text-emerald-400" icon="💰" />
                    <StatCard label="Auszahlungen" value={`-${profile.statistics.totalWithdrawals.toFixed(2)} €`} color="text-red-400" icon="💸" />
                    <StatCard label="Spielgewinne" value={`+${profile.statistics.totalWins.toFixed(2)} €`} color="text-yellow-400" icon="🎰" />
                    <StatCard label="Spielverluste" value={`-${profile.statistics.totalLosses.toFixed(2)} €`} color="text-orange-400" icon="📉" />
                    <StatCard label="Bankrotte" value={profile.bankruptcyCount || 0} color={profile.bankruptcyCount > 0 ? "text-red-500" : "text-neutral-400"} icon="💀" />
                </div>

                {/* Net Profit Card */}
                <div className="glass-card rounded-2xl p-6 animate-fade-in-up opacity-0 delay-100" style={{ animationFillMode: 'forwards' }}>
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="text-neutral-400 text-sm">Netto Gewinn/Verlust (Spiele)</p>
                            <p className={`text-4xl font-black mt-1 ${profile.statistics.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {formatCurrency(profile.statistics.netProfit)}
                            </p>
                        </div>
                        <div className="text-right">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-neutral-700 to-neutral-800 flex items-center justify-center">
                                <span className="text-2xl">{profile.statistics.netProfit >= 0 ? '📈' : '📉'}</span>
                            </div>
                            <p className="text-neutral-500 text-sm mt-2">{profile.statistics.transactionCount} Transaktionen</p>
                        </div>
                    </div>
                </div>

                {/* Charts Row */}
                <div className="grid md:grid-cols-2 gap-4 animate-fade-in-up opacity-0 delay-200" style={{ animationFillMode: 'forwards' }}>
                    {/* Balance History Chart */}
                    <div className="glass-card rounded-2xl p-4">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-white">Einnahmen / Ausgaben</h3>
                            <select
                                value={chartDays}
                                onChange={(e) => setChartDays(Number(e.target.value))}
                                className="bg-neutral-800 text-white text-sm rounded-lg px-3 py-1.5 border border-white/10 focus:outline-none focus:border-yellow-500/50"
                            >
                                <option value={7}>7 Tage</option>
                                <option value={14}>14 Tage</option>
                                <option value={30}>30 Tage</option>
                            </select>
                        </div>
                        <div style={{ height: '220px' }}>
                            {lineChartData && <Line data={lineChartData} options={lineChartOptions} />}
                        </div>
                    </div>

                    {/* Game Breakdown Chart */}
                    <div className="glass-card rounded-2xl p-4">
                        <h3 className="font-bold text-white mb-4">Aktivität nach Typ</h3>
                        <div style={{ height: '220px' }}>
                            {profile.gameBreakdown.length > 0 ? (
                                <Doughnut data={doughnutData} options={doughnutOptions} />
                            ) : (
                                <div className="h-full flex items-center justify-center text-neutral-500">
                                    Keine Daten
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Transaction History */}
                <div className="glass-card rounded-2xl overflow-hidden animate-fade-in-up opacity-0 delay-300" style={{ animationFillMode: 'forwards' }}>
                    <div className="p-4 border-b border-white/10 flex items-center gap-3">
                        <span className="text-xl">📜</span>
                        <h3 className="font-bold text-white">Letzte Transaktionen</h3>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                        {profile.recentTransactions.length > 0 ? (
                            profile.recentTransactions.map((t, index) => (
                                <div
                                    key={t.id}
                                    className="flex items-center justify-between p-4 border-b border-white/5 hover:bg-white/5 transition-colors"
                                    style={{ animationDelay: `${index * 50}ms` }}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${t.amount >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                                            <span className="text-lg">{t.amount >= 0 ? '↗️' : '↘️'}</span>
                                        </div>
                                        <div>
                                            <p className="font-medium text-white">
                                                {t.game}
                                            </p>
                                            <p className="text-xs text-neutral-500">
                                                {formatDate(t.timestamp)}
                                                {t.dealerName && ` • ${t.dealerName}`}
                                            </p>
                                        </div>
                                    </div>
                                    <p className={`font-mono font-bold ${t.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {formatCurrency(t.amount)}
                                    </p>
                                </div>
                            ))
                        ) : (
                            <div className="p-8 text-center text-neutral-500">
                                <span className="text-4xl block mb-2">📭</span>
                                Keine Transaktionen vorhanden
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({ label, value, color, icon }) {
    return (
        <div className="glass-card rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
                <p className="text-neutral-400 text-xs">{label}</p>
                <span className="text-lg">{icon}</span>
            </div>
            <p className={`text-lg font-bold ${color}`}>{value}</p>
        </div>
    );
}
