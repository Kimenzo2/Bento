import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

const InstallPWA: React.FC = () => {
    const [supportsPWA, setSupportsPWA] = useState(false);
    const [promptInstall, setPromptInstall] = useState<any>(null);

    useEffect(() => {
        const handler = (e: any) => {
            e.preventDefault();
            setSupportsPWA(true);
            setPromptInstall(e);
        };
        window.addEventListener('beforeinstallprompt', handler);

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const onClick = (evt: React.MouseEvent) => {
        evt.preventDefault();
        if (!promptInstall) {
            return;
        }
        promptInstall.prompt();
    };

    if (!supportsPWA) {
        return null;
    }

    return (
        <div className="fixed bottom-20 left-4 right-4 md:bottom-4 md:left-auto md:right-4 z-[100] animate-fadeIn">
            <div className="bg-white/90 backdrop-blur-md border border-gray-200 shadow-lg rounded-2xl p-4 flex items-center justify-between gap-4 max-w-sm ml-auto">
                <div className="flex items-center gap-3">
                    <div className="bg-coral-burst/10 p-2 rounded-xl">
                        <Download className="w-6 h-6 text-coral-burst" />
                    </div>
                    <div>
                        <h3 className="font-bold text-charcoal-soft text-sm">Install App</h3>
                        <p className="text-xs text-gray-500">Add to home screen for better experience</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setSupportsPWA(false)}
                        className="p-2 hover:bg-gray-100 rounded-full text-gray-400"
                    >
                        <X size={18} />
                    </button>
                    <button
                        onClick={onClick}
                        className="bg-coral-burst text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md hover:bg-coral-hover transition-colors"
                    >
                        Install
                    </button>
                </div>
            </div>
        </div>
    );
};

export default InstallPWA;
