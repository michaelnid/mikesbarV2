import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

const accentClasses = {
    amber: 'border-amber-500/40 bg-amber-950/40 hover:border-amber-400',
    emerald: 'border-emerald-500/40 bg-emerald-950/40 hover:border-emerald-400',
    red: 'border-red-500/40 bg-red-950/40 hover:border-red-400',
    blue: 'border-blue-500/40 bg-blue-950/40 hover:border-blue-400',
    slate: 'border-slate-500/40 bg-slate-900/60 hover:border-slate-300',
    neutral: 'border-neutral-700 bg-neutral-900 hover:border-neutral-500'
};

export default function GameSelectionPage() {
    const navigate = useNavigate();
    const dealer = JSON.parse(localStorage.getItem('dealer') || '{}');
    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let isMounted = true;

        api.getDealerLiveGames()
            .then((data) => {
                if (isMounted) {
                    setGames(Array.isArray(data) ? data : []);
                }
            })
            .catch((err) => {
                if (isMounted) {
                    setError(err.message || 'Live-Spiele konnten nicht geladen werden.');
                }
            })
            .finally(() => {
                if (isMounted) {
                    setLoading(false);
                }
            });

        return () => {
            isMounted = false;
        };
    }, []);

    const handleSelectGame = (game) => {
        localStorage.setItem('selected_game', game.key);
        localStorage.setItem('selected_game_name', game.name);

        if (game.launchMode === 'external' && game.externalLaunchUrl) {
            const targetUrl = new URL(game.externalLaunchUrl);
            targetUrl.searchParams.set('plugin', game.key);
            if (dealer.id) {
                targetUrl.searchParams.set('dealerId', dealer.id);
            }
            window.location.assign(targetUrl.toString());
            return;
        }

        navigate(game.clientRoute || (game.launchMode === 'direct' ? '/dealer/bank' : '/dealer/players'));
    };

    return (
        <div className="flex-1 flex flex-col bg-neutral-950 p-6 min-h-screen w-full max-w-md mx-auto md:border-x md:border-neutral-800 md:shadow-2xl">
            <div className="flex justify-between items-center mb-10">
                <div>
                    <h1 className="text-xl font-bold text-white">Live-Spiel wählen</h1>
                    <p className="text-yellow-500 font-bold">{dealer.name}</p>
                </div>
                <button
                    onClick={() => { localStorage.clear(); navigate('/dealer'); }}
                    className="px-4 py-2 bg-neutral-800 rounded-lg text-sm text-neutral-300 hover:text-white"
                >
                    Logout
                </button>
            </div>

            {loading && (
                <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-6 text-neutral-400">
                    Live-Spielkatalog wird geladen.
                </div>
            )}

            {!loading && error && (
                <div className="rounded-2xl border border-red-900/60 bg-red-950/30 p-6 text-red-300">
                    {error}
                </div>
            )}

            {!loading && !error && (
                <div className="space-y-4">
                    {games.map((game) => (
                        <button
                            key={game.key}
                            onClick={() => handleSelectGame(game)}
                            className={`w-full rounded-2xl border p-5 text-left transition ${accentClasses[game.accentColor] || accentClasses.neutral}`}
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <div className="text-lg font-bold text-white">{game.name}</div>
                                    <p className="mt-1 text-sm text-neutral-300">{game.description}</p>
                                    <div className="mt-2 text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                                        {game.source === 'package' ? `Plugin ${game.version}` : 'System'}
                                    </div>
                                </div>
                                <span className="rounded-full bg-black/20 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-neutral-300">
                                    {game.launchMode}
                                </span>
                            </div>
                        </button>
                    ))}

                    {games.length === 0 && (
                        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-6 text-neutral-400">
                            Es sind aktuell keine Live-Spiel-Plugins aktiviert.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
