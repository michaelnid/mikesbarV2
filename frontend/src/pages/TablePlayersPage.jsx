import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Html5Qrcode } from 'html5-qrcode';
import { DEFAULT_AVATAR_URL } from '../constants/assets';

export default function TablePlayersPage() {
    const navigate = useNavigate();
    const [players, setPlayers] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [scanning, setScanning] = useState(false);
    const [loading, setLoading] = useState(true);
    const html5QrCodeRef = useRef(null);

    const token = localStorage.getItem('dealer_token');
    const dealer = JSON.parse(localStorage.getItem('dealer') || '{}');
    const selectedGame = localStorage.getItem('selected_game') || 'bank';
    const selectedGameName = localStorage.getItem('selected_game_name') || (selectedGame === 'bank' ? 'Bank' : selectedGame);

    useEffect(() => {
        if (!token) {
            navigate('/dealer');
            return;
        }

        // Verify session on load
        verifySession();

        // Verify session every 30 seconds
        const interval = setInterval(verifySession, 30000);

        loadPlayers();
        loadAllUsers();
        setGameOnServer();

        return () => clearInterval(interval);
    }, []);

    const verifySession = async () => {
        try {
            await api.verifyDealerSession(token);
        } catch (err) {
            // Session invalid - logout
            alert(err.message || 'Session abgelaufen');
            localStorage.removeItem('dealer_token');
            localStorage.removeItem('dealer');
            navigate('/dealer');
        }
    };

    const setGameOnServer = async () => {
        try {
            await api.setTableGame(token, selectedGame);
        } catch (err) {
            console.error('Failed to set game:', err);
        }
    };

    const loadPlayers = async () => {
        try {
            const data = await api.getTablePlayers(token);
            setPlayers(data);
        } catch (err) {
            console.error('Failed to load players:', err);
        } finally {
            setLoading(false);
        }
    };

    const loadAllUsers = async () => {
        try {
            const data = await api.getLeaderboard();
            setAllUsers(data || []);
        } catch (err) {
            console.error('Failed to load users:', err);
        }
    };

    // Filter users for search - exclude already seated players
    const filteredUsers = searchQuery.length > 0
        ? allUsers.filter(u =>
            !players.some(p => p.userId === u.id) &&
            (u.username?.toLowerCase().includes(searchQuery.toLowerCase()) || u.id.toString() === searchQuery)
        )
        : [];

    const addPlayerBySearch = async (user) => {
        try {
            await api.joinTable(token, user.id);
            setSearchQuery('');
            loadPlayers();
        } catch (err) {
            alert('Fehler: ' + err.message);
        }
    };

    const startScanner = async () => {
        setScanning(true);
        setTimeout(async () => {
            try {
                const qrReaderElement = document.getElementById("qr-reader");
                if (!qrReaderElement) {
                    setScanning(false);
                    return;
                }
                html5QrCodeRef.current = new Html5Qrcode("qr-reader");
                await html5QrCodeRef.current.start(
                    { facingMode: "environment" },
                    { fps: 10, qrbox: { width: 250, height: 250 } },
                    onScanSuccess,
                    () => { }
                );
            } catch (err) {
                console.error('Scanner error:', err);
                alert('Kamera konnte nicht gestartet werden.');
                setScanning(false);
            }
        }, 100);
    };

    const stopScanner = async () => {
        if (html5QrCodeRef.current) {
            try {
                await html5QrCodeRef.current.stop();
                html5QrCodeRef.current = null;
            } catch (err) {
                console.error('Stop scanner error:', err);
            }
        }
        setScanning(false);
    };

    const onScanSuccess = async (qrCode) => {
        await stopScanner();
        try {
            const user = await api.getUserByQr(qrCode);
            if (!user) {
                alert('QR Code unbekannt');
                return;
            }
            if (players.some(p => p.userId === user.id)) {
                alert(`${user.username} ist bereits am Tisch`);
                return;
            }
            await api.joinTable(token, user.id);
            loadPlayers();
        } catch (err) {
            alert('Fehler: ' + err.message);
        }
    };

    const removePlayer = async (userId) => {
        if (!confirm('Spieler vom Tisch entfernen?')) return;
        try {
            await api.leaveTable(token, userId);
            loadPlayers();
        } catch (err) {
            alert('Fehler: ' + err.message);
        }
    };

    const openPlayerBank = (player) => {
        localStorage.setItem('preselected_player', JSON.stringify({
            id: player.userId,
            username: player.username,
            balance: player.balance,
            avatarUrl: player.avatarUrl
        }));
        navigate('/dealer/bank');
    };

    const endSession = async () => {
        if (!confirm('Tisch-Session beenden? Alle Spieler werden entfernt.')) return;
        try {
            await api.endTableSession(token);
            navigate('/dealer/games');
        } catch (err) {
            alert('Fehler: ' + err.message);
        }
    };

    return (
        <div className="h-screen overflow-hidden flex flex-col bg-neutral-950 p-4 w-full max-w-md mx-auto md:border-x md:border-neutral-800">
            {/* Header */}
            <div className="mb-4 pt-6">
                <h1 className="text-xl font-bold text-white">Spieler am Tisch</h1>
                <p className="text-yellow-500 text-sm">{dealer.name} • {selectedGameName}</p>
            </div>

            {/* Search + QR Row */}
            <div className="flex gap-2 mb-4">
                <div className="flex-1 relative">
                    <input
                        type="text"
                        placeholder="Spieler suchen..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-neutral-900 border border-neutral-700 p-3 rounded-xl text-white placeholder-neutral-500 focus:border-yellow-500 outline-none"
                    />
                    {/* Search Results Dropdown */}
                    {filteredUsers.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-neutral-800 border border-neutral-700 rounded-xl overflow-hidden z-10 max-h-48 overflow-y-auto">
                            {filteredUsers.slice(0, 5).map(user => (
                                <button
                                    key={user.id}
                                    onClick={() => addPlayerBySearch(user)}
                                    className="w-full p-3 text-left hover:bg-neutral-700 flex items-center gap-3 border-b border-neutral-700 last:border-0"
                                >
                                    <span className="text-white font-medium">{user.username}</span>
                                    <span className="text-neutral-500 text-sm">({user.balance?.toFixed(2)} €)</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <button
                    onClick={startScanner}
                    className="px-4 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white"
                    title="QR-Code scannen"
                >
                    📷
                </button>
            </div>

            {/* Player List */}
            <div className="flex-1 overflow-auto space-y-3 mb-4">
                {loading ? (
                    <p className="text-neutral-500 text-center py-8">Lade Spieler...</p>
                ) : players.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-neutral-500 text-lg mb-2">Keine Spieler am Tisch</p>
                        <p className="text-neutral-600 text-sm">Suche oder scanne um Spieler hinzuzufügen</p>
                    </div>
                ) : (
                    players.map(player => (
                        <div
                            key={player.userId}
                            className="flex items-center justify-between p-4 bg-neutral-800 rounded-xl border border-neutral-700 cursor-pointer hover:bg-neutral-700 transition-colors"
                            onClick={() => openPlayerBank(player)}
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full overflow-hidden bg-neutral-700">
                                    <img
                                        src={player.avatarUrl || DEFAULT_AVATAR_URL}
                                        alt={player.username}
                                        className="w-full h-full object-cover"
                                        onError={(e) => e.target.src = DEFAULT_AVATAR_URL}
                                    />
                                </div>
                                <div>
                                    <p className="font-bold text-white">{player.username}</p>
                                    <p className="text-sm text-neutral-400">{player.balance?.toFixed(2)} €</p>
                                </div>
                            </div>
                            <button
                                onClick={(e) => { e.stopPropagation(); removePlayer(player.userId); }}
                                className="p-3 bg-red-900/50 text-red-400 rounded-lg hover:bg-red-900"
                            >
                                ✕
                            </button>
                        </div>
                    ))
                )}
            </div>

            {/* QR Scanner Modal */}
            {scanning && (
                <div className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center p-4">
                    <div className="w-full max-w-sm">
                        <div id="qr-reader" className="rounded-xl overflow-hidden"></div>
                        <button
                            onClick={stopScanner}
                            className="w-full mt-4 py-4 bg-red-600 rounded-xl font-bold text-white"
                        >
                            Abbrechen
                        </button>
                    </div>
                </div>
            )}

            {/* Bottom Action */}
            <div className="pb-4">
                <button
                    onClick={endSession}
                    className="w-full py-3 bg-neutral-800 rounded-xl font-medium text-neutral-400 hover:text-white hover:bg-neutral-700"
                >
                    Session beenden
                </button>
            </div>
        </div>
    );
}
