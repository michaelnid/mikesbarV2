import { Outlet } from 'react-router-dom';

export default function MainLayout() {
    return (
        <div className="min-h-screen bg-black text-white font-sans selection:bg-yellow-500/30 flex justify-center">
            {/* Mobile container simulation -> Desktop Full Width */}
            <div className="w-full md:max-w-full max-w-[480px] min-h-screen bg-neutral-950 shadow-2xl shadow-black relative flex flex-col border-x border-neutral-900 md:border-none">
                <Outlet />
            </div>
        </div>
    );
}
