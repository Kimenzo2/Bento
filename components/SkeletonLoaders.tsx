import React from 'react';
import { motion, Transition } from 'framer-motion';

// Base skeleton with shimmer effect
const shimmerTransition: Transition = { 
    repeat: Infinity, 
    duration: 1.5, 
    ease: 'linear' as const
};

export const SkeletonBase: React.FC<{ className?: string }> = ({ className = '' }) => (
    <div className={`relative overflow-hidden bg-gray-200 dark:bg-gray-700 rounded ${className}`}>
        <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={shimmerTransition}
        />
    </div>
);

// Book Card Skeleton
export const BookCardSkeleton: React.FC = () => (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
        <SkeletonBase className="h-48 w-full rounded-none" />
        <div className="p-4 space-y-3">
            <SkeletonBase className="h-6 w-3/4" />
            <SkeletonBase className="h-4 w-1/2" />
            <div className="flex gap-2 mt-4">
                <SkeletonBase className="h-8 w-20 rounded-full" />
                <SkeletonBase className="h-8 w-20 rounded-full" />
            </div>
        </div>
    </div>
);

// Book Grid Skeleton
export const BookGridSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.from({ length: count }).map((_, i) => (
            <BookCardSkeleton key={i} />
        ))}
    </div>
);

// Page Content Skeleton
export const PageContentSkeleton: React.FC = () => (
    <div className="space-y-4 p-6">
        <SkeletonBase className="h-8 w-1/3" />
        <SkeletonBase className="h-4 w-full" />
        <SkeletonBase className="h-4 w-full" />
        <SkeletonBase className="h-4 w-2/3" />
        <SkeletonBase className="h-64 w-full mt-4" />
        <SkeletonBase className="h-4 w-full" />
        <SkeletonBase className="h-4 w-5/6" />
    </div>
);

// Chat Message Skeleton
export const ChatMessageSkeleton: React.FC = () => (
    <div className="flex gap-3 p-3">
        <SkeletonBase className="w-10 h-10 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
                <SkeletonBase className="h-4 w-24" />
                <SkeletonBase className="h-3 w-16" />
            </div>
            <SkeletonBase className="h-4 w-full" />
            <SkeletonBase className="h-4 w-3/4" />
        </div>
    </div>
);

// Chat Messages List Skeleton
export const ChatMessagesSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => (
    <div className="space-y-4">
        {Array.from({ length: count }).map((_, i) => (
            <ChatMessageSkeleton key={i} />
        ))}
    </div>
);

// Editor Skeleton
export const EditorSkeleton: React.FC = () => (
    <div className="flex h-full">
        {/* Sidebar */}
        <div className="w-64 border-r border-gray-200 dark:border-gray-700 p-4 space-y-3">
            <SkeletonBase className="h-8 w-full" />
            <div className="space-y-2 mt-6">
                {Array.from({ length: 8 }).map((_, i) => (
                    <SkeletonBase key={i} className="h-6 w-full" />
                ))}
            </div>
        </div>
        {/* Main Content */}
        <div className="flex-1 p-6">
            <SkeletonBase className="h-10 w-1/2 mb-6" />
            <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                    <SkeletonBase key={i} className="h-4 w-full" />
                ))}
            </div>
            <SkeletonBase className="h-64 w-full mt-6" />
        </div>
    </div>
);

// Profile Card Skeleton
export const ProfileCardSkeleton: React.FC = () => (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
        <div className="flex items-center gap-4">
            <SkeletonBase className="w-16 h-16 rounded-full" />
            <div className="space-y-2">
                <SkeletonBase className="h-6 w-32" />
                <SkeletonBase className="h-4 w-48" />
            </div>
        </div>
        <div className="mt-6 grid grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="text-center space-y-2">
                    <SkeletonBase className="h-8 w-16 mx-auto" />
                    <SkeletonBase className="h-4 w-20 mx-auto" />
                </div>
            ))}
        </div>
    </div>
);

// Illustration Skeleton with aspect ratio
export const IllustrationSkeleton: React.FC<{ aspectRatio?: string }> = ({ aspectRatio = '1/1' }) => (
    <div className="relative" style={{ aspectRatio }}>
        <SkeletonBase className="absolute inset-0 rounded-xl" />
        <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
                className="w-12 h-12 border-4 border-coral-burst/30 border-t-coral-burst rounded-full"
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
            />
        </div>
    </div>
);

// Generation Progress Skeleton
export const GenerationProgressSkeleton: React.FC = () => (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg max-w-md mx-auto">
        <div className="text-center space-y-4">
            <SkeletonBase className="w-20 h-20 rounded-full mx-auto" />
            <SkeletonBase className="h-6 w-48 mx-auto" />
            <SkeletonBase className="h-4 w-64 mx-auto" />
            <SkeletonBase className="h-3 w-full rounded-full" />
            <div className="flex justify-center gap-2">
                {Array.from({ length: 5 }).map((_, i) => (
                    <SkeletonBase key={i} className="w-3 h-3 rounded-full" />
                ))}
            </div>
        </div>
    </div>
);

export default {
    SkeletonBase,
    BookCardSkeleton,
    BookGridSkeleton,
    PageContentSkeleton,
    ChatMessageSkeleton,
    ChatMessagesSkeleton,
    EditorSkeleton,
    ProfileCardSkeleton,
    IllustrationSkeleton,
    GenerationProgressSkeleton,
};
