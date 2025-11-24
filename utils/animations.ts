// Animation easing functions and timing constants

export const easings = {
    bounce: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    accelerate: 'cubic-bezier(0.32, 0, 0.67, 0)',
    material: 'cubic-bezier(0.4, 0, 0.2, 1)',
    smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
};

export const durations = {
    micro: 150,
    fast: 200,
    component: 300,
    slow: 400,
    page: 600,
    pageFlip: 800,
    loading: 2000,
};

// Framer Motion variants
export const fadeIn = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
};

export const scaleIn = {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.9 },
};

export const slideInFromBottom = {
    initial: { opacity: 0, y: 50 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 50 },
};

export const slideInFromRight = {
    initial: { opacity: 0, x: 50 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 50 },
};

export const float = {
    animate: {
        y: [0, -10, 0],
        transition: {
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
        },
    },
};

export const pulse = {
    animate: {
        scale: [1, 1.05, 1],
        transition: {
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
        },
    },
};

export const pageTurnVariants = {
    enter: (direction: number) => ({
        rotateY: direction > 0 ? 90 : -90,
        opacity: 0,
    }),
    center: {
        rotateY: 0,
        opacity: 1,
    },
    exit: (direction: number) => ({
        rotateY: direction > 0 ? -90 : 90,
        opacity: 0,
    }),
};
