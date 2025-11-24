export interface Particle {
    id: string;
    x: number;
    y: number;
    size: number;
    opacity: number;
    velocityX: number;
    velocityY: number;
    type: 'sparkle' | 'star' | 'bubble' | 'confetti';
    color?: string;
    rotation?: number;
    rotationSpeed?: number;
}

export const createParticle = (
    x: number,
    y: number,
    type: Particle['type'] = 'sparkle'
): Particle => {
    return {
        id: Math.random().toString(36).substring(7),
        x,
        y,
        size: type === 'sparkle' ? Math.random() * 3 + 1 : Math.random() * 5 + 4,
        opacity: Math.random() * 0.7 + 0.3,
        velocityX: (Math.random() - 0.5) * 2,
        velocityY: type === 'bubble' ? -(Math.random() * 2 + 1) : (Math.random() - 0.5) * 2,
        type,
        color: getParticleColor(type),
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
    };
};

const getParticleColor = (type: Particle['type']): string => {
    switch (type) {
        case 'sparkle':
            return '#FFD93D'; // gold-sunshine
        case 'star':
            return '#FF9B71'; // coral-burst
        case 'bubble':
            return '#D4F4DD'; // mint-breeze
        case 'confetti':
            const colors = ['#FFD93D', '#FF9B71', '#D4F4DD', '#FFE4CC', '#FFF4A3'];
            return colors[Math.floor(Math.random() * colors.length)];
        default:
            return '#FFD93D';
    }
};

export const updateParticle = (particle: Particle, deltaTime: number = 1): Particle => {
    return {
        ...particle,
        x: particle.x + particle.velocityX * deltaTime,
        y: particle.y + particle.velocityY * deltaTime,
        opacity: Math.max(0, particle.opacity - 0.01 * deltaTime),
        rotation: (particle.rotation || 0) + (particle.rotationSpeed || 0) * deltaTime,
    };
};

export const generateParticles = (
    count: number,
    centerX: number,
    centerY: number,
    radius: number = 100,
    type: Particle['type'] = 'sparkle'
): Particle[] => {
    const particles: Particle[] = [];
    for (let i = 0; i < count; i++) {
        const angle = (Math.random() * 2 * Math.PI);
        const distance = Math.random() * radius;
        const x = centerX + Math.cos(angle) * distance;
        const y = centerY + Math.sin(angle) * distance;
        particles.push(createParticle(x, y, type));
    }
    return particles;
};
