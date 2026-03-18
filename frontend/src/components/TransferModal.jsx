import { useState, useEffect } from 'react';
import QRScanner from './QRScanner';
import { api } from '../services/api';
import { DEFAULT_AVATAR_URL } from '../constants/assets';

export default function TransferModal({ onClose, onSuccess }) {
    const [users, setUsers] = useState([]);
    const [selectedRecipient, setSelectedRecipient] = useState(null);
    const [amount, setAmount] = useState('');
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showScanner, setShowScanner] = useState(false);

    const token = localStorage.getItem('token');
    const currentUser = JSON.parse(localStorage.getItem('user'));

    useEffect(() => {
        loadRecipients();
    }, []);

    const loadRecipients = async () => {
        try {
            const data = await api.getLeaderboard();
            // Filter out self
            setUsers(data.filter(u => u.id !== currentUser.id));
        } catch (e) { }
    };

    const handleTransfer = async () => {
        if (!selectedRecipient || !amount || amount <= 0) return;
        setLoading(true);
        try {
            await api.transfer(token, selectedRecipient.id, parseFloat(amount));
            alert('Geld erfolgreich gesendet!');
            onSuccess();
            onClose();
        } catch (e) {
            alert(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleScan = async (decodedText) => {
        try {
            // Stop scanner effectively by removing it from UI first
            setShowScanner(false);

            // Extract UUID if it's a URL or just the UUID
            const uuid = decodedText.includes('user:') ? decodedText.split('user:')[1] : decodedText;

            const user = await api.getUserByQr(uuid);
            // Don't allow sending to self
            if (user.id === currentUser.id) {
                alert('Du kannst dir nicht selbst Geld senden!');
                return;
            }
            setSelectedRecipient(user);
        } catch (err) {
            console.error(err);
            alert('Ungültiger QR-Code');
        }
    };

    useEffect(() => {
        loadRecipients();
    }, []);

    const filteredUsers = users.filter(u =>
        u.username.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-neutral-900 border border-yellow-500/20 w-full max-w-sm rounded-2xl flex flex-col shadow-2xl p-6 space-y-6">
                <h2 className="text-xl font-bold text-yellow-500 text-center">Geld senden</h2>

                {/* Recipient Selection */}
                {!selectedRecipient ? (
                    <>
                        <div className="space-y-4">
                            <p className="text-neutral-400 text-sm text-center">Empfänger suchen oder QR-Code scannen:</p>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Benutzername eingeben..."
                                    className="flex-1 bg-neutral-950 p-3 rounded-xl border border-neutral-800 text-white focus:border-yellow-500 outline-none"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                                <button
                                    onClick={() => setShowScanner(true)}
                                    className="p-3 bg-neutral-800 rounded-xl text-white hover:bg-neutral-700 hover:text-yellow-500 transition-colors"
                                    title="QR Code scannen"
                                >
                                    📷
                                </button>
                            </div>

                            {/* Search Results - only show when user types something */}
                            {searchQuery.length >= 2 && (
                                <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                                    {filteredUsers.length > 0 ? (
                                        filteredUsers.slice(0, 5).map(u => (
                                            <button
                                                key={u.id}
                                                onClick={() => setSelectedRecipient(u)}
                                                className="w-full p-3 bg-neutral-800 rounded-xl flex items-center gap-3 hover:bg-neutral-700 transition-colors"
                                            >
                                                <div className="w-8 h-8 rounded-full bg-neutral-700 overflow-hidden">
                                                    <img src={u.avatarUrl || DEFAULT_AVATAR_URL} className="w-full h-full object-cover" onError={(e) => e.target.src = DEFAULT_AVATAR_URL} />
                                                </div>
                                                <span className="font-bold text-white">{u.username}</span>
                                            </button>
                                        ))
                                    ) : (
                                        <div className="text-center text-neutral-500 py-4">Kein Spieler gefunden</div>
                                    )}
                                </div>
                            )}
                        </div>

                        <button onClick={onClose} className="w-full p-4 bg-neutral-800 rounded-xl font-bold text-neutral-400 hover:text-white mt-4">
                            Abbrechen
                        </button>
                    </>
                ) : (
                    <div className="space-y-6">
                        <div className="flex items-center gap-3 bg-neutral-800 p-4 rounded-xl border border-yellow-500/30">
                            <div className="w-12 h-12 rounded-full bg-neutral-700 overflow-hidden">
                                <img src={selectedRecipient.avatarUrl || DEFAULT_AVATAR_URL} className="w-full h-full object-cover" onError={(e) => e.target.src = DEFAULT_AVATAR_URL} />
                            </div>
                            <div>
                                <div className="text-xs text-neutral-500">Empfänger</div>
                                <div className="font-bold text-lg text-white">{selectedRecipient.username}</div>
                            </div>
                            <button onClick={() => setSelectedRecipient(null)} className="ml-auto text-neutral-400 hover:text-white">Ändern</button>
                        </div>

                        <div>
                            <label className="block text-sm text-neutral-400 mb-2">Betrag eingeben</label>
                            <input
                                type="number"
                                className="w-full bg-neutral-950 p-4 rounded-xl text-2xl font-bold text-center border border-neutral-800 focus:border-yellow-500 outline-none text-white"
                                placeholder="0.00"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <button onClick={onClose} className="p-4 bg-neutral-800 rounded-xl font-bold text-neutral-400 hover:text-white">Abbrechen</button>
                            <button
                                onClick={handleTransfer}
                                disabled={loading}
                                className="p-4 bg-yellow-600 rounded-xl font-bold text-black hover:bg-yellow-500 disabled:opacity-50"
                            >
                                {loading ? '...' : 'Senden'}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* QR Scanner Overlay */}
            {showScanner && (
                <QRScanner
                    onScanSuccess={handleScan}
                    onClose={() => setShowScanner(false)}
                />
            )}
        </div>
    );
}
