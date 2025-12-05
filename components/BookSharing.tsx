import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Share2, Link, Copy, Check, Twitter, Facebook, Linkedin,
    Mail, MessageCircle, QrCode, Globe, Lock, Eye, EyeOff,
    Download, X, ExternalLink, Users, Clock, Code, Smartphone,
    Calendar, Shield
} from 'lucide-react';
import { BookProject } from '../types';
import { shareService, ShareLink as ServiceShareLink, ShareSettings } from '../services/shareService';
import { saveBook } from '../services/storageService';

// Extend the service type to include the computed URL for UI
interface ShareLink extends ServiceShareLink {
    url: string;
}

// Generate QR Code URL using a public API
const generateQRCodeUrl = (url: string, size: number = 200): string => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&bgcolor=FFFFFF&color=FF9B71&margin=10`;
};

// Generate embed code
const generateEmbedCode = (url: string, title: string): string => {
    return `<iframe 
  src="${url}?embed=true" 
  title="${title}" 
  width="100%" 
  height="600" 
  frameborder="0" 
  style="border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);"
  allow="fullscreen"
></iframe>`;
};

// Hook for managing book shares
export function useBookSharing() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const getShareUrl = (shortCode: string) => `${window.location.origin}/shared/${shortCode}`;

    const createShareLink = useCallback(async (bookId: string, settings: ShareSettings): Promise<ShareLink | null> => {
        setLoading(true);
        setError(null);
        try {
            const shortCode = await shareService.createShareLink(bookId, settings);
            const link = await shareService.getShareLink(bookId);
            if (!link) throw new Error('Failed to retrieve created link');

            return {
                ...link,
                url: getShareUrl(link.shortCode)
            };
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create link');
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    const getShareLink = useCallback(async (bookId: string): Promise<ShareLink | null> => {
        setLoading(true);
        try {
            const link = await shareService.getShareLink(bookId);
            if (!link) return null;
            return {
                ...link,
                url: getShareUrl(link.shortCode)
            };
        } catch (err) {
            console.error(err);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    const updateShareSettings = useCallback(async (shortCode: string, settings: ShareSettings) => {
        setLoading(true);
        try {
            await shareService.updateShareSettings(shortCode, settings);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update settings');
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const deleteShareLink = useCallback(async (shortCode: string) => {
        setLoading(true);
        try {
            await shareService.deleteShareLink(shortCode);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete link');
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    return {
        loading,
        error,
        createShareLink,
        getShareLink,
        updateShareSettings,
        deleteShareLink,
    };
}

// Tab types for the share modal
type ShareTab = 'link' | 'qr' | 'embed';

// Share Modal Component
interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    book: BookProject;
    userName?: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, book, userName }) => {
    const { createShareLink, getShareLink, updateShareSettings, deleteShareLink, loading, error } = useBookSharing();
    const [copied, setCopied] = useState(false);
    const [copiedEmbed, setCopiedEmbed] = useState(false);
    const [activeTab, setActiveTab] = useState<ShareTab>('link');
    const [showAdvanced, setShowAdvanced] = useState(false);

    const [shareLink, setShareLink] = useState<ShareLink | null>(null);
    const [settings, setSettings] = useState<ShareSettings>({
        isPublic: true,
        allowDownload: true,
        expiresAt: null,
        password: null,
        viewCount: 0,
    });
    const [passwordInput, setPasswordInput] = useState('');
    const [expirationDays, setExpirationDays] = useState<number | null>(null);

    // Load existing share link when modal opens
    useEffect(() => {
        if (isOpen && book.id) {
            getShareLink(book.id).then(link => {
                if (link) {
                    setShareLink(link);
                    setSettings(link.settings);
                    if (link.settings.password) setPasswordInput(link.settings.password);
                    // Calculate expiration days if needed, but for now just leave as is
                } else {
                    setShareLink(null);
                    // Reset settings for new link
                    setSettings({
                        isPublic: true,
                        allowDownload: true,
                        expiresAt: null,
                        password: null,
                        viewCount: 0,
                    });
                }
            });
        }
    }, [isOpen, book.id, getShareLink]);

    const handleCreateLink = async () => {
        const finalSettings = { ...settings };

        if (passwordInput) {
            finalSettings.password = passwordInput;
            finalSettings.isPublic = false;
        }

        if (expirationDays) {
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + expirationDays);
            finalSettings.expiresAt = expiresAt.toISOString();
        }

        // Ensure book is saved to Supabase before sharing
        try {
            await saveBook(book);
        } catch (err) {
            console.error('Failed to save book before sharing:', err);
        }

        const newShare = await createShareLink(book.id, finalSettings);
        if (newShare) {
            setShareLink(newShare);
        }
    };

    const handleUpdateSettings = async (newSettings: Partial<ShareSettings>) => {
        if (!shareLink) return;
        const updatedSettings = { ...settings, ...newSettings };
        setSettings(updatedSettings);
        await updateShareSettings(shareLink.shortCode, updatedSettings);

        // Refresh link data
        const refreshed = await getShareLink(book.id);
        if (refreshed) setShareLink(refreshed);
    };

    const handleCopyLink = async () => {
        if (shareLink) {
            await navigator.clipboard.writeText(shareLink.url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleCopyEmbed = async () => {
        if (shareLink) {
            const embedCode = generateEmbedCode(shareLink.url, book.title);
            await navigator.clipboard.writeText(embedCode);
            setCopiedEmbed(true);
            setTimeout(() => setCopiedEmbed(false), 2000);
        }
    };

    const handleDownloadQR = async () => {
        if (!shareLink) return;

        const qrUrl = generateQRCodeUrl(shareLink.url, 400);
        const response = await fetch(qrUrl);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `${book.title.replace(/\s+/g, '-')}-qr-code.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
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
                    className="relative bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                >
                    {/* Header */}
                    <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
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
                    <div className="p-6 space-y-6 overflow-y-auto flex-1">
                        {error && (
                            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3 text-red-600 dark:text-red-400">
                                <div className="p-2 bg-red-100 dark:bg-red-900/40 rounded-full">
                                    <Shield className="w-4 h-4" />
                                </div>
                                <p className="text-sm font-medium">{error}</p>
                            </div>
                        )}
                        {loading && !shareLink ? (
                            <div className="flex justify-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-coral-burst"></div>
                            </div>
                        ) : !shareLink ? (
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
                                                w-11 h-6 rounded-full transition-colors relative flex-shrink-0
                                                ${settings.isPublic ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}
                                            `}
                                        >
                                            <span className={`
                                                absolute top-1 w-4 h-4 bg-white rounded-full transition-transform
                                                ${settings.isPublic ? 'translate-x-[1.375rem]' : 'translate-x-1'}
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
                                                w-11 h-6 rounded-full transition-colors relative flex-shrink-0
                                                ${settings.allowDownload ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}
                                            `}
                                        >
                                            <span className={`
                                                absolute top-1 w-4 h-4 bg-white rounded-full transition-transform
                                                ${settings.allowDownload ? 'translate-x-[1.375rem]' : 'translate-x-1'}
                                            `} />
                                        </button>
                                    </div>
                                </div>

                                {/* Advanced Options Toggle */}
                                <button
                                    onClick={() => setShowAdvanced(!showAdvanced)}
                                    className="text-sm text-coral-burst hover:underline flex items-center gap-1"
                                >
                                    <Shield className="w-4 h-4" />
                                    {showAdvanced ? 'Hide' : 'Show'} Advanced Options
                                </button>

                                {/* Advanced Options */}
                                <AnimatePresence>
                                    {showAdvanced && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="space-y-4 overflow-hidden"
                                        >
                                            {/* Password Protection */}
                                            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl space-y-3">
                                                <div className="flex items-center gap-2">
                                                    <Lock className="w-4 h-4 text-gray-500" />
                                                    <p className="font-medium text-gray-900 dark:text-white text-sm">
                                                        Password Protection
                                                    </p>
                                                </div>
                                                <input
                                                    type="password"
                                                    value={passwordInput}
                                                    onChange={(e) => setPasswordInput(e.target.value)}
                                                    placeholder="Optional password"
                                                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-coral-burst bg-white dark:bg-gray-900"
                                                />
                                            </div>

                                            {/* Expiration */}
                                            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl space-y-3">
                                                <div className="flex items-center gap-2">
                                                    <Calendar className="w-4 h-4 text-gray-500" />
                                                    <p className="font-medium text-gray-900 dark:text-white text-sm">
                                                        Link Expiration
                                                    </p>
                                                </div>
                                                <div className="flex gap-2">
                                                    {[null, 7, 30, 90].map((days) => (
                                                        <button
                                                            key={days ?? 'never'}
                                                            onClick={() => setExpirationDays(days)}
                                                            className={`
                                                                flex-1 py-2 text-xs rounded-lg transition-colors
                                                                ${expirationDays === days
                                                                    ? 'bg-coral-burst text-white'
                                                                    : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
                                                                }
                                                            `}
                                                        >
                                                            {days === null ? 'Never' : `${days} days`}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <button
                                    onClick={handleCreateLink}
                                    disabled={loading}
                                    className="w-full py-3 bg-coral-burst text-white rounded-xl font-medium hover:bg-coral-burst/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {loading ? (
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                    ) : (
                                        <>
                                            <Link className="w-5 h-5" />
                                            Create Share Link
                                        </>
                                    )}
                                </button>
                            </>
                        ) : (
                            <>
                                {/* Tabs */}
                                <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
                                    {[
                                        { id: 'link' as ShareTab, icon: Link, label: 'Link' },
                                        { id: 'qr' as ShareTab, icon: QrCode, label: 'QR Code' },
                                        { id: 'embed' as ShareTab, icon: Code, label: 'Embed' },
                                    ].map((tab) => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id)}
                                            className={`
                                                flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors
                                                ${activeTab === tab.id
                                                    ? 'bg-white dark:bg-gray-700 text-coral-burst shadow-sm'
                                                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                                }
                                            `}
                                        >
                                            <tab.icon className="w-4 h-4" />
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>

                                {/* Tab Content */}
                                <AnimatePresence mode="wait">
                                    {activeTab === 'link' && (
                                        <motion.div
                                            key="link"
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            className="space-y-4"
                                        >
                                            {/* Share Link Display */}
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

                                            {/* Settings Update Controls */}
                                            <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm text-gray-600 dark:text-gray-400">Public Access</span>
                                                    <button
                                                        onClick={() => handleUpdateSettings({ isPublic: !settings.isPublic })}
                                                        className={`w-10 h-5 rounded-full relative transition-colors flex-shrink-0 ${settings.isPublic ? 'bg-green-500' : 'bg-gray-300'}`}
                                                    >
                                                        <span className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-transform ${settings.isPublic ? 'translate-x-5' : 'translate-x-1'}`} />
                                                    </button>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm text-gray-600 dark:text-gray-400">Allow Downloads</span>
                                                    <button
                                                        onClick={() => handleUpdateSettings({ allowDownload: !settings.allowDownload })}
                                                        className={`w-10 h-5 rounded-full relative transition-colors flex-shrink-0 ${settings.allowDownload ? 'bg-blue-500' : 'bg-gray-300'}`}
                                                    >
                                                        <span className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-transform ${settings.allowDownload ? 'translate-x-5' : 'translate-x-1'}`} />
                                                    </button>
                                                </div>
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
                                        </motion.div>
                                    )}

                                    {activeTab === 'qr' && (
                                        <motion.div
                                            key="qr"
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            className="space-y-4"
                                        >
                                            {/* QR Code Display */}
                                            <div className="flex flex-col items-center p-6 bg-gray-50 dark:bg-gray-800 rounded-xl">
                                                <div className="bg-white p-4 rounded-2xl shadow-lg">
                                                    <img
                                                        src={generateQRCodeUrl(shareLink.url, 200)}
                                                        alt="QR Code"
                                                        className="w-48 h-48"
                                                    />
                                                </div>
                                                <p className="mt-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                                                    Scan this QR code with your phone to view the book
                                                </p>
                                            </div>

                                            {/* Download QR Button */}
                                            <button
                                                onClick={handleDownloadQR}
                                                className="w-full py-3 bg-coral-burst text-white rounded-xl font-medium hover:bg-coral-burst/90 transition-colors flex items-center justify-center gap-2"
                                            >
                                                <Download className="w-5 h-5" />
                                                Download QR Code
                                            </button>

                                            <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
                                                Perfect for printing on flyers, business cards, or sharing in presentations
                                            </p>
                                        </motion.div>
                                    )}

                                    {activeTab === 'embed' && (
                                        <motion.div
                                            key="embed"
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            className="space-y-4"
                                        >
                                            {/* Embed Code Display */}
                                            <div className="space-y-2">
                                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                                    Embed Code
                                                </p>
                                                <div className="relative">
                                                    <pre className="p-4 bg-gray-900 text-green-400 rounded-xl text-xs overflow-x-auto">
                                                        {generateEmbedCode(shareLink.url, book.title)}
                                                    </pre>
                                                    <button
                                                        onClick={handleCopyEmbed}
                                                        title="Copy embed code"
                                                        className={`
                                                            absolute top-2 right-2 p-2 rounded-lg transition-colors
                                                            ${copiedEmbed
                                                                ? 'bg-green-500 text-white'
                                                                : 'bg-gray-700 text-white hover:bg-gray-600'
                                                            }
                                                        `}
                                                    >
                                                        {copiedEmbed ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Preview */}
                                            <div className="space-y-2">
                                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                                    Preview
                                                </p>
                                                <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-gray-50 dark:bg-gray-800">
                                                    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-4 text-center">
                                                        <div className="w-full h-32 bg-gradient-to-br from-coral-burst/20 to-gold-sunshine/20 rounded-lg flex items-center justify-center">
                                                            <span className="text-gray-400 text-sm">
                                                                📖 {book.title}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
                                                Paste this code into your website's HTML to embed the book viewer
                                            </p>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* Delete Link */}
                                <button
                                    onClick={async () => {
                                        if (confirm('Are you sure you want to stop sharing this book? The link will no longer work.')) {
                                            await deleteShareLink(shareLink.shortCode);
                                            setShareLink(null);
                                        }
                                    }}
                                    className="w-full py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl text-sm transition-colors"
                                >
                                    Remove Share Link
                                </button>
                            </>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default { useBookSharing, ShareModal };
