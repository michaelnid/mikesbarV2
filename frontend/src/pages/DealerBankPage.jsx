import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import QRScanner from '../components/QRScanner';

export default function DealerBankPage() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [amount, setAmount] = useState(0);
    const [users, setUsers] = useState([]);
    const [showScanner, setShowScanner] = useState(false);
    const [cameFromTable, setCameFromTable] = useState(false);

    const dealer = JSON.parse(localStorage.getItem('dealer') || '{}');
    const game = localStorage.getItem('selected_game') || 'bank';
    const gameName = localStorage.getItem('selected_game_name') || (game === 'bank' ? 'Bank' : game);

    // Load users
    const loadUsers = async () => {
        try {
            const data = await api.getLeaderboard();
            setUsers(data || []);
        } catch (e) {
            console.error("Failed to load users", e);
        }
    };

    useEffect(() => {
        loadUsers();

        // Check if there's a preselected player from TablePlayersPage
        const preselected = localStorage.getItem('preselected_player');
        if (preselected) {
            try {
                const player = JSON.parse(preselected);
                setSelectedUser(player);
                setCameFromTable(true); // Track that we came from table
                localStorage.removeItem('preselected_player'); // Clear after use
            } catch (e) {
                console.error('Failed to parse preselected player', e);
            }
        }
    }, []);

    const filteredUsers = searchQuery
        ? users.filter(u => u.username?.toLowerCase().includes(searchQuery.toLowerCase()) || u.id.toString() === searchQuery)
        : [];

    const handleTransaction = async (isDeposit) => {
        if (!amount || amount <= 0) return;

        // Check if withdrawal would exceed balance
        if (!isDeposit && amount > (selectedUser.balance || 0)) {
            alert(`Fehler: Auszahlung nicht möglich!\n\nSpieler hat nur ${selectedUser.balance || 0} € Guthaben.`);
            return;
        }

        setLoading(true);
        try {
            const finalAmount = isDeposit ? amount : -amount;
            const token = localStorage.getItem('dealer_token');
            await api.createTransaction(token, selectedUser.id, finalAmount, game);
            alert(`Transaktion erfolgreich! \n${isDeposit ? '+' : ''}${finalAmount} € für ${selectedUser.username}`);
            setAmount(0);

            // Navigate back to players page if came from table, otherwise stay in bank
            if (cameFromTable) {
                navigate('/dealer/players');
            } else {
                setSelectedUser(null);
                setSearchQuery('');
                loadUsers();
            }
        } catch (err) {
            alert('Fehler: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleQrScan = async (scannedValue) => {
        setShowScanner(false);
        setLoading(true); // Show loading indicator while looking up

        try {
            // 1. Try to find user by unique QR UUID (Server Lookup)
            // This is needed because the public leaderboard does not contain QR UUIDs
            const userByQr = await api.getUserByQr(scannedValue);
            if (userByQr) {
                setSelectedUser(userByQr);
                setSearchQuery('');
                setLoading(false);
                return;
            }
        } catch (e) {
            console.log("QR Lookup failed, trying local fallback", e);
        }

        // 2. Fallback: Search in local list (if scanned value is simple ID)
        const foundUser = users.find(u => u.id.toString() === scannedValue);
        if (foundUser) {
            setSelectedUser(foundUser);
            setSearchQuery('');
        } else {
            // 3. Last resort: Put value in search box for manual handling
            setSearchQuery(scannedValue);
        }
        setLoading(false);
    };

    return (
        <div className="flex-1 flex flex-col bg-neutral-950 p-4 min-h-screen w-full max-w-md mx-auto md:border-x md:border-neutral-800 md:shadow-2xl">
            <div className="flex justify-between items-center mb-6">
                <button
                    onClick={() => navigate(game === 'bank' ? '/dealer/games' : '/dealer/players')}
                    className="px-3 py-1 bg-neutral-800 rounded text-neutral-400"
                >
                    ← {game === 'bank' ? 'Spiele' : 'Spieler'}
                </button>
                <div className="text-right">
                    <div className="text-yellow-500 font-bold">{dealer.name}</div>
                    <div className="text-xs text-neutral-500 uppercase tracking-widest bg-yellow-900/20 px-2 py-0.5 rounded inline-block">{gameName}</div>
                </div>
            </div>

            {!selectedUser ? (
                <div className="flex-1 flex flex-col space-y-4">
                    <div className="flex gap-2">
                        <input
                            className="flex-1 bg-neutral-900 border border-neutral-700 p-4 rounded-xl text-white placeholder-neutral-600 focus:border-yellow-500 outline-none"
                            placeholder="User-ID oder Name"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <button
                            onClick={() => setShowScanner(true)}
                            className="px-4 bg-yellow-600 hover:bg-yellow-500 rounded-xl text-white transition-colors"
                            title="QR-Code scannen"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                                <path d="M12 9a3.75 3.75 0 100 7.5A3.75 3.75 0 0012 9z" />
                                <path fillRule="evenodd" d="M9.344 3.071a49.52 49.52 0 015.312 0c.967.052 1.83.585 2.332 1.39l.821 1.317c.24.383.645.643 1.11.71.386.054.77.113 1.152.177 1.432.239 2.429 1.493 2.429 2.909V18a3 3 0 01-3 3h-15a3 3 0 01-3-3V9.574c0-1.416.997-2.67 2.429-2.909.382-.064.766-.123 1.151-.178a1.56 1.56 0 001.11-.71l.822-1.315a2.942 2.942 0 012.332-1.39zM6.75 12.75a5.25 5.25 0 1110.5 0 5.25 5.25 0 01-10.5 0zm12-2.625a.75.75 0 01.75-.75h.008a.75.75 0 01.75.75v.008a.75.75 0 01-.75.75H19.5a.75.75 0 01-.75-.75v-.008z" clipRule="evenodd" />
                            </svg>
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2">
                        {filteredUsers.map(user => (
                            <button
                                key={user.id}
                                onClick={() => setSelectedUser(user)}
                                className="w-full flex items-center justify-between p-4 bg-neutral-900 border border-white/5 rounded-xl hover:bg-neutral-800"
                            >
                                <span className="font-bold text-white">{user.username}</span>
                                <span className="text-neutral-500 text-sm">ID: {user.id}</span>
                            </button>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col">
                    <div className="bg-neutral-900 p-4 rounded-2xl flex flex-col gap-4 mb-8 border border-yellow-500/30">
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="text-neutral-500 text-xs">Spieler</div>
                                <div className="text-xl font-bold text-white">{selectedUser.username}</div>
                                <div className="text-green-400 text-sm font-bold">Guthaben: {selectedUser.balance || 0} €</div>
                            </div>
                            <button onClick={() => {
                                if (cameFromTable) {
                                    navigate('/dealer/players');
                                } else {
                                    setSelectedUser(null);
                                    setAmount(0);
                                }
                            }} className="p-2 bg-neutral-800 rounded-lg text-neutral-400">✕</button>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col justify-center items-center mb-8">
                        <div className="text-neutral-500 mb-2">Betrag €</div>
                        <div className="text-6xl font-bold text-white tracking-tighter">{amount}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={() => handleTransaction(true)}
                            disabled={loading}
                            className="bg-green-600 hover:bg-green-500 p-4 rounded-xl font-bold text-white text-xl shadow-[0_0_20px_rgba(22,163,74,0.4)] disabled:opacity-50"
                        >
                            Einzahlen
                        </button>
                        <button
                            onClick={() => handleTransaction(false)}
                            disabled={loading}
                            className="bg-red-600 hover:bg-red-500 p-4 rounded-xl font-bold text-white text-xl shadow-[0_0_20px_rgba(220,38,38,0.4)] disabled:opacity-50"
                        >
                            Auszahlen
                        </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-4 max-w-sm mx-auto w-full">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                            <button
                                key={num}
                                onClick={() => setAmount(prev => parseInt(`${prev}${num}`))}
                                className="bg-neutral-800 p-4 rounded-xl font-bold text-2xl text-white hover:bg-neutral-700 active:bg-neutral-600"
                            >
                                {num}
                            </button>
                        ))}
                        <button onClick={() => setAmount(0)} className="bg-red-900/30 p-4 rounded-xl font-bold text-xl text-red-500 hover:bg-red-900/50">C</button>
                        <button onClick={() => setAmount(prev => parseInt(`${prev}0`))} className="bg-neutral-800 p-4 rounded-xl font-bold text-2xl text-white hover:bg-neutral-700">0</button>
                        <button onClick={() => setAmount(prev => Math.floor(prev / 10))} className="bg-neutral-800 p-4 rounded-xl font-bold text-xl text-yellow-500 hover:bg-neutral-700">⌫</button>
                    </div>
                </div>
            )}

            {showScanner && (
                <QRScanner
                    onScanSuccess={handleQrScan}
                    onClose={() => setShowScanner(false)}
                />
            )}
        </div>
    );
}
