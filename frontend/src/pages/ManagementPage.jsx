import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { canSeeAdminTile, canSeeDealerTile, hasPermission } from '../utils/permissions';

const ManagementCard = ({ title, description, accentClass, icon, onClick }) => (
    <button
        onClick={onClick}
        className="glass-card rounded-2xl p-6 sm:p-8 cursor-pointer text-left active:scale-95 transition-transform w-full"
    >
        <div className="flex items-center gap-4">
            <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xl ${accentClass} flex items-center justify-center shrink-0`}>
                {typeof icon === 'string' ? <span className="text-3xl">{icon}</span> : icon}
            </div>
            <div>
                <h3 className="text-lg sm:text-xl font-bold text-white">{title}</h3>
                <p className="text-sm text-neutral-400">{description}</p>
            </div>
        </div>
    </button>
);

const pluginAccentClasses = {
    amber: 'bg-gradient-to-br from-amber-500/20 to-amber-600/10',
    emerald: 'bg-gradient-to-br from-emerald-500/20 to-emerald-700/10',
    red: 'bg-gradient-to-br from-red-500/20 to-red-700/10',
    blue: 'bg-gradient-to-br from-blue-500/20 to-indigo-700/10',
    slate: 'bg-gradient-to-br from-slate-500/20 to-slate-700/10',
    neutral: 'bg-gradient-to-br from-neutral-500/20 to-neutral-700/10'
};

export default function ManagementPage() {
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || 'null'));
    const [pluginTiles, setPluginTiles] = useState([]);

    useEffect(() => {
        if (!token || !user || (!hasPermission(user, 'DEALER') && !hasPermission(user, 'ADMIN'))) {
            navigate('/');
            return;
        }

        api.getMe(token).then((data) => {
            setUser(data);
            localStorage.setItem('user', JSON.stringify(data));
        }).catch(() => {
            navigate('/');
        });

        api.getPluginDashboardTiles('management', token)
            .then((data) => setPluginTiles(Array.isArray(data) ? data : []))
            .catch(() => setPluginTiles([]));
    }, [navigate, token]);

    const showDealerEntry = canSeeDealerTile(user);
    const showAdminEntry = canSeeAdminTile(user);

    useEffect(() => {
        if (user && !showDealerEntry && !showAdminEntry) {
            navigate('/');
        }
    }, [navigate, showAdminEntry, showDealerEntry, user]);

    if (!user || (!showDealerEntry && !showAdminEntry)) {
        return null;
    }

    return (
        <div className="flex-1 flex flex-col min-h-screen bg-neutral-950 relative overflow-hidden">
            <div className="absolute inset-0 bg-grid opacity-50" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-radial from-yellow-500/10 via-transparent to-transparent rounded-full blur-3xl pointer-events-none" />

            <div className="flex-1 flex items-center justify-center px-4 py-8 sm:px-6 lg:px-8 relative z-10">
                <div className="w-full max-w-4xl">
                    <div className="text-center mb-10">
                        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-2 text-white">Verwaltung</h1>
                        <p className="max-w-2xl mx-auto text-sm sm:text-base text-neutral-300">
                            Zugriff auf die freigegebenen Verwaltungsbereiche für dieses Konto.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {showDealerEntry && (
                            <ManagementCard
                                title="Dealer Core"
                                description="Tische, Spieler-Sessions und Plugin-Auswahl"
                                accentClass="bg-gradient-to-br from-emerald-500/20 to-emerald-700/10"
                                icon="🃏"
                                onClick={() => navigate('/dealer')}
                            />
                        )}

                        {showAdminEntry && (
                            <ManagementCard
                                title="Admin"
                                description="Benutzer, Rechte, Plugin-Freigaben und Übersicht"
                                accentClass="bg-gradient-to-br from-blue-500/20 to-indigo-700/10"
                                icon="🛠️"
                                onClick={() => navigate('/admin/dashboard')}
                            />
                        )}

                        {pluginTiles.map((tile) => (
                            <ManagementCard
                                key={`${tile.key}-${tile.title}`}
                                title={tile.title}
                                description={tile.description}
                                accentClass={pluginAccentClasses[tile.accentColor] || pluginAccentClasses.neutral}
                                icon={tile.iconUrl ? <img src={tile.iconUrl} alt="" className="w-8 h-8 object-contain" /> : '🎮'}
                                onClick={() => navigate(tile.route || `/plugins/${tile.key}`)}
                            />
                        ))}
                    </div>

                    <div className="mt-8 flex justify-center">
                        <button
                            onClick={() => navigate('/')}
                            className="px-6 py-3 rounded-xl bg-white/5 text-neutral-300 hover:text-white hover:bg-white/10 transition-colors"
                        >
                            Zurück zur Startseite
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
