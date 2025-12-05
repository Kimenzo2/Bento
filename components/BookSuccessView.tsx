import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AppMode, BookProject, UserTier } from '../types';
import { Eye, Edit3, Download, Share2, Sparkles, Gift, PartyPopper, ShieldCheck } from 'lucide-react';
import StorybookViewer from './StorybookViewer';
import { Particle, generateParticles, updateParticle } from '../utils/particles';
import { hasWatermark, hasCommercialLicense } from '../services/tierLimits';
import { exportToPDF } from '../services/generator/pdfService';
import { ShareModal } from './BookSharing';

interface BookSuccessViewProps {
    project: BookProject;
    onNavigate: (mode: AppMode) => void;
    userTier: UserTier;
}

const BookSuccessView: React.FC<BookSuccessViewProps> = ({ project, onNavigate, userTier }) => {
    const [isViewerOpen, setIsViewerOpen] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [confetti, setConfetti] = useState<Particle[]>([]);

    // Generate celebration confetti on mount
    useEffect(() => {
        const particles = generateParticles(50, window.innerWidth / 2, window.innerHeight / 2, 400, 'confetti');
        setConfetti(particles);

        // Update confetti animation
        const interval = setInterval(() => {
            setConfetti(prev =>
                prev
                    .map(p => ({
                        ...updateParticle(p, 1.5),
                        velocityY: p.velocityY + 0.1, // Add gravity
                    }))
                    .filter(p => p.y < window.innerHeight && p.opacity > 0)
            );
        }, 50);

        return () => clearInterval(interval);
    }, []);

    const handleDownload = async () => {
        const needsWatermark = hasWatermark(userTier);

        try {
            await exportToPDF(project, {
                includeWatermark: needsWatermark,
                watermarkText: 'Created with Genesis - Upgrade to remove'
            });

            if (needsWatermark) {
                alert('Downloaded with watermark. Upgrade to Creator tier for watermark-free exports!');
            }
        } catch (error) {
            console.error('Export failed:', error);
            alert('Failed to export PDF. Please try again.');
        }
    };

    const handleShare = () => {
        setShowShareModal(true);
    };

    if (isViewerOpen) {
        return (
            <StorybookViewer
                project={project}
                onClose={() => setIsViewerOpen(false)}
                onEdit={() => {
                    setIsViewerOpen(false);
                    onNavigate(AppMode.EDITOR);
                }}
                onDownload={handleDownload}
                onShare={handleShare}
            />
        );
    }

    return (
        <div className="min-h-screen relative overflow-hidden">
            {/* Warm gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#FFFBF0] via-[#FFE8D6] to-[#FFF8DC] opacity-50" />

            {/* Celebration confetti */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {confetti.map(particle => (
                    <div
                        key={particle.id}
                        className="absolute"
                        style={{
                            left: `${particle.x}px`,
                            top: `${particle.y}px`,
                            width: `${particle.size}px`,
                            height: `${particle.size}px`,
                            opacity: particle.opacity,
                            transform: `rotate(${particle.rotation}deg)`,
                        }}
                    >
                        <div
                            className="w-full h-full rounded-sm"
                            style={{
                                backgroundColor: particle.color,
                            }}
                        />
                    </div>
                ))}
            </div>

            {/* Content */}
            <div className="relative z-10 max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8">

                {/* Success Header with Animation */}
                <motion.div
                    initial={{ opacity: 0, y: -50, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className="text-center mb-12"
                >
                    <motion.div
                        animate={{
                            rotate: [0, 10, -10, 10, 0],
                            scale: [1, 1.1, 1.1, 1.1, 1],
                        }}
                        transition={{ duration: 1, delay: 0.3 }}
                        className="inline-block mb-6"
                    >
                        <div className="w-24 h-24 bg-gradient-to-br from-coral-burst to-gold-sunshine rounded-full flex items-center justify-center shadow-soft-lg relative">
                            <div className="absolute inset-0 bg-gold-sunshine/30 rounded-full animate-ping" />
                            <PartyPopper className="w-12 h-12 text-white relative z-10" />
                        </div>
                    </motion.div>

                    <h1 className="font-heading font-bold text-5xl md:text-6xl text-charcoal-soft mb-4">
                        Your Masterpiece is <span className="text-transparent bg-clip-text bg-gradient-to-r from-coral-burst to-gold-sunshine">Ready!</span>
                    </h1>
                    <p className="font-body text-xl text-cocoa-light max-w-2xl mx-auto">
                        🎉 Congratulations! Your story "{project.title}" is complete and waiting for you to explore.
                    </p>
                </motion.div>

                {/* Book Preview Card */}
                <motion.div
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.4 }}
                    className="max-w-4xl mx-auto"
                >
                    <div className="bg-white rounded-[32px] shadow-soft-lg overflow-hidden border-4 border-white/50 relative group">

                        {/* Glowing effect on hover */}
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                            <div className="absolute inset-0 bg-gradient-to-r from-coral-burst/10 via-gold-sunshine/10 to-mint-breeze/10 animate-pulse" />
                        </div>

                        <div className="grid md:grid-cols-2 gap-8 p-8 md:p-12 relative z-10">

                            {/* Cover Image */}
                            <motion.div
                                whileHover={{ scale: 1.05, rotate: 2 }}
                                transition={{ duration: 0.3 }}
                                className="relative"
                            >
                                {project.coverImage ? (
                                    <img
                                        src={project.coverImage}
                                        alt={project.title}
                                        className="w-full aspect-[3/4] object-cover rounded-2xl shadow-soft-lg"
                                        style={{
                                            boxShadow: '0 10px 40px rgba(255, 155, 113, 0.3)',
                                        }}
                                    />
                                ) : (
                                    <div className="w-full aspect-[3/4] bg-gradient-to-br from-peach-soft to-yellow-butter rounded-2xl shadow-soft-lg flex items-center justify-center">
                                        <Gift className="w-20 h-20 text-white opacity-50" />
                                    </div>
                                )}

                                {/* Floating sparkle */}
                                <motion.div
                                    className="absolute -top-4 -right-4"
                                    animate={{
                                        y: [0, -10, 0],
                                        rotate: [0, 180, 360],
                                    }}
                                    transition={{ duration: 3, repeat: Infinity }}
                                >
                                    <Sparkles className="w-8 h-8 text-gold-sunshine" style={{ filter: 'drop-shadow(0 0 8px #FFD93D)' }} />
                                </motion.div>
                            </motion.div>

                            {/* Book Info */}
                            <div className="flex flex-col justify-between">
                                <div>
                                    <h2 className="font-heading font-bold text-3xl text-charcoal-soft mb-3">
                                        {project.title}
                                    </h2>
                                    <p className="font-body text-cocoa-light leading-relaxed mb-6">
                                        {project.synopsis}
                                    </p>

                                    <div className="space-y-2 mb-6">
                                        <div className="flex items-center gap-2 text-sm flex-wrap">
                                            <span className="px-3 py-1 bg-coral-burst/10 text-coral-burst rounded-full font-heading font-bold">
                                                {project.style}
                                            </span>
                                            <span className="px-3 py-1 bg-mint-breeze/30 text-emerald-700 rounded-full font-heading font-bold">
                                                {project.tone}
                                            </span>
                                            {hasCommercialLicense(userTier) && (
                                                <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full font-heading font-bold flex items-center gap-1">
                                                    <ShieldCheck className="w-3 h-3" />
                                                    Commercial License
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-cocoa-light font-body">
                                            📖 {project.chapters.flatMap(c => c.pages).length} pages • 👥 {project.targetAudience}
                                        </p>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="space-y-3">
                                    <motion.button
                                        whileHover={{ scale: 1.02, y: -2 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => setIsViewerOpen(true)}
                                        className="w-full px-8 py-4 bg-gradient-to-r from-coral-burst to-gold-sunshine text-white rounded-full font-heading font-bold text-lg shadow-soft-lg hover:shadow-soft-xl transition-all flex items-center justify-center gap-3 group"
                                    >
                                        <Eye className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                        Read Your Story
                                    </motion.button>

                                    <div className="grid grid-cols-3 gap-3">
                                        <motion.button
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => onNavigate(AppMode.EDITOR)}
                                            className="px-4 py-3 bg-white border-2 border-peach-soft text-charcoal-soft rounded-full font-heading font-bold shadow-soft-md hover:border-coral-burst transition-all"
                                        >
                                            <Edit3 className="w-5 h-5 mx-auto" />
                                        </motion.button>
                                        <motion.button
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={handleDownload}
                                            className="px-4 py-3 bg-white border-2 border-peach-soft text-charcoal-soft rounded-full font-heading font-bold shadow-soft-md hover:border-coral-burst transition-all"
                                        >
                                            <Download className="w-5 h-5 mx-auto" />
                                        </motion.button>
                                        <motion.button
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={handleShare}
                                            className="px-4 py-3 bg-white border-2 border-peach-soft text-charcoal-soft rounded-full font-heading font-bold shadow-soft-md hover:border-coral-burst transition-all"
                                        >
                                            <Share2 className="w-5 h-5 mx-auto" />
                                        </motion.button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Next Steps */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1, duration: 0.8 }}
                    className="mt-12 text-center"
                >
                    <p className="text-cocoa-light font-body mb-4">
                        ✨ Want to create more magic?
                    </p>
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => onNavigate(AppMode.CREATION)}
                        className="px-8 py-3 bg-white text-coral-burst rounded-full font-heading font-bold shadow-soft-md hover:shadow-soft-lg transition-all border-2 border-transparent hover:border-coral-burst"
                    >
                        Create Another Masterpiece
                    </motion.button>
                </motion.div>
            </div>

            {showShareModal && (
                <ShareModal
                    isOpen={true}
                    onClose={() => setShowShareModal(false)}
                    book={project}
                />
            )}
        </div>
    );
};

export default BookSuccessView;
