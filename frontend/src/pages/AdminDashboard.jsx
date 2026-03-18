import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, API_BASE_URL } from '../services/api';
import QRCode from 'react-qr-code';
import TransactionHistory from '../components/TransactionHistory';
import StatsWidgets from '../components/StatsWidgets';
import StatsCharts from '../components/StatsCharts';
import TopPlayersTable from '../components/TopPlayersTable';
import ActiveTables from '../components/ActiveTables';
import logoWhite from '../assets/mikesbar-logo-white.png';
import * as signalR from '@microsoft/signalr';
import QRScanner from '../components/QRScanner';
import { DEFAULT_AVATAR_URL } from '../constants/assets';
import { hasPermission, getUserPermissions } from '../utils/permissions';

// --- Sub Components ---

const Menu = ({ onSetView, onLoadUsers, onLoadGameSettings, onShowSslInfo, navigate }) => (
    <div className="flex flex-col items-center justify-center w-full animate-fade-in-up">
        {/* Admin Header */}
        <div className="text-center mb-12 w-full max-w-2xl px-4">
            <div className="relative inline-block mb-4">
                <img src={logoWhite} alt="Logo" className="w-24 h-24 mx-auto animate-float drop-shadow-[0_0_20px_rgba(234,179,8,0.3)]" />
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white mb-2">
                ADMIN <span className="bg-gradient-to-r from-yellow-400 to-amber-500 bg-clip-text text-transparent">DASHBOARD</span>
            </h1>
            <div className="h-1 w-32 bg-gradient-to-r from-transparent via-yellow-500 to-transparent mx-auto mb-6" />

            <div className="flex justify-center items-center gap-4 text-sm text-neutral-400 mb-8">
                <span className="flex items-center gap-2 px-3 py-1 bg-yellow-500/10 text-yellow-500 rounded-full border border-yellow-500/20">
                    <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                    Administrator
                </span>
                <button
                    onClick={() => { localStorage.removeItem('token'); navigate('/admin'); }}
                    className="hover:text-red-400 transition-colors flex items-center gap-1 border-b border-transparent hover:border-red-400/50"
                >
                    🔒 Logout
                </button>
            </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-6xl px-4">
            <MenuButton
                icon="📊"
                label="Live Statistiken"
                description="Echtzeit-Daten & Charts"
                color="from-blue-600/20 to-indigo-600/10"
                onClick={() => onSetView('stats')}
            />
            <MenuButton
                icon="✏️"
                label="User & Rechte"
                description="Profile, Guthaben und Gruppen"
                color="from-yellow-600/20 to-amber-600/10"
                onClick={() => { onLoadUsers(); onSetView('editUser'); }}
            />
            <MenuButton
                icon="🎮"
                label="System Features"
                description="Spiele & Settings steuern"
                color="from-purple-600/20 to-fuchsia-700/10"
                onClick={() => { onLoadGameSettings(); onSetView('gameSettings'); }}
            />
            <MenuButton
                icon="🔐"
                label="SSL Zertifikat"
                description="Zertifikat-Status & Details"
                color="from-green-600/20 to-emerald-600/10"
                onClick={onShowSslInfo}
            />
        </div>
    </div>
);

// (CreateUserView removed and replaced by CreateUserModal)

