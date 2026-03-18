import { useState } from 'react';
import { api } from '../services/api';

export default function ChangePinModal({ onClose, onSuccess }) {
    const [step, setStep] = useState(1); // 1: Old PIN, 2: New PIN
    const [oldPin, setOldPin] = useState('');
    const [newPin, setNewPin] = useState('');
    const [confirmNewPin, setConfirmNewPin] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    const handlePinInput = (value, setter, maxLength = 6) => {
        if (value.length <= maxLength && /^\d*$/.test(value)) {
            setter(value);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (newPin !== confirmNewPin) {
            setError('Die neuen PINs stimmen nicht überein.');
            return;
        }

        if (newPin.length < 1) {
            setError('Der neue PIN muss mindestens 1 Stelle haben.');
            return;
        }

        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            await api.changePin(token, oldPin, newPin);
            setSuccessMessage('PIN erfolgreich geändert!');
            setTimeout(() => {
                onSuccess(); // Does nothing mostly but clean
                onClose();
            }, 1000);
        } catch (err) {
            setError(err.message);
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-neutral-900 border border-yellow-500/20 w-full max-w-sm rounded-2xl flex flex-col shadow-2xl overflow-hidden">
                <div className="p-4 border-b border-white/5 flex justify-between items-center bg-neutral-800/50">
                    <h3 className="font-bold text-white text-lg">PIN ändern</h3>
                    <button onClick={onClose} className="p-2 bg-neutral-800 rounded-full hover:bg-neutral-700 text-neutral-400">
                        ✕
                    </button>
                </div>

                <div className="p-6">
                    {successMessage ? (
                        <div className="text-center py-8">
                            <div className="text-4xl mb-4">✅</div>
                            <h4 className="text-xl font-bold text-green-500">{successMessage}</h4>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-neutral-400 mb-2">Aktueller PIN</label>
                                <input
                                    type="password"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    maxLength={6}
                                    value={oldPin}
                                    onChange={(e) => handlePinInput(e.target.value, setOldPin)}
                                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-3 text-white text-center text-xl tracking-[0.5em] focus:border-yellow-500 focus:outline-none"
                                    placeholder="••••"
                                    autoComplete="off"
                                    style={{ WebkitTextSecurity: 'disc', textSecurity: 'disc' }}
                                />
                            </div>

                            <div className="space-y-4 pt-4 border-t border-white/5">
                                <div>
                                    <label className="block text-sm font-medium text-neutral-400 mb-2">Neuer PIN</label>
                                    <input
                                        type="password"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        maxLength={6}
                                        value={newPin}
                                        onChange={(e) => handlePinInput(e.target.value, setNewPin)}
                                        className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-3 text-white text-center text-xl tracking-[0.5em] focus:border-yellow-500 focus:outline-none"
                                        placeholder="••••"
                                        autoComplete="off"
                                        style={{ WebkitTextSecurity: 'disc', textSecurity: 'disc' }}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-neutral-400 mb-2">Bestätigen</label>
                                    <input
                                        type="password"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        maxLength={6}
                                        value={confirmNewPin}
                                        onChange={(e) => handlePinInput(e.target.value, setConfirmNewPin)}
                                        className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-3 text-white text-center text-xl tracking-[0.5em] focus:border-yellow-500 focus:outline-none"
                                        placeholder="••••"
                                        autoComplete="off"
                                        style={{ WebkitTextSecurity: 'disc', textSecurity: 'disc' }}
                                    />
                                </div>
                            </div>

                            {error && <div className="text-red-500 text-sm text-center bg-red-900/10 p-2 rounded">{error}</div>}

                            <button
                                type="submit"
                                disabled={loading || !oldPin || !newPin || !confirmNewPin}
                                className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {loading ? '...' : 'PIN ändern'}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
