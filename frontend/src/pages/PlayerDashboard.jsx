import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'react-qr-code';
import TransferModal from '../components/TransferModal';

import ChangePinModal from '../components/ChangePinModal';
import { api, API_BASE_URL } from '../services/api';
import { DEFAULT_AVATAR_URL } from '../constants/assets';

export default function PlayerDashboard() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [showTransfer, setShowTransfer] = useState(false);

    const [showChangePin, setShowChangePin] = useState(false);

    const token = localStorage.getItem('token');

    useEffect(() => {
        const userData = localStorage.getItem('user');
        if (!userData || !token) {
            navigate('/login');
            return;
        }
        setUser(JSON.parse(userData));

        fetchUser();
        const interval = setInterval(fetchUser, 5000);

        return () => clearInterval(interval);
    }, [navigate, token]);

    const fetchUser = async () => {
        try {
            const data = await api.getMe(token);
            setUser(data);
            localStorage.setItem('user', JSON.stringify(data));
        } catch (err) {
            console.error("Failed to update user data", err);
        }
    };

    const refreshUser = () => fetchUser();

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/');
    };

    if (!user) return null;

    return (
        <div className="flex-1 flex flex-col min-h-screen bg-neutral-950 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-grid opacity-30" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-gradient-radial from-yellow-500/10 via-transparent to-transparent rounded-full blur-3xl pointer-events-none" />

            {/* Header */}
            <header className="relative z-20 glass border-b border-white/5">
                <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/')}
                            className="p-2 rounded-xl hover:bg-white/10 transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-neutral-400">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                            </svg>
                        </button>
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full border-2 border-yellow-500/50 overflow-hidden bg-neutral-800 shadow-[0_0_20px_rgba(234,179,8,0.2)]">
                                <img
                                    src={user.avatarUrl?.startsWith('http') ? user.avatarUrl : user.avatarUrl ? `${API_BASE_URL.replace('/api', '')}${user.avatarUrl}` : DEFAULT_AVATAR_URL}
                                    alt="Avatar"
                                    className="w-full h-full object-cover"
                                    onError={(e) => e.target.src = DEFAULT_AVATAR_URL}
                                />
                            </div>
                            <div>
                                <h2 className="font-bold text-lg leading-none text-white">{user.username}</h2>
                                <span className="text-xs text-neutral-500 uppercase tracking-wider">ID: {user.id}</span>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="p-2 rounded-xl text-neutral-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        title="Ausloggen"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                        </svg>
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto relative z-10">
                <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

                    {/* Balance Card */}
                    <div className="glass-card rounded-2xl p-6 relative overflow-hidden animate-fade-in-down">
                        <div className="relative">
                            <div className="text-neutral-400 text-sm font-medium mb-1">Dein Guthaben</div>
                            <div className="text-5xl font-black text-white tracking-tight flex items-baseline gap-2">
                                <span className="bg-gradient-to-r from-white to-neutral-300 bg-clip-text text-transparent">
                                    {user.balance.toFixed(2)}
                                </span>
                                <span className="text-2xl text-yellow-500">€</span>
                            </div>

                            {/* Action Button */}
                            <div className="mt-6">
                                <button
                                    onClick={() => setShowTransfer(true)}
                                    className="w-full py-3 px-4 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black font-bold rounded-xl transition-all active:scale-95 shadow-lg shadow-yellow-500/20"
                                >
                                    💸 Geld senden
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* QR Code Card */}
                    <div className="glass-card rounded-2xl p-6 animate-fade-in-up opacity-0 delay-100" style={{ animationFillMode: 'forwards' }}>
                        <div className="text-center">
                            <h3 className="text-lg font-bold text-white mb-4">Dein QR-Code</h3>
                            <div className="inline-block p-4 bg-white rounded-2xl shadow-[0_0_40px_rgba(255,255,255,0.1)]">
                                <div className="w-48 h-48">
                                    <QRCode
                                        size={256}
                                        style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                                        value={user.qrCodeUuid}
                                        viewBox={`0 0 256 256`}
                                    />
                                </div>
                            </div>
                            <p className="text-neutral-500 text-sm mt-4">Zeige diesen Code dem Dealer</p>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="grid grid-cols-3 gap-3 animate-fade-in-up opacity-0 delay-200" style={{ animationFillMode: 'forwards' }}>
                        <button
                            onClick={() => navigate(`/player/${user.id}`)}
                            className="glass-card rounded-xl p-4 flex flex-col items-center gap-2 group"
                        >
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <span className="text-2xl">📊</span>
                            </div>
                            <span className="text-xs font-bold text-neutral-300 group-hover:text-white transition-colors">Statistik</span>
                        </button>

                        <button
                            onClick={() => setShowChangePin(true)}
                            className="glass-card rounded-xl p-4 flex flex-col items-center gap-2 group"
                        >
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <span className="text-2xl">🔒</span>
                            </div>
                            <span className="text-xs font-bold text-neutral-300 group-hover:text-white transition-colors">PIN ändern</span>
                        </button>

                        <button
                            onClick={() => navigate('/leaderboard')}
                            className="glass-card rounded-xl p-4 flex flex-col items-center gap-2 group"
                        >
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <span className="text-2xl">🏆</span>
                            </div>
                            <span className="text-xs font-bold text-neutral-300 group-hover:text-white transition-colors">Rangliste</span>
                        </button>
                    </div>

                </div>
            </div>

            {/* Modals */}
            {showTransfer && <TransferModal onClose={() => setShowTransfer(false)} onSuccess={refreshUser} />}
            {showChangePin && <ChangePinModal onClose={() => setShowChangePin(false)} onSuccess={() => { }} />}
        </div>
    );
}
