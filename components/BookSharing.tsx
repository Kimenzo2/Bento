import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Share2, Link, Copy, Check, Twitter, Facebook, Linkedin,
    Mail, MessageCircle, QrCode, Globe, Lock, Eye, EyeOff,
    Download, X, ExternalLink, Users, Clock
} from 'lucide-react';
import { BookProject } from '../types';

interface ShareSettings {
    isPublic: boolean;
    allowDownload: boolean;
    expiresAt: Date | null;
    password: string | null;
    viewCount: number;
}

interface ShareLink {
    id: string;
    bookId: string;
    url: string;
    shortCode: string;
    settings: ShareSettings;
    createdAt: Date;
}

const STORAGE_KEY = 'genesis_share_links';

// Generate a short code for sharing
const generateShortCode = (): string => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

// Hook for managing book shares
export function useBookSharing() {
    const [shares, setShares] = useState<ShareLink[]>(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    });

    // Save to localStorage
    React.useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(shares));
    }, [shares]);

    const createShareLink = useCallback((bookId: string, settings: Partial<ShareSettings> = {}): ShareLink => {
        const shortCode = generateShortCode();
        const shareLink: ShareLink = {
            id: `share-${Date.now()}`,
            bookId,
            shortCode,
            url: `${window.location.origin}/shared/${shortCode}`,
            settings: {
                isPublic: true,
                allowDownload: true,
                expiresAt: null,
                password: null,
                viewCount: 0,
                ...settings,
            },
            createdAt: new Date(),
        };
        
        setShares(prev => [...prev, shareLink]);
        return shareLink;
    }, []);

    const getShareLink = useCallback((bookId: string): ShareLink | undefined => {
        return shares.find(s => s.bookId === bookId);
    }, [shares]);

    const updateShareSettings = useCallback((shareId: string, settings: Partial<ShareSettings>) => {
        setShares(prev => prev.map(s => 
            s.id === shareId 
                ? { ...s, settings: { ...s.settings, ...settings } }
                : s
        ));
    }, []);

    const deleteShareLink = useCallback((shareId: string) => {
        setShares(prev => prev.filter(s => s.id !== shareId));
    }, []);

    const incrementViewCount = useCallback((shareId: string) => {
        setShares(prev => prev.map(s => 
            s.id === shareId 
                ? { ...s, settings: { ...s.settings, viewCount: s.settings.viewCount + 1 } }
                : s
        ));
    }, []);

    return {
        shares,
        createShareLink,
        getShareLink,
        updateShareSettings,
        deleteShareLink,
        incrementViewCount,
    };
}

