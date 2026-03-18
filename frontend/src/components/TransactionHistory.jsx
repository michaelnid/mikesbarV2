import { useEffect, useState } from 'react';
import { api } from '../services/api';

export default function TransactionHistory({ userId, onClose, username }) {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadHistory();
    }, [userId]);

    const loadHistory = async () => {
        try {
            // Fetch public history for this user or self
            const token = localStorage.getItem('token');
            const data = await api.getTransactions(userId, token);
            setTransactions(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-neutral-900 border border-yellow-500/20 w-full max-w-sm max-h-[80vh] rounded-2xl flex flex-col shadow-[0_0_100px_rgba(0,0,0,0.8)] overflow-hidden">
                <div className="p-4 border-b border-white/5 flex justify-between items-center bg-neutral-800/50">
                    <div>
                        <span className="text-yellow-500 text-xs font-bold uppercase tracking-wider">Historie</span>
                        <h3 className="font-bold text-white text-lg">{username}</h3>
                    </div>
                    <button onClick={onClose} className="p-2 bg-neutral-800 rounded-full hover:bg-neutral-700">
                        ✕
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {loading ? (
                        <div className="text-center py-8 text-neutral-500">Laden...</div>
                    ) : transactions.length === 0 ? (
                        <div className="text-center py-8 text-neutral-500">Keine Transaktionen</div>
                    ) : (
                        transactions.map(tx => (
                            <div key={tx.id} className="flex justify-between items-center p-3 rounded-lg bg-black/20 border border-white/5">
                                <div>
                                    <div className="text-sm font-bold text-white">
                                        {tx.game}
                                    </div>
                                    <div className="text-xs text-neutral-500">
                                        {new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} Uhr
                                        {tx.dealer && ` • Dealer: ${tx.dealer.name}`}
                                    </div>
                                </div>
                                <div className={`font-mono font-bold ${tx.amount >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                    {tx.amount > 0 ? '+' : ''}{tx.amount.toFixed(2)} €
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-4 border-t border-white/5 bg-neutral-900">
                    <button onClick={onClose} className="w-full py-3 bg-neutral-800 hover:bg-neutral-700 rounded-xl font-bold text-neutral-300">
                        Schließen
                    </button>
                </div>
            </div>
        </div>
    );
}
