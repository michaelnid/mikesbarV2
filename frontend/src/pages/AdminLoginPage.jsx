import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getDefaultApiBaseUrl } from '../services/api';

export default function AdminLoginPage() {
    const navigate = useNavigate();
    const [pin, setPin] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleDigitClick = (digit) => {
        if (pin.length < 6) {
            setPin(prev => prev + digit);
        }
    };

    const handleClear = () => {
        setPin('');
        setError('');
    };

    const handleLogin = async () => {
        if (!pin) return;
        setLoading(true);
        setError('');
        try {
            // Admin login: assume username 'admin' and validation via this PIN
            const data = await api.login('admin', pin);
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));

            if (data.user.role !== 'ADMIN') {
                throw new Error('Kein Admin Access');
            }

            navigate('/admin/dashboard');
        } catch (err) {
            console.error(err);
            setError('Falscher PIN');
            setPin('');
        } finally {
            setLoading(false);
        }
    };

    const defaultApiUrl = getDefaultApiBaseUrl();
    const [showSettings, setShowSettings] = useState(false);
    const [apiUrl, setApiUrl] = useState(localStorage.getItem('custom_api_url') || defaultApiUrl);

    const handleSaveSettings = () => {
        localStorage.setItem('custom_api_url', apiUrl);
        window.location.reload();
    };

    if (showSettings) {
        return (
            <div className="flex-1 flex flex-col p-6 bg-neutral-950 min-h-screen justify-center items-center w-full max-w-md mx-auto">
                <div className="w-full max-w-sm space-y-4">
                    <h2 className="text-2xl font-bold text-white mb-4">Einstellungen</h2>
                    <div className="space-y-2">
                        <label className="text-neutral-400 text-sm">API URL</label>
                        <input
                            className="w-full bg-neutral-900 border border-neutral-700 p-3 rounded text-white"
                            value={apiUrl}
                            onChange={(e) => setApiUrl(e.target.value)}
                        />
                        <p className="text-xs text-neutral-600">Standard: {defaultApiUrl}</p>
                    </div>
                    <div className="flex gap-2 pt-4">
                        <button onClick={() => setShowSettings(false)} className="flex-1 py-3 bg-neutral-800 rounded text-neutral-400">Abbrechen</button>
                        <button onClick={handleSaveSettings} className="flex-1 py-3 bg-green-600 rounded text-white font-bold">Speichern & Reload</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 relative">
            <button
                onClick={() => setShowSettings(true)}
                className="absolute top-4 right-4 p-2 text-neutral-600 hover:text-white"
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            </button>

            <h1 className="text-3xl font-bold text-yellow-500 mb-8">Admin Login</h1>

            <div className="w-full max-w-xs space-y-4">
                {/* Display */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-lg h-16 flex items-center justify-center text-3xl text-white tracking-[0.5em] mb-8 font-mono">
                    {pin ? '•'.repeat(pin.length) : <span className="text-neutral-600 text-lg tracking-normal font-sans opacity-50">PIN</span>}
                </div>

                {/* Keypad */}
                <div className="grid grid-cols-3 gap-3">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                        <button
                            key={num}
                            onClick={() => handleDigitClick(num.toString())}
                            className="h-16 bg-neutral-300 rounded-lg text-2xl font-bold text-black hover:bg-white active:scale-95 transition-all shadow-lg"
                        >
                            {num}
                        </button>
                    ))}

                    <button
                        onClick={handleClear}
                        className="h-16 bg-neutral-600 rounded-lg text-2xl font-bold text-white hover:bg-neutral-500 active:scale-95 transition-all shadow-lg flex items-center justify-center"
                    >
                        C
                    </button>

                    <button
                        onClick={() => handleDigitClick('0')}
                        className="h-16 bg-neutral-300 rounded-lg text-2xl font-bold text-black hover:bg-white active:scale-95 transition-all shadow-lg"
                    >
                        0
                    </button>

                    <button
                        onClick={handleLogin}
                        disabled={loading || pin.length === 0}
                        className="h-16 bg-green-500 rounded-lg text-2xl font-bold text-black hover:bg-green-400 active:scale-95 transition-all shadow-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        ➔
                    </button>
                </div>

                {error && <div className="text-red-500 text-center font-bold mt-4">{error}</div>}
            </div>
        </div>
    );
}