// Share Modal Component
interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    book: BookProject;
}

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, book }) => {
    const { createShareLink, getShareLink, updateShareSettings, deleteShareLink } = useBookSharing();
    const [copied, setCopied] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);
    
    const existingShare = getShareLink(book.id);
    const [shareLink, setShareLink] = useState<ShareLink | null>(existingShare || null);
    const [settings, setSettings] = useState<ShareSettings>({
        isPublic: true,
        allowDownload: true,
        expiresAt: null,
        password: null,
        viewCount: 0,
    });

    const handleCreateLink = () => {
        const newShare = createShareLink(book.id, settings);
        setShareLink(newShare);
    };

    const handleCopyLink = async () => {
        if (shareLink) {
            await navigator.clipboard.writeText(shareLink.url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleShare = (platform: string) => {
        if (!shareLink) return;
        
        const url = encodeURIComponent(shareLink.url);
        const title = encodeURIComponent(`Check out "${book.title}" - Created with Genesis`);
        
        const shareUrls: Record<string, string> = {
            twitter: `https://twitter.com/intent/tweet?url=${url}&text=${title}`,
            facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
            linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
            email: `mailto:?subject=${title}&body=Check out this book: ${shareLink.url}`,
            whatsapp: `https://wa.me/?text=${title}%20${url}`,
        };

        if (shareUrls[platform]) {
            window.open(shareUrls[platform], '_blank', 'width=600,height=400');
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                className="fixed inset-0 z-[200] flex items-center justify-center p-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
            >
                <motion.div
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    onClick={onClose}
                />

                <motion.div
                    className="relative bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                >
                    {/* Header */}
                    <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-coral-burst/10 rounded-xl">
                                    <Share2 className="w-6 h-6 text-coral-burst" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                                        Share Book
                                    </h2>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
                                        {book.title}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                title="Close"
                                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                            >
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-6">
                        {!shareLink ? (
                            <>
                                {/* Visibility Settings */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                                        <div className="flex items-center gap-3">
                                            {settings.isPublic ? (
                                                <Globe className="w-5 h-5 text-green-500" />
                                            ) : (
                                                <Lock className="w-5 h-5 text-amber-500" />
                                            )}
                                            <div>
                                                <p className="font-medium text-gray-900 dark:text-white">
                                                    {settings.isPublic ? 'Public' : 'Private'}
                                                </p>
                                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                                    {settings.isPublic 
                                                        ? 'Anyone with the link can view' 
                                                        : 'Only people with password'
                                                    }
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setSettings(s => ({ ...s, isPublic: !s.isPublic }))}
                                            title="Toggle visibility"
                                            className={`
                                                w-12 h-6 rounded-full transition-colors relative
                                                ${settings.isPublic ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}
                                            `}
                                        >
                                            <span className={`
                                                absolute top-1 w-4 h-4 bg-white rounded-full transition-transform
                                                ${settings.isPublic ? 'translate-x-7' : 'translate-x-1'}
                                            `} />
                                        </button>
                                    </div>

                                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                                        <div className="flex items-center gap-3">
                                            <Download className="w-5 h-5 text-blue-500" />
                                            <div>
                                                <p className="font-medium text-gray-900 dark:text-white">
                                                    Allow Downloads
                                                </p>
                                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                                    Viewers can download the book
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setSettings(s => ({ ...s, allowDownload: !s.allowDownload }))}
                                            title="Toggle downloads"
                                            className={`
                                                w-12 h-6 rounded-full transition-colors relative
                                                ${settings.allowDownload ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}
                                            `}
                                        >
                                            <span className={`
                                                absolute top-1 w-4 h-4 bg-white rounded-full transition-transform
                                                ${settings.allowDownload ? 'translate-x-7' : 'translate-x-1'}
                                            `} />
                                        </button>
                                    </div>
                                </div>

                                <button
                                    onClick={handleCreateLink}
                                    className="w-full py-3 bg-coral-burst text-white rounded-xl font-medium hover:bg-coral-burst/90 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Link className="w-5 h-5" />
                                    Create Share Link
                                </button>
                            </>
                        ) : (
                            <>
                                {/* Share Link Display */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                                        <input
                                            type="text"
                                            value={shareLink.url}
                                            readOnly
                                            title="Share link URL"
                                            className="flex-1 bg-transparent text-gray-900 dark:text-white text-sm outline-none"
                                        />
                                        <button
                                            onClick={handleCopyLink}
                                            title="Copy link"
                                            className={`
                                                p-2 rounded-lg transition-colors
                                                ${copied 
                                                    ? 'bg-green-500 text-white' 
                                                    : 'bg-coral-burst text-white hover:bg-coral-burst/90'
                                                }
                                            `}
                                        >
                                            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                        </button>
                                    </div>

                                    {/* Stats */}
                                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                                        <span className="flex items-center gap-1">
                                            <Eye className="w-4 h-4" />
                                            {shareLink.settings.viewCount} views
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-4 h-4" />
                                            Created {new Date(shareLink.createdAt).toLocaleDateString()}
                                        </span>
                                    </div>

                                    {/* Social Share Buttons */}
                                    <div>
                                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                            Share on social media
                                        </p>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleShare('twitter')}
                                                title="Share on Twitter"
                                                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#1DA1F2] text-white rounded-xl hover:opacity-90 transition-opacity"
                                            >
                                                <Twitter className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleShare('facebook')}
                                                title="Share on Facebook"
                                                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#4267B2] text-white rounded-xl hover:opacity-90 transition-opacity"
                                            >
                                                <Facebook className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleShare('linkedin')}
                                                title="Share on LinkedIn"
                                                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#0077B5] text-white rounded-xl hover:opacity-90 transition-opacity"
                                            >
                                                <Linkedin className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleShare('whatsapp')}
                                                title="Share on WhatsApp"
                                                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#25D366] text-white rounded-xl hover:opacity-90 transition-opacity"
                                            >
                                                <MessageCircle className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleShare('email')}
                                                title="Share via Email"
                                                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gray-500 text-white rounded-xl hover:opacity-90 transition-opacity"
                                            >
                                                <Mail className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Delete Link */}
                                    <button
                                        onClick={() => {
                                            deleteShareLink(shareLink.id);
                                            setShareLink(null);
                                        }}
                                        className="w-full py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl text-sm transition-colors"
                                    >
                                        Remove Share Link
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default { useBookSharing, ShareModal };
