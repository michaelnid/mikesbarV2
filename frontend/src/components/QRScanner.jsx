import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

export default function QRScanner({ onScanSuccess, onClose }) {
    const [error, setError] = useState(null);
    const [isScanning, setIsScanning] = useState(false);
    const [manualId, setManualId] = useState('');
    const html5QrCodeRef = useRef(null);

    // Check if HTTPS or localhost
    const isSecureContext = window.isSecureContext ||
        window.location.protocol === 'https:' ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1';

    useEffect(() => {
        if (!isSecureContext) {
            setError('https_required');
            return;
        }

        const startScanner = async () => {
            try {
                const html5QrCode = new Html5Qrcode("qr-reader");
                html5QrCodeRef.current = html5QrCode;

                await html5QrCode.start(
                    { facingMode: "environment" },
                    {
                        fps: 10,
                        qrbox: { width: 250, height: 250 },
                        aspectRatio: 1.0,
                    },
                    (decodedText) => {
                        // Parse the QR code data
                        try {
                            const data = JSON.parse(decodedText);
                            if (data.type === 'player' && data.userId) {
                                onScanSuccess(data.userId.toString());
                            } else if (data.userId) {
                                onScanSuccess(data.userId.toString());
                            } else {
                                onScanSuccess(decodedText);
                            }
                        } catch {
                            onScanSuccess(decodedText);
                        }
                    },
                    () => {
                        // Ignore scan errors (no QR code detected)
                    }
                );
                setIsScanning(true);
            } catch (err) {
                console.error("Scanner error:", err);
                setError('camera_failed');
            }
        };

        startScanner();

        return () => {
            if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
                html5QrCodeRef.current.stop().catch(console.error);
            }
        };
    }, [onScanSuccess, isSecureContext]);

    const handleClose = async () => {
        if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
            await html5QrCodeRef.current.stop().catch(console.error);
        }
        onClose();
    };

    const handleManualSubmit = () => {
        if (manualId.trim()) {
            onScanSuccess(manualId.trim());
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-sm bg-neutral-950 rounded-[2rem] overflow-hidden border border-white/10 shadow-[0_0_150px_rgba(0,0,0,0.9)]">
                <div className="flex justify-between items-center p-4 border-b border-neutral-800">
                    <h2 className="text-lg font-bold text-white">QR Code Scanner</h2>
                    <button
                        onClick={handleClose}
                        className="p-2 bg-neutral-800 rounded-lg text-neutral-400 hover:bg-neutral-700"
                    >
                        ✕
                    </button>
                </div>

                <div className="p-4">
                    {error === 'https_required' ? (
                        <div className="text-center py-4">
                            <div className="text-yellow-500 text-4xl mb-4">🔒</div>
                            <div className="text-yellow-500 font-medium mb-2">
                                HTTPS erforderlich
                            </div>
                            <div className="text-neutral-400 text-sm mb-6">
                                Die Kamera benötigt eine sichere Verbindung (HTTPS).
                            </div>

                            <div className="border-t border-neutral-800 pt-4">
                                <div className="text-neutral-400 text-sm mb-2">
                                    Alternativ: User-ID manuell eingeben
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={manualId}
                                        onChange={(e) => setManualId(e.target.value)}
                                        placeholder="User-ID eingeben"
                                        className="flex-1 bg-neutral-800 border border-neutral-700 p-3 rounded-xl text-white placeholder-neutral-500 focus:border-yellow-500 outline-none"
                                        onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
                                    />
                                    <button
                                        onClick={handleManualSubmit}
                                        className="px-4 bg-yellow-600 hover:bg-yellow-500 rounded-xl text-white font-medium"
                                    >
                                        OK
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : error === 'camera_failed' ? (
                        <div className="text-center py-4">
                            <div className="text-red-500 text-4xl mb-4">📷</div>
                            <div className="text-red-500 font-medium mb-2">
                                Kamera nicht verfügbar
                            </div>
                            <div className="text-neutral-400 text-sm mb-6">
                                Bitte Kamera-Berechtigung erteilen oder manuell eingeben.
                            </div>

                            <div className="border-t border-neutral-800 pt-4">
                                <div className="text-neutral-400 text-sm mb-2">
                                    User-ID manuell eingeben
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={manualId}
                                        onChange={(e) => setManualId(e.target.value)}
                                        placeholder="User-ID eingeben"
                                        className="flex-1 bg-neutral-800 border border-neutral-700 p-3 rounded-xl text-white placeholder-neutral-500 focus:border-yellow-500 outline-none"
                                        onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
                                    />
                                    <button
                                        onClick={handleManualSubmit}
                                        className="px-4 bg-yellow-600 hover:bg-yellow-500 rounded-xl text-white font-medium"
                                    >
                                        OK
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div
                                id="qr-reader"
                                className="w-full rounded-xl overflow-hidden bg-black"
                                style={{ minHeight: '300px' }}
                            />
                            <p className="text-neutral-400 text-sm text-center mt-4">
                                Scanne den QR-Code aus dem Spieler Dashboard
                            </p>
                        </>
                    )}
                </div>

                <div className="p-4 border-t border-neutral-800">
                    <button
                        onClick={handleClose}
                        className="w-full py-3 bg-neutral-800 hover:bg-neutral-700 rounded-xl text-white font-medium"
                    >
                        Abbrechen
                    </button>
                </div>
            </div>
        </div>
    );
}
