import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

export default function PluginHostPage() {
    const navigate = useNavigate();
    const { pluginKey = '' } = useParams();
    const token = localStorage.getItem('token') || '';
    const user = JSON.parse(localStorage.getItem('user') || 'null');

    const iframeUrl = useMemo(() => {
        const url = new URL(`${window.location.origin}/plugin-runtime/${pluginKey}/index.html`);
        if (token) {
            url.searchParams.set('token', token);
        }
        if (user?.id) {
            url.searchParams.set('userId', user.id);
        }
        url.searchParams.set('pluginKey', pluginKey);
        url.searchParams.set('apiBaseUrl', `${window.location.origin}/api/plugin-runtime/${pluginKey}`);
        return url.toString();
    }, [pluginKey, token, user?.id]);

    return (
        <div className="flex-1 flex flex-col min-h-screen bg-neutral-950">
            <div className="border-b border-white/5 bg-black/30 backdrop-blur">
                <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
                    <button
                        onClick={() => navigate(-1)}
                        className="px-4 py-2 rounded-xl bg-white/5 text-neutral-300 hover:text-white hover:bg-white/10 transition-colors"
                    >
                        Zurück
                    </button>
                    <div className="text-sm uppercase tracking-[0.25em] text-neutral-500">
                        Plugin {pluginKey}
                    </div>
                </div>
            </div>

            <div className="flex-1">
                <iframe
                    title={`Plugin ${pluginKey}`}
                    src={iframeUrl}
                    className="w-full h-[calc(100vh-61px)] border-0"
                    allow="clipboard-read; clipboard-write"
                />
            </div>
        </div>
    );
}
