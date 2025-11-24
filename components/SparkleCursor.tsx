import React, { useEffect, useState } from 'react';

interface Sparkle {
    id: number;
    x: number;
    y: number;
    size: number;
    color: string;
}

const SparkleCursor: React.FC = () => {
    const [sparkles, setSparkles] = useState<Sparkle[]>([]);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            setMousePos({ x: e.clientX, y: e.clientY });

            if (Math.random() > 0.8) { // Only add sparkles occasionally to avoid lag
                addSparkle(e.clientX, e.clientY);
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    useEffect(() => {
        const interval = setInterval(() => {
            setSparkles(prev => prev.filter(s => s.size > 0.5).map(s => ({
                ...s,
                y: s.y + 1, // Gravity
                size: s.size - 0.2 // Fade out
            })));
        }, 50);

        return () => clearInterval(interval);
    }, []);

    const addSparkle = (x: number, y: number) => {
        const colors = ['#FF9B71', '#FFD700', '#60A5FA', '#F472B6'];
        const newSparkle: Sparkle = {
            id: Date.now() + Math.random(),
            x,
            y,
            size: Math.random() * 6 + 2,
            color: colors[Math.floor(Math.random() * colors.length)]
        };
        setSparkles(prev => [...prev.slice(-20), newSparkle]); // Limit to 20 sparkles
    };

    return (
        <div className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden">
            {sparkles.map(s => (
                <div
                    key={s.id}
                    className="absolute rounded-full animate-pulse"
                    style={{
                        left: s.x,
                        top: s.y,
                        width: s.size,
                        height: s.size,
                        backgroundColor: s.color,
                        opacity: s.size / 8,
                        transform: 'translate(-50%, -50%)',
                        boxShadow: `0 0 ${s.size * 2}px ${s.color}`
                    }}
                />
            ))}
        </div>
    );
};

export default SparkleCursor;
