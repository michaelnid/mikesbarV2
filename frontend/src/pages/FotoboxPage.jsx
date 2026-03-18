import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

export default function FotoboxPage() {
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const [loading, setLoading] = useState(true);
    const [hasAccess, setHasAccess] = useState(false);

    useEffect(() => {
        if (!token) {
            navigate('/');
            return;
        }

        // Check if user has Fotobox access
        const checkAccess = async () => {
            try {
                const user = await api.getMe(token);
                if (user.hasFotoboxAccess) {
                    setHasAccess(true);
                }
            } catch (err) {
                console.error('Failed to check access:', err);
            } finally {
                setLoading(false);
            }
        };

        checkAccess();
    }, [token, navigate]);

    if (!token) return null;

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center min-h-[calc(100vh-80px)] bg-neutral-950">
                <div className="text-neutral-500 text-lg">Lade...</div>
            </div>
        );
    }

    if (!hasAccess) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center min-h-[calc(100vh-80px)] bg-neutral-950 relative overflow-hidden">
                <div className="absolute inset-0 bg-grid opacity-50" />
                <div className="relative z-10 text-center p-8">
                    <div className="text-6xl mb-6">🔒</div>
                    <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-4">Zugang verweigert</h2>
                    <p className="text-neutral-400 mb-8">Du hast keine Berechtigung für die Fotobox.</p>
                    <button
                        onClick={() => navigate('/')}
                        className="px-8 py-4 bg-yellow-500 text-black font-black uppercase tracking-widest text-sm rounded-xl hover:bg-yellow-400 transition-all"
                    >
                        Zurück zur Startseite
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col min-h-[calc(100vh-80px)] bg-neutral-950 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-grid opacity-50" />

            <div className="relative z-10 flex-1 flex flex-col p-4 sm:p-6 lg:p-8">
                {/* Header Actions */}
                <div className="flex items-center gap-4 mb-6">
                    <button
                        onClick={() => navigate('/')}
                        className="w-12 h-12 flex items-center justify-center bg-neutral-900 border border-white/10 rounded-2xl hover:bg-neutral-800 hover:border-yellow-500/50 transition-all text-sm group"
                    >
                        <span className="group-hover:-translate-x-1 transition-transform">⬅️</span>
                    </button>
                    <div>
                        <h2 className="text-2xl font-black text-white uppercase tracking-tight">mikesBAR Fotobox</h2>
                        <div className="h-0.5 w-12 bg-yellow-500 mt-1" />
                    </div>
                </div>

                {/* iFrame Container */}
                <div className="flex-1 glass-card rounded-[2rem] overflow-hidden border border-white/10 relative shadow-2xl">
                    <iframe
                        allow="web-share"
                        src="https://fotoshare.co/e/e78U7pPDDgn0msje8AhfF?embed=1"
                        style={{ width: '100%', height: '100%', border: 0 }}
                        frameBorder="0"
                        title="mikesBAR Fotobox"
                    />
                </div>
            </div>
        </div>
    );
}
