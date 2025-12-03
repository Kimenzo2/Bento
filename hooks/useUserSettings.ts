import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

export interface UserSettings {
    displayName: string;
    email: string;
    bio: string;
    defaultStyle: string;
    temperature: number;
    emailUpdates: boolean;
    marketingEmails: boolean;
    publicProfile: boolean;
    dataSharing: boolean;
}

export interface UserDisplayData {
    displayName: string;
    email: string;
    avatarUrl: string | null;
    bio: string;
    settings: UserSettings;
}

const DEFAULT_SETTINGS: UserSettings = {
    displayName: '',
    email: '',
    bio: 'I love creating magical stories for children...',
    defaultStyle: 'Watercolor',
    temperature: 0.7,
    emailUpdates: true,
    marketingEmails: false,
    publicProfile: true,
    dataSharing: false
};

/**
 * Hook to get unified user display data from both Auth context and localStorage settings
 */
export const useUserSettings = (): UserDisplayData & { updateSettings: (settings: Partial<UserSettings>) => void } => {
    const { user } = useAuth();
    
    const [settings, setSettings] = useState<UserSettings>(() => {
        try {
            const saved = localStorage.getItem('genesis_settings');
            return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
        } catch {
            return DEFAULT_SETTINGS;
        }
    });

    const [customAvatar, setCustomAvatar] = useState<string | null>(() => {
        try {
            return localStorage.getItem('genesis_avatar');
        } catch {
            return null;
        }
    });

    // Listen for storage changes (for cross-tab sync)
    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'genesis_settings' && e.newValue) {
                try {
                    setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(e.newValue) });
                } catch { }
            }
            if (e.key === 'genesis_avatar') {
                setCustomAvatar(e.newValue);
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    // Sync with user data when user changes
    useEffect(() => {
        if (user) {
            const userName = user.user_metadata?.full_name || 
                             user.user_metadata?.name || 
                             user.email?.split('@')[0] || 
                             'Creative Author';
            
            setSettings(prev => ({
                ...prev,
                displayName: prev.displayName || userName,
                email: user.email || prev.email
            }));
        }
    }, [user]);

    const updateSettings = (newSettings: Partial<UserSettings>) => {
        setSettings(prev => {
            const updated = { ...prev, ...newSettings };
            try {
                localStorage.setItem('genesis_settings', JSON.stringify(updated));
            } catch (e) {
                console.error('Failed to save settings:', e);
            }
            return updated;
        });
    };

    // Determine best avatar to use (custom > user metadata > null)
    const avatarUrl = customAvatar || 
                      user?.user_metadata?.avatar_url || 
                      user?.user_metadata?.picture || 
                      null;

    // Determine best display name
    const displayName = settings.displayName || 
                        user?.user_metadata?.full_name || 
                        user?.user_metadata?.name || 
                        user?.email?.split('@')[0] || 
                        'Creator';

    return {
        displayName,
        email: settings.email || user?.email || '',
        avatarUrl,
        bio: settings.bio,
        settings,
        updateSettings
    };
};

/**
 * Get the user's preferred default art style from settings
 */
export const getDefaultArtStyle = (): string => {
    try {
        const saved = localStorage.getItem('genesis_settings');
        if (saved) {
            const settings = JSON.parse(saved);
            return settings.defaultStyle || 'Watercolor';
        }
    } catch { }
    return 'Watercolor';
};

/**
 * Get the user's preferred creativity temperature
 */
export const getCreativityTemperature = (): number => {
    try {
        const saved = localStorage.getItem('genesis_settings');
        if (saved) {
            const settings = JSON.parse(saved);
            return settings.temperature ?? 0.7;
        }
    } catch { }
    return 0.7;
};
