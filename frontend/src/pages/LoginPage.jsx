import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getDefaultApiBaseUrl } from '../services/api';
import logoWhite from '../assets/mikesbar-logo-white.png';

export default function LoginPage() {
    const [credentials, setCredentials] = useState('');
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [users, setUsers] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        api.getLeaderboard()
            .then(data => setUsers(data))
            .catch(() => { });
    }, []);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const data = await api.login(credentials, pin);
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            navigate('/dashboard');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const [showSuggestions, setShowSuggestions] = useState(false);

    const filteredUsers = credentials
        ? users.filter(u =>
            u.username.toLowerCase().includes(credentials.toLowerCase()) ||
            u.id.toString().startsWith(credentials)
        )
        : [];

    const defaultApiUrl = getDefaultApiBaseUrl();
    const [showSettings, setShowSettings] = useState(false);
    const [apiUrl, setApiUrl] = useState(localStorage.getItem('custom_api_url') || defaultApiUrl);

    const handleSaveSettings = () => {
        localStorage.setItem('custom_api_url', apiUrl);
        window.location.reload();
    };

    if (showSettings) {
        return (
            <div className="flex-1 flex flex-col min-h-screen bg-neutral-950 relative overflow-hidden">
                {/* Background Effects */}
                <div className="absolute inset-0 bg-grid opacity-30" />
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-gradient-radial from-yellow-500/10 via-transparent to-transparent rounded-full blur-3xl pointer-events-none" />

                <div className="flex-1 flex flex-col justify-center items-center p-6 relative z-10">
                    <div className="glass-card rounded-2xl p-8 w-full max-w-sm animate-fade-in-scale">
                        <h2 className="text-2xl font-bold text-white mb-6 text-center">Einstellungen</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="text-neutral-400 text-sm block mb-2">API URL</label>
                                <input
                                    className="w-full bg-neutral-900/50 border border-white/10 p-3 rounded-xl text-white focus:outline-none focus:border-yellow-500/50 transition-colors"
                                    value={apiUrl}
                                    onChange={(e) => setApiUrl(e.target.value)}
                                />
                                <p className="text-xs text-neutral-600 mt-2">Standard: {defaultApiUrl}</p>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setShowSettings(false)}
                                    className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-neutral-400 hover:text-white transition-all"
                                >
                                    Abbrechen
                                </button>
                                <button
                                    onClick={handleSaveSettings}
                                    className="flex-1 py-3 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl text-white font-bold hover:from-green-400 hover:to-emerald-400 transition-all"
                                >
                                    Speichern
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col min-h-screen bg-neutral-950 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-grid opacity-30" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-gradient-radial from-yellow-500/10 via-transparent to-transparent rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-[300px] h-[300px] bg-gradient-radial from-purple-500/5 via-transparent to-transparent rounded-full blur-3xl pointer-events-none" />

            {/* Settings Button */}
            <button
                onClick={() => setShowSettings(true)}
                className="absolute top-4 right-4 p-3 text-neutral-600 hover:text-white hover:bg-white/10 rounded-xl transition-all z-20"
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            </button>

            {/* Main Content */}
            <div className="flex-1 flex flex-col justify-center items-center p-6 relative z-10">
                <div className="w-full max-w-sm space-y-8">

                    {/* Logo & Title */}
                    <div className="text-center animate-fade-in-down">
                        <div className="w-24 h-24 mx-auto mb-6 animate-float">
                            <img
                                src={logoWhite}
                                alt="Mike's Bar Logo"
                                className="w-full h-full object-contain drop-shadow-[0_0_20px_rgba(234,179,8,0.3)]"
                            />
                        </div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-yellow-400 to-amber-500 bg-clip-text text-transparent">
                            Spieler Login
                        </h1>
                        <p className="text-neutral-500 mt-2">Melde dich bei mikesBAR an</p>
                    </div>

                    {/* Login Form */}
                    <form onSubmit={handleLogin} className="space-y-5 animate-fade-in-up opacity-0 delay-200" style={{ animationFillMode: 'forwards' }}>

                        {/* Username Field */}
                        <div className="relative">
                            <label className="block text-sm font-medium text-neutral-400 mb-2">
                                Spieler Name oder ID
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={credentials}
                                    onChange={(e) => {
                                        setCredentials(e.target.value);
                                        setShowSuggestions(true);
                                    }}
                                    onFocus={() => setShowSuggestions(true)}
                                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                    className="w-full glass-card border-white/10 rounded-xl p-4 text-white placeholder-neutral-600 focus:outline-none focus:border-yellow-500/50 transition-all"
                                    placeholder="Tippen um zu suchen..."
                                    autoComplete="off"
                                />
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-600">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                    </svg>
                                </div>
                            </div>

                            {/* Dropdown */}
                            {showSuggestions && (credentials || users.length > 0) && (
                                <div className="absolute top-full left-0 w-full mt-2 glass-card rounded-xl shadow-2xl max-h-48 overflow-y-auto z-50 border border-white/10">
                                    {(credentials ? filteredUsers : users).map(u => (
                                        <button
                                            key={u.id}
                                            type="button"
                                            onMouseDown={(e) => {
                                                e.preventDefault();
                                                setCredentials(u.username);
                                                setShowSuggestions(false);
                                            }}
                                            className="w-full text-left p-3 hover:bg-white/10 border-b border-white/5 last:border-0 flex items-center justify-between group transition-colors"
                                        >
                                            <span className="font-bold text-white group-hover:text-yellow-400 transition-colors">{u.username}</span>
                                            <span className="text-xs text-neutral-500">ID: {u.id}</span>
                                        </button>
                                    ))}
                                    {credentials && filteredUsers.length === 0 && (
                                        <div className="p-4 text-neutral-500 text-sm text-center">Keine Treffer</div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* PIN Field */}
                        <div>
                            <label className="block text-sm font-medium text-neutral-400 mb-2">PIN</label>
                            <input
                                type="password"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={6}
                                value={pin}
                                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                                className="w-full glass-card border-white/10 rounded-xl p-4 text-white text-center text-2xl tracking-[0.5em] placeholder-neutral-600 focus:outline-none focus:border-yellow-500/50 transition-all"
                                placeholder="••••"
                                autoComplete="off"
                                style={{ WebkitTextSecurity: 'disc', textSecurity: 'disc' }}
                            />
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="text-red-400 text-center text-sm bg-red-500/10 border border-red-500/20 p-3 rounded-xl animate-fade-in-scale">
                                ⚠️ {error}
                            </div>
                        )}

                        {/* Buttons */}
                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => navigate('/')}
                                className="py-4 rounded-xl font-bold text-neutral-400 hover:text-white hover:bg-white/5 transition-all active:scale-95"
                            >
                                Zurück
                            </button>
                            <button
                                type="submit"
                                disabled={loading || !credentials || !pin}
                                className="py-4 bg-gradient-to-r from-yellow-500 to-amber-500 text-black rounded-xl font-bold text-lg hover:from-yellow-400 hover:to-amber-400 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-yellow-500/20 transition-all active:scale-95"
                            >
                                {loading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                    </span>
                                ) : 'Login'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