const UserListView = ({ users, mode = 'view', token, avatarKey, onSetAvatarKey, onLoadUsers, onSetView, onSetConfirmData, onSetEditingUser, onSetShowQrFor, onSetShowHistoryFor, onSetShowScanner, searchQuery, onSetSearchQuery, onSetShowCreateUser }) => {
    const handleAvatarUpload = async (userId, e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            await api.uploadAvatar(token, userId, file);
            alert('Avatar hochgeladen!');
            onSetAvatarKey(Date.now());
            onLoadUsers();
        } catch (err) {
            alert(err.message);
        }
    };

    const filteredUsers = users.filter(u =>
        u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.id.toString().includes(searchQuery)
    );

    return (
        <div className="max-w-4xl mx-auto w-full px-4 animate-fade-in-up">
            <Header title={mode === 'edit' ? 'Benutzer verwalten' : 'Spieler Übersicht'} onBack={() => onSetView('menu')} />

            {/* Search, Add & Scan Bar */}
            <div className="mb-8 flex gap-3">
                <div className="relative flex-1 group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-neutral-500 group-focus-within:text-yellow-500 transition-colors">
                        🔍
                    </div>
                    <input
                        type="text"
                        placeholder="Spieler suchen (Name oder ID)..."
                        className="w-full bg-neutral-900/50 border border-white/5 p-4 pl-12 rounded-2xl text-white outline-none focus:ring-1 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all placeholder:text-neutral-600 font-medium"
                        value={searchQuery}
                        onChange={(e) => onSetSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button
                            onClick={() => onSetSearchQuery('')}
                            className="absolute inset-y-0 right-0 pr-4 flex items-center text-neutral-500 hover:text-white transition-colors"
                        >
                            ✕
                        </button>
                    )}
                </div>
                <button
                    onClick={() => onSetShowCreateUser(true)}
                    className="w-14 h-14 flex items-center justify-center bg-green-500 text-white rounded-2xl hover:bg-green-400 transition-all active:scale-95 shadow-lg shadow-green-900/20"
                    title="Neuen Spieler anlegen"
                >
                    <span className="text-2xl">➕</span>
                </button>
                <button
                    onClick={() => onSetShowScanner(true)}
                    className="w-14 h-14 flex items-center justify-center bg-yellow-500 text-black rounded-2xl hover:bg-yellow-400 transition-all active:scale-95 shadow-lg shadow-yellow-900/20"
                    title="QR Code scannen"
                >
                    <span className="text-2xl">📷</span>
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredUsers.map(u => (
                    <div key={u.id} className="glass-card rounded-2xl p-5 flex flex-col gap-4 relative overflow-hidden">
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-full overflow-hidden bg-neutral-900 border-2 border-yellow-500/30">
                                    <img
                                        src={u.avatarUrl?.startsWith('http') ? `${u.avatarUrl}?t=${avatarKey}` : u.avatarUrl ? `${API_BASE_URL.replace('/api', '')}${u.avatarUrl}?t=${avatarKey}` : DEFAULT_AVATAR_URL}
                                        alt={u.username}
                                        className="w-full h-full object-cover"
                                        onError={(e) => e.target.src = DEFAULT_AVATAR_URL}
                                    />
                                </div>
                                <div>
                                    <div className="font-bold text-lg text-white">{u.username}</div>
                                    <div className="text-sm text-yellow-500 font-mono font-bold">{u.balance.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</div>
                                    <div className="text-[10px] text-neutral-500 uppercase tracking-widest mt-1">ID: {u.id}</div>
                                    <div className="mt-2 flex flex-wrap gap-1">
                                        {getUserPermissions(u).map((permission) => (
                                            <span key={permission} className="px-2 py-0.5 rounded-full bg-white/5 text-[10px] uppercase tracking-widest text-neutral-300">
                                                {permission}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2 mt-2 pt-4 border-t border-white/5">
                            {mode === 'view' ? (
                                <>
                                    <ActionButton onClick={() => onSetShowQrFor(u)} icon="📱" label="QR Code" />
                                    <ActionButton onClick={() => onSetShowHistoryFor(u)} icon="📜" label="History" />
                                </>
                            ) : (
                                <>
                                    <ActionButton onClick={() => onSetShowQrFor(u)} icon="📱" label="QR Code" />
                                    <ActionButton onClick={() => onSetShowHistoryFor(u)} icon="📜" label="History" />
                                    <ActionButton onClick={() => onSetEditingUser(u)} icon="✏️" label="Editer" color="text-yellow-400 bg-yellow-400/10" />
                                    <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-400/10 text-blue-400 text-xs font-bold border border-blue-400/20 cursor-pointer hover:bg-blue-400/20 transition-colors">
                                        📷 Avatar
                                        <input type="file" className="hidden" accept="image/*" onChange={(e) => handleAvatarUpload(u.id, e)} />
                                    </label>
                                    <ActionButton
                                        onClick={() => onSetConfirmData({
                                            title: 'User Reset',
                                            message: `${u.username} bankrott erklären?\n\nAlle Transaktionen werden gelöscht und der User erhält 10.000€ Startkapital.`,
                                            icon: '💀',
                                            onConfirm: async () => {
                                                try {
                                                    await api.declareBankruptcy(token, u.id);
                                                    onLoadUsers();
                                                } catch (err) {
                                                    alert('Fehler: ' + err.message);
                                                }
                                            }
                                        })}
                                        icon="💀"
                                        label="Reset"
                                        color="text-neutral-400 bg-neutral-400/10"
                                    />
                                    <ActionButton
                                        onClick={() => onSetConfirmData({
                                            title: 'User Löschen',
                                            message: `User ${u.username} wirklich unwiderruflich LÖSCHEN? Dieser Vorgang kann nicht rückgängig gemacht werden.`,
                                            icon: '🗑️',
                                            confirmLabel: 'Endgültig Löschen',
                                            isDanger: true,
                                            onConfirm: async () => {
                                                try {
                                                    await api.deleteUser(token, u.id);
                                                    onLoadUsers();
                                                } catch (err) {
                                                    alert('Fehler: ' + err.message);
                                                }
                                            }
                                        })}
                                        icon="🗑️"
                                        label="Löschen"
                                        color="text-red-400 bg-red-400/10"
                                    />
                                </>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// (CreateDealerView removed and replaced by CreateDealerModal)

const DealerListView = ({ dealers, token, onLoadDealers, onSetView, onSetConfirmData, onSetShowCreateDealer, dealerSearchQuery, onSetDealerSearchQuery, onSetEditingDealer }) => {
    const filteredDealers = dealers.filter(d =>
        d.name.toLowerCase().includes(dealerSearchQuery.toLowerCase()) ||
        d.id.toString().includes(dealerSearchQuery)
    );

    return (
        <div className="max-w-2xl mx-auto w-full px-4 animate-fade-in-up">
            <Header title="Dealer Übersicht" onBack={() => onSetView('menu')} />

            {/* Search & Add Bar */}
            <div className="mb-8 flex gap-3">
                <div className="relative flex-1 group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-neutral-500 group-focus-within:text-orange-500 transition-colors">
                        🔍
                    </div>
                    <input
                        type="text"
                        placeholder="Dealer suchen (Name oder ID)..."
                        className="w-full bg-neutral-900/50 border border-white/5 p-4 pl-12 rounded-2xl text-white outline-none focus:ring-1 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all placeholder:text-neutral-600 font-medium"
                        value={dealerSearchQuery}
                        onChange={(e) => onSetDealerSearchQuery(e.target.value)}
                    />
                    {dealerSearchQuery && (
                        <button
                            onClick={() => onSetDealerSearchQuery('')}
                            className="absolute inset-y-0 right-0 pr-4 flex items-center text-neutral-500 hover:text-white transition-colors"
                        >
                            ✕
                        </button>
                    )}
                </div>
                <button
                    onClick={() => onSetShowCreateDealer(true)}
                    className="w-14 h-14 flex items-center justify-center bg-orange-500 text-black rounded-2xl hover:bg-orange-400 transition-all active:scale-95 shadow-lg shadow-orange-900/20"
                    title="Neuen Dealer anlegen"
                >
                    <span className="text-2xl">➕</span>
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredDealers.map(d => (
                    <div key={d.id} className="glass-card rounded-2xl p-6 flex justify-between items-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5">
                            <span className="text-4xl text-white">🕴️</span>
                        </div>
                        <div className="relative z-10">
                            <div className="font-bold text-lg text-white">{d.name}</div>
                            <div className="text-[10px] text-neutral-500 uppercase tracking-widest mt-1">Dealer ID: {d.id}</div>
                        </div>
                        <div className="flex gap-2 relative z-10">
                            <button
                                onClick={() => onSetEditingDealer(d)}
                                className="w-10 h-10 flex items-center justify-center bg-yellow-400/10 text-yellow-500 rounded-xl hover:bg-yellow-400/20 transition-colors"
                            >
                                ✏️
                            </button>
                            <button
                                onClick={() => onSetConfirmData({
                                    title: 'Dealer Löschen',
                                    message: `Dealer ${d.name} wirklich ENTFERNEN?`,
                                    icon: '🕴️',
                                    isDanger: true,
                                    onConfirm: () => api.deleteDealer(token, d.id).then(onLoadDealers)
                                })}
                                className="w-10 h-10 flex items-center justify-center bg-red-400/10 text-red-500 rounded-xl hover:bg-red-400/20 transition-colors"
                            >
                                🗑️
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const GameSettingsView = ({ gameSettings, onSetView, onToggleGame }) => (
    <div className="max-w-2xl mx-auto w-full px-4 animate-fade-in-up">
        <Header title="Spiele & Systemsteuerung" onBack={() => onSetView('menu')} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {gameSettings.map(game => (
                <div
                    key={game.gameKey}
                    onClick={() => onToggleGame(game.gameKey, !game.isEnabled)}
                    className={`glass-card rounded-2xl p-6 cursor-pointer border-l-4 transition-all ${game.isEnabled ? 'border-l-green-500' : 'border-l-red-500'}`}
                >
                    <div className="flex justify-between items-center">
                        <div>
                            <div className="font-bold text-lg text-white">{game.gameName}</div>
                            <div className="text-[10px] text-neutral-500 uppercase tracking-widest">{game.gameKey}</div>
                        </div>
                        <div className={`relative w-12 h-6 rounded-full transition-colors ${game.isEnabled ? 'bg-green-500' : 'bg-neutral-800'}`}>
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${game.isEnabled ? 'translate-x-7' : 'translate-x-1'}`} />
                        </div>
                    </div>
                </div>
            ))}
        </div>
        <div className="mt-8 glass-card p-4 rounded-xl text-center border border-white/5">
            <p className="text-neutral-500 text-sm">
                ⚠️ Deaktivierte Features werden sofort für alle Spieler ausgeblendet.
            </p>
        </div>
    </div>
);

const StatsView = ({ token, refreshKey, onSetView }) => (
    <div className="w-full max-w-6xl mx-auto px-4 animate-fade-in-up">
        <Header title="System Analyse" onBack={() => onSetView('menu')} />
        <div className="space-y-8 pb-12">
            <StatsWidgets token={token} onRefresh={refreshKey} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <StatsCharts token={token} onRefresh={refreshKey} />
                <ActiveTables token={token} onRefresh={refreshKey} />
            </div>
            <TopPlayersTable token={token} onRefresh={refreshKey} />
        </div>
    </div>
);

export default function AdminDashboard() {
    const navigate = useNavigate();
    const [view, setView] = useState(localStorage.getItem('admin_view') || 'menu');
    const [loading, setLoading] = useState(false);

    // Data State
    const [users, setUsers] = useState([]);
    const [dealers, setDealers] = useState([]);
    const [gameSettings, setGameSettings] = useState([]);
    const [avatarKey, setAvatarKey] = useState(Date.now()); // Force refresh für Avatar-Bilder
    const [statsRefreshKey, setStatsRefreshKey] = useState(0);
    const [confirmData, setConfirmData] = useState(null); // { title: string, message: string, onConfirm: function }

    // Modal States
    const [editingUser, setEditingUser] = useState(null);
    const [editingDealer, setEditingDealer] = useState(null);
    const [showQrFor, setShowQrFor] = useState(null);
    const [showHistoryFor, setShowHistoryFor] = useState(null);
    const [showScanner, setShowScanner] = useState(false);
    const [showCreateUser, setShowCreateUser] = useState(false);
    const [showCreateDealer, setShowCreateDealer] = useState(false);
    const [showSslModal, setShowSslModal] = useState(false);
    const [sslInfo, setSslInfo] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [dealerSearchQuery, setDealerSearchQuery] = useState('');

    const connectionRef = useRef(null);

    const token = localStorage.getItem('token');

    const handleQrScan = async (scannedValue) => {
        setShowScanner(false);
        // Try to find user by ID or username in the local list first
        const found = users.find(u =>
            u.id.toString() === scannedValue ||
            u.username.toLowerCase() === scannedValue.toLowerCase() ||
            u.qrCodeUuid === scannedValue
        );

        if (found) {
            setSearchQuery(found.username);
            if (view === 'editUser') {
                setEditingUser(found);
            }
        } else {
            // If not found locally, try to fetch from API
            try {
                const user = await api.getUserByQr(scannedValue); // Assumes this endpoint exists and takes QR UUID
                if (user) {
                    setSearchQuery(user.username);
                    if (view === 'editUser') setEditingUser(user);
                } else {
                    alert('Spieler nicht gefunden: ' + scannedValue);
                }
            } catch (err) {
                // Last fallback: just set search query to whatever was scanned
                setSearchQuery(scannedValue);
            }
        }
    };

    useEffect(() => {
        localStorage.setItem('admin_view', view);
    }, [view]);

    useEffect(() => {
        if (view === 'userList' || view === 'editUser') loadUsers();
        if (view === 'gameSettings') loadGameSettings();
    }, [view, token]); // Re-load if view or token changes

    useEffect(() => {
        // Basic auth check
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (!token || !hasPermission(user, 'ADMIN')) {
            navigate('/admin');
        }

        // Setup WebSocket connection - safely build hub URL
        const baseUrl = new URL(API_BASE_URL);
        baseUrl.pathname = '/hubs/stats';
        const hubUrl = baseUrl.toString();

        const connection = new signalR.HubConnectionBuilder()
            .withUrl(hubUrl)
            .withAutomaticReconnect()
            .build();

        connection.on('StatsUpdated', () => {
            setStatsRefreshKey(prev => prev + 1);
        });

        connection.on('TableUpdated', () => {
            setStatsRefreshKey(prev => prev + 1);
        });

        connection.start()
            .then(() => connection.invoke('JoinStatsChannel'))
            .catch(err => console.error('SignalR Error:', err));

        connectionRef.current = connection;

        return () => {
            if (connectionRef.current) {
                connectionRef.current.stop();
            }
        };
    }, [navigate, token]);

    // Data Loaders
    const loadUsers = async () => {
        try {
            const data = await api.getUsers(token);
            setUsers(data);
        } catch (e) {
            console.error(e);
        }
    };

    const loadDealers = async () => {
        try {
            const data = await api.getDealers(token);
            setDealers(data);
        } catch (e) {
            console.error(e);
        }
    };

    const loadGameSettings = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/gamesettings`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setGameSettings(data);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const toggleGame = async (gameKey, isEnabled) => {
        try {
            const response = await fetch(`${API_BASE_URL}/gamesettings/${gameKey}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ isEnabled })
            });
            if (response.ok) {
                loadGameSettings();
            } else {
                alert('Fehler: ' + response.status);
            }
        } catch (e) {
            alert('Fehler: ' + e.message);
        }
    };

    const handleShowSslInfo = async () => {
        try {
            const data = await api.getSslCertificate(token);
            setSslInfo(data);
            setShowSslModal(true);
        } catch (e) {
            alert('SSL-Info konnte nicht geladen werden: ' + e.message);
        }
    };

    return (
        <div className="min-h-screen bg-neutral-950 flex flex-col relative overflow-hidden text-white font-sans">
            {/* Background Effects matching HomePage */}
            <div className="fixed inset-0 bg-grid opacity-50 z-0" />
            <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[700px] bg-gradient-radial from-yellow-500/10 via-transparent to-transparent rounded-full blur-3xl pointer-events-none z-0" />
            <div className="fixed bottom-0 right-0 w-[500px] h-[500px] bg-gradient-radial from-purple-500/5 via-transparent to-transparent rounded-full blur-3xl pointer-events-none z-0" />

            {/* Scrollable Content */}
            <div className="relative z-10 flex-1 overflow-y-auto px-4 py-12 flex flex-col items-center">
                {view === 'menu' && <Menu onSetView={setView} onLoadUsers={loadUsers} onLoadGameSettings={loadGameSettings} onShowSslInfo={handleShowSslInfo} navigate={navigate} />}
                {view === 'stats' && <StatsView token={token} refreshKey={statsRefreshKey} onSetView={setView} />}
                {view === 'userList' && <UserListView users={users} mode="view" token={token} avatarKey={avatarKey} onSetAvatarKey={setAvatarKey} onLoadUsers={loadUsers} onSetView={setView} onSetConfirmData={setConfirmData} onSetEditingUser={setEditingUser} onSetShowQrFor={setShowQrFor} onSetShowHistoryFor={setShowHistoryFor} onSetShowScanner={setShowScanner} searchQuery={searchQuery} onSetSearchQuery={setSearchQuery} onSetShowCreateUser={setShowCreateUser} />}
                {view === 'editUser' && <UserListView users={users} mode="edit" token={token} avatarKey={avatarKey} onSetAvatarKey={setAvatarKey} onLoadUsers={loadUsers} onSetView={setView} onSetConfirmData={setConfirmData} onSetEditingUser={setEditingUser} onSetShowQrFor={setShowQrFor} onSetShowHistoryFor={setShowHistoryFor} onSetShowScanner={setShowScanner} searchQuery={searchQuery} onSetSearchQuery={setSearchQuery} onSetShowCreateUser={setShowCreateUser} />}
                {view === 'editDealer' && <DealerListView dealers={dealers} token={token} onLoadDealers={loadDealers} onSetView={setView} onSetConfirmData={setConfirmData} onSetShowCreateDealer={setShowCreateDealer} dealerSearchQuery={dealerSearchQuery} onSetDealerSearchQuery={setDealerSearchQuery} onSetEditingDealer={setEditingDealer} />}
                {view === 'gameSettings' && <GameSettingsView gameSettings={gameSettings} onSetView={setView} onToggleGame={toggleGame} />}
            </div>

            {editingUser && (
                <EditUserModal user={editingUser} onClose={() => setEditingUser(null)} onSuccess={() => { loadUsers(); setEditingUser(null); }} />
            )}
            {editingDealer && (
                <EditDealerModal dealer={editingDealer} onClose={() => setEditingDealer(null)} onSuccess={() => { loadDealers(); setEditingDealer(null); }} />
            )}
            {showQrFor && <QrCodeModal user={showQrFor} onClose={() => setShowQrFor(null)} />}
            {showHistoryFor && (
                <TransactionHistory userId={showHistoryFor.id} username={showHistoryFor.username} onClose={() => setShowHistoryFor(null)} />
            )}
            {showScanner && (
                <QRScanner onScanSuccess={handleQrScan} onClose={() => setShowScanner(false)} />
            )}
            {showCreateUser && (
                <CreateUserModal onClose={() => setShowCreateUser(false)} onSuccess={() => { loadUsers(); setShowCreateUser(false); }} />
            )}
            {showCreateDealer && (
                <CreateDealerModal onClose={() => setShowCreateDealer(false)} onSuccess={() => { loadDealers(); setShowCreateDealer(false); }} />
            )}

            {showSslModal && sslInfo && (
                <SslCertificateModal sslInfo={sslInfo} onClose={() => setShowSslModal(false)} />
            )}

            {confirmData && (
                <ConfirmModal
                    title={confirmData.title}
                    message={confirmData.message}
                    icon={confirmData.icon}
                    confirmLabel={confirmData.confirmLabel}
                    isDanger={confirmData.isDanger}
                    onConfirm={() => { confirmData.onConfirm(); setConfirmData(null); }}
                    onCancel={() => setConfirmData(null)}
                />
            )}

            {/* Minimal Footer */}
            <footer className="relative z-10 py-6 text-center text-neutral-600 text-[10px] uppercase tracking-[0.2em]">
                mikesbar.eu &bull; &copy; 2025
            </footer>
        </div>
    );
}

// --- Specialized UI Components ---

const MenuButton = ({ icon, label, description, color, onClick }) => (
    <button onClick={onClick} className={`relative overflow-hidden glass-card rounded-2xl p-1 text-left active:scale-95 transition-all group`}>
        <div className={`p-6 sm:p-8 h-full flex flex-col gap-4 relative z-10`}>
            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                <span className="text-3xl">{icon}</span>
            </div>
            <div>
                <h3 className="text-lg font-bold text-white group-hover:text-yellow-400 transition-colors uppercase tracking-tight">
                    {label}
                </h3>
                <p className="text-xs text-neutral-500 mt-1 line-clamp-1">
                    {description}
                </p>
            </div>
        </div>
        <div className={`absolute bottom-0 right-0 translate-x-1/4 translate-y-1/4 w-32 h-32 bg-gradient-to-br ${color} opacity-10 rounded-full blur-2xl group-hover:opacity-20 transition-opacity`} />
    </button>
);

const Header = ({ title, onBack }) => (
    <div className="flex items-center gap-6 mb-12 border-b border-white/5 pb-6">
        <button onClick={onBack} className="w-12 h-12 flex items-center justify-center bg-neutral-900 border border-white/10 rounded-2xl hover:bg-neutral-800 hover:border-yellow-500/50 transition-all text-sm group">
            <span className="group-hover:-translate-x-1 transition-transform">⬅️</span>
        </button>
        <div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight">{title}</h2>
            <div className="h-0.5 w-12 bg-yellow-500 mt-1" />
        </div>
    </div>
);

const ActionButton = ({ icon, label, onClick, color = "text-neutral-400 bg-white/5" }) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${color} text-xs font-bold border border-white/5 hover:border-white/20 transition-all active:scale-95`}
    >
        <span>{icon}</span> {label}
    </button>
);

const Input = ({ label, type = "text", value, onChange, placeholder }) => (
    <div className="space-y-1.5 w-full">
        <label className="block text-[10px] uppercase tracking-widest text-neutral-500 font-bold ml-1">{label}</label>
        <input
            type={type}
            className="w-full glass-card border-none bg-black/40 p-4 rounded-xl text-white focus:ring-1 focus:ring-yellow-500/50 outline-none transition-all placeholder:text-neutral-700 font-medium"
            value={value}
            onChange={e => onChange(e.target.value)}
            required={!placeholder}
            placeholder={placeholder}
        />
    </div>
);

const Button = ({ label, onClick }) => (
    <button
        type="submit"
        onClick={onClick}
        className="w-full py-4 bg-gradient-to-r from-yellow-500 to-amber-600 text-black font-black uppercase tracking-widest text-sm rounded-xl hover:from-yellow-400 hover:to-amber-500 transition-all shadow-lg shadow-yellow-900/20 active:scale-[0.98] mt-4"
    >
        {label}
    </button>
);

const EditDealerModal = ({ dealer, onClose, onSuccess }) => {
    const [name, setName] = useState(dealer.name);
    const [pin, setPin] = useState('');
    const token = localStorage.getItem('token');

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.updateDealer(token, dealer.id, { name, pin: pin || undefined });
            alert('Dealer aktualisiert!');
            onSuccess();
        } catch (err) {
            alert(err.message);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-md glass-card p-8 rounded-[2rem] relative overflow-hidden border border-white/10 shadow-[0_0_150px_rgba(0,0,0,0.9)] animate-fade-in-scale">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-black text-white uppercase tracking-tight">Dealer bearbeiten</h2>
                    <button onClick={onClose} className="p-2 bg-white/5 rounded-xl text-neutral-400 hover:text-white transition-colors">✕</button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                        <span className="text-8xl text-white">✏️</span>
                    </div>

                    <Input label="Dealer Name" value={name} onChange={setName} />
                    <Input label="PIN (Leer lassen zum Beibehalten)" value={pin} onChange={setPin} placeholder="••••" />

                    <Button label="Änderungen Speichern" />
                </form>
            </div>
        </div>
    );
};

const CreateUserModal = ({ onClose, onSuccess }) => {
    const [username, setUsername] = useState('');
    const [pin, setPin] = useState('');
    const [hasDealerAccess, setHasDealerAccess] = useState(false);
    const [hasAdminAccess, setHasAdminAccess] = useState(false);
    const token = localStorage.getItem('token');

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const permissionGroups = ['PLAYER'];
            if (hasDealerAccess) permissionGroups.push('DEALER');
            if (hasAdminAccess) permissionGroups.push('ADMIN');
            await api.createUser(token, username, pin, permissionGroups);
            alert('User angelegt! (Startguthaben: 10.000€)');
            onSuccess();
        } catch (err) {
            alert(err.message);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-md glass-card p-8 rounded-[2rem] relative overflow-hidden border border-white/10 shadow-[0_0_150px_rgba(0,0,0,0.9)] animate-fade-in-scale">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-black text-white uppercase tracking-tight">Neuen Spieler anlegen</h2>
                    <button onClick={onClose} className="p-2 bg-white/5 rounded-xl text-neutral-400 hover:text-white transition-colors">✕</button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                        <span className="text-8xl text-white">➕</span>
                    </div>

                    <Input label="Username" value={username} onChange={setUsername} />
                    <Input label="PIN (4-8 Stellen)" value={pin} onChange={setPin} />

                    <div className="space-y-3">
                        <PermissionToggle label="Dealer Zugriff" active={hasDealerAccess} onToggle={() => setHasDealerAccess(!hasDealerAccess)} />
                        <PermissionToggle label="Admin Zugriff" active={hasAdminAccess} onToggle={() => setHasAdminAccess(!hasAdminAccess)} />
                    </div>

                    <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                        <p className="text-yellow-400 text-xs font-medium text-center">✨ Startguthaben: 10.000,00 €</p>
                    </div>

                    <Button label="Spieler Konto Erstellen" />
                </form>
            </div>
        </div>
    );
};

const CreateDealerModal = ({ onClose, onSuccess }) => {
    const [name, setName] = useState('');
    const [pin, setPin] = useState('');
    const token = localStorage.getItem('token');

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.createDealer(token, name, pin);
            alert('Dealer angelegt!');
            onSuccess();
        } catch (err) {
            alert(err.message);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-md glass-card p-8 rounded-[2rem] relative overflow-hidden border border-white/10 shadow-[0_0_150px_rgba(0,0,0,0.9)] animate-fade-in-scale">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-black text-white uppercase tracking-tight">Neuen Dealer anlegen</h2>
                    <button onClick={onClose} className="p-2 bg-white/5 rounded-xl text-neutral-400 hover:text-white transition-colors">✕</button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                        <span className="text-8xl text-white">🕴️</span>
                    </div>

                    <Input label="Dealer Name" value={name} onChange={setName} />
                    <Input label="System PIN" value={pin} onChange={setPin} />

                    <Button label="Dealer Account Erstellen" />
                </form>
            </div>
        </div>
    );
};

const EditUserModal = ({ user, onClose, onSuccess }) => {
    const [username, setUsername] = useState(user.username);
    const [balance, setBalance] = useState(user.balance);
    const [pin, setPin] = useState('');
    const [hasFotoboxAccess, setHasFotoboxAccess] = useState(user.hasFotoboxAccess || false);
    const initialPermissions = getUserPermissions(user);
    const [hasDealerAccess, setHasDealerAccess] = useState(initialPermissions.includes('DEALER'));
    const [hasAdminAccess, setHasAdminAccess] = useState(initialPermissions.includes('ADMIN'));

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const permissionGroups = ['PLAYER'];
            if (hasDealerAccess) permissionGroups.push('DEALER');
            if (hasAdminAccess) permissionGroups.push('ADMIN');
            await api.updateUser(localStorage.getItem('token'), user.id, {
                username,
                balance: Number(balance),
                pin: pin || undefined,
                hasFotoboxAccess,
                permissionGroups
            });
            onSuccess();
        } catch (err) {
            alert('Fehler: ' + err.message);
        }
    };

    return (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-[100] animate-fade-in-scale">
            <div className="bg-neutral-950 p-8 rounded-3xl w-full max-w-md border border-white/10 relative shadow-[0_0_150px_rgba(0,0,0,0.8)]">
                <div className="absolute top-0 right-0 p-6 opacity-10">
                    <span className="text-6xl text-white">✏️</span>
                </div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-8">User Editieren</h2>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <Input label="Name" value={username} onChange={setUsername} />
                    <Input label="Neuer PIN (Optional)" value={pin} onChange={setPin} placeholder="4-8 Stellen oder leer lassen" />
                    <Input label="Guthaben [€]" value={balance} onChange={setBalance} type="number" />

                    <div className="space-y-3">
                        <PermissionToggle label="Dealer Zugriff" active={hasDealerAccess} onToggle={() => setHasDealerAccess(!hasDealerAccess)} />
                        <PermissionToggle label="Admin Zugriff" active={hasAdminAccess} onToggle={() => setHasAdminAccess(!hasAdminAccess)} />
                    </div>

                    {/* Fotobox Access Toggle */}
                    <div className="flex items-center justify-between p-4 bg-black/40 rounded-xl border border-white/5">
                        <div>
                            <div className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold">Fotobox Zugang</div>
                            <div className="text-xs text-neutral-400 mt-1">Spezielle Berechtigung für Fotobox</div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setHasFotoboxAccess(!hasFotoboxAccess)}
                            className={`relative w-12 h-6 rounded-full transition-colors ${hasFotoboxAccess ? 'bg-green-500' : 'bg-neutral-800'}`}
                        >
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${hasFotoboxAccess ? 'translate-x-7' : 'translate-x-1'}`} />
                        </button>
                    </div>

                    <div className="flex gap-4 mt-8">
                        <button type="button" onClick={onClose} className="flex-1 py-4 bg-neutral-800 text-neutral-400 rounded-xl font-bold hover:bg-neutral-700 transition-colors">Abbrechen</button>
                        <button type="submit" className="flex-1 py-4 bg-yellow-500 text-black rounded-xl font-black uppercase tracking-widest text-xs hover:bg-yellow-400 transition-colors">Sichern</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const QrCodeModal = ({ user, onClose }) => (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-[100] animate-fade-in-scale" onClick={onClose}>
        <div className="bg-white p-8 rounded-[2rem] flex flex-col items-center gap-6 shadow-[0_0_100px_rgba(0,0,0,0.5)]" onClick={e => e.stopPropagation()}>
            <div className="text-center">
                <h2 className="text-black font-black text-2xl uppercase tracking-tight">{user.username}</h2>
                <p className="text-neutral-400 text-[10px] tracking-widest uppercase mt-1">Personal Pass Key</p>
            </div>
            <div className="p-4 bg-neutral-50 rounded-2xl">
                <QRCode
                    size={220}
                    style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                    value={user.qrCodeUuid || 'NO_UUID'}
                    viewBox={`0 0 256 256`}
                    fgColor="#000"
                />
            </div>
            <button onClick={onClose} className="w-full py-4 bg-neutral-900 text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-black transition-colors">
                Schließen
            </button>
        </div>
    </div>
);

const PermissionToggle = ({ label, active, onToggle }) => (
    <div className="flex items-center justify-between p-4 bg-black/40 rounded-xl border border-white/5">
        <div className="text-sm text-neutral-300">{label}</div>
        <button
            type="button"
            onClick={onToggle}
            className={`relative w-12 h-6 rounded-full transition-colors ${active ? 'bg-green-500' : 'bg-neutral-800'}`}
        >
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${active ? 'translate-x-7' : 'translate-x-1'}`} />
        </button>
    </div>
);

const ConfirmModal = ({ title, message, icon, onConfirm, onCancel, confirmLabel = 'Bestätigen', isDanger = false }) => (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-[110] animate-fade-in-scale">
        <div className="bg-neutral-950 p-8 rounded-3xl w-full max-w-sm border border-white/10 relative shadow-[0_0_150px_rgba(0,0,0,0.8)] text-center">
            <div className="w-20 h-20 bg-neutral-900 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-white/5">
                <span className="text-4xl">{icon || '⚠️'}</span>
            </div>
            <h2 className="text-xl font-black text-white uppercase tracking-tight mb-2">{title}</h2>
            <p className="text-neutral-400 text-sm mb-8 whitespace-pre-wrap leading-relaxed">
                {message}
            </p>
            <div className="flex gap-3">
                <button onClick={onCancel} className="flex-1 py-4 bg-neutral-900 text-neutral-400 rounded-xl font-bold hover:bg-neutral-800 transition-colors text-xs uppercase tracking-widest">
                    Abbrechen
                </button>
                <button
                    onClick={onConfirm}
                    className={`flex-1 py-4 rounded-xl font-black uppercase tracking-widest text-xs transition-colors ${isDanger
                        ? 'bg-red-500 text-white hover:bg-red-600'
                        : 'bg-yellow-500 text-black hover:bg-yellow-400'
                        }`}
                >
                    {confirmLabel}
                </button>
            </div>
        </div>
    </div>
);

const SslCertificateModal = ({ sslInfo, onClose }) => {
    const getStatusColor = (status) => {
        switch (status) {
            case 'Valid': return 'text-green-500 bg-green-500/10 border-green-500/30';
            case 'Warning': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30';
            case 'Critical': return 'text-red-500 bg-red-500/10 border-red-500/30';
            case 'Expired': return 'text-red-600 bg-red-600/10 border-red-600/30';
            default: return 'text-neutral-400 bg-neutral-500/10 border-neutral-500/30';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'Valid': return '✅';
            case 'Warning': return '⚠️';
            case 'Critical': return '🚨';
            case 'Expired': return '❌';
            default: return '❓';
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-[100] animate-fade-in-scale" onClick={onClose}>
            <div className="bg-neutral-950 p-8 rounded-3xl w-full max-w-md border border-white/10 relative shadow-[0_0_150px_rgba(0,0,0,0.8)]" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-green-500/20 to-emerald-600/10 rounded-2xl flex items-center justify-center border border-green-500/20">
                        <span className="text-3xl">🔐</span>
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-white uppercase tracking-tight">SSL Zertifikat</h2>
                        <p className="text-neutral-500 text-xs uppercase tracking-widest mt-1">WIN-ACME / Let's Encrypt</p>
                    </div>
                </div>

                {/* Status Badge */}
                <div className={`flex items-center justify-center gap-3 p-4 rounded-2xl border mb-6 ${getStatusColor(sslInfo.status)}`}>
                    <span className="text-2xl">{getStatusIcon(sslInfo.status)}</span>
                    <div className="text-center">
                        <div className="font-black text-lg uppercase tracking-tight">{sslInfo.status || 'Unbekannt'}</div>
                        <div className="text-xs opacity-75">{sslInfo.daysRemaining} Tage verbleibend</div>
                    </div>
                </div>

                {/* Certificate Details */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-black/40 rounded-xl border border-white/5">
                        <span className="text-neutral-500 text-xs uppercase tracking-widest">Domain</span>
                        <span className="text-white font-mono text-sm">{sslInfo.subject || '-'}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-black/40 rounded-xl border border-white/5">
                        <span className="text-neutral-500 text-xs uppercase tracking-widest">Aussteller</span>
                        <span className="text-white font-mono text-sm">{sslInfo.issuer || '-'}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-black/40 rounded-xl border border-white/5">
                        <span className="text-neutral-500 text-xs uppercase tracking-widest">Gültig ab</span>
                        <span className="text-white font-mono text-sm">{formatDate(sslInfo.validFrom)}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-black/40 rounded-xl border border-white/5">
                        <span className="text-neutral-500 text-xs uppercase tracking-widest">Gültig bis</span>
                        <span className="text-white font-mono text-sm">{formatDate(sslInfo.validTo)}</span>
                    </div>
                    {sslInfo.thumbprint && (
                        <div className="p-3 bg-black/40 rounded-xl border border-white/5">
                            <span className="text-neutral-500 text-xs uppercase tracking-widest block mb-2">Thumbprint</span>
                            <span className="text-white font-mono text-[10px] break-all">{sslInfo.thumbprint}</span>
                        </div>
                    )}
                </div>

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="w-full mt-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-black uppercase tracking-widest text-xs rounded-xl hover:from-green-400 hover:to-emerald-500 transition-all shadow-lg shadow-green-900/20"
                >
                    Schließen
                </button>
            </div>
        </div>
    );
};
