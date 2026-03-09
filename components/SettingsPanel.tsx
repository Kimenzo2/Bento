import { IcoBook } from './IconscoutIcons';
import { ArrowLeft, Bell, Calendar, CheckCircle, CreditCard, Database, Eye, FolderOpen, Globe, Image, ImageIcon, Info, LogOut, Newspaper, Save, Shield, Smartphone, Type, Upload, User, Wrench } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getUserProfile, updateUserProfile, type UserProfile } from '../services/profileService';
import { getTierLimits } from '../services/tierLimits';
import { AppMode, type SavedBook, UserTier } from '../types';
import AboutSection from './settings/AboutSection';
import AccessibilitySettings from './settings/AccessibilitySettings';
import AdvancedSettings from './settings/AdvancedSettings';
import DataManagement from './settings/DataManagement';
import FontSelector from './settings/FontSelector';
import { LanguageSelector } from './settings/LanguageSelector';
import LibraryPanel from './settings/LibraryPanel';
import SessionManagement from './settings/SessionManagement';
import ThemeSelector from './settings/ThemeSelector';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { Input, Label, Textarea } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Slider } from './ui/slider';
import { Switch } from './ui/switch';
import { ToggleRow } from './ui/toggle-row';
import { toast } from './ui/sonner';
import { useTranslation } from 'react-i18next';
import { usePageSEO } from '../hooks/usePageSEO';

interface SettingsPanelProps {
  onNavigate?: (mode: AppMode) => void;
  userTier?: UserTier;
  onViewBook?: (book: SavedBook) => void;
}

type SettingsTabId =
  | 'profile'
  | 'notifications'
  | 'privacy'
  | 'subscriptions'
  | 'themes'
  | 'library'
  | 'typography'
  | 'language'
  | 'accessibility'
  | 'data'
  | 'sessions'
  | 'advanced'
  | 'about';

interface SettingsTabButtonProps {
  id: SettingsTabId;
  activeTab: SettingsTabId;
  onSelect: (id: SettingsTabId) => void;
  icon: React.ElementType;
  label: string;
}

const SettingsTabButton = ({
  id,
  activeTab,
  onSelect,
  icon: Icon,
  label,
}: SettingsTabButtonProps) => (
  <Button
    variant="ghost"
    onClick={() => onSelect(id)}
    className={[
      'shrink-0 md:w-full md:gap-3 px-4 md:px-4 py-3 touch-manipulation min-w-30 md:min-w-0',
      activeTab === id
        ? 'bg-surface text-coral-burst font-bold border border-peach-soft'
        : 'bg-transparent text-cocoa-light hover:bg-surface/50 hover:text-charcoal-soft border border-transparent',
    ].join(' ')}
  >
    <Icon className="w-4 h-4 md:w-5 md:h-5 shrink-0" />
    <span className="text-sm md:text-base whitespace-nowrap">{label}</span>
  </Button>
);


const SettingsPanel: React.FC<SettingsPanelProps> = ({
  onNavigate,
  onViewBook,
  userTier: propsUserTier,
}) => {
  const { user, signOut, refreshProfile } = useAuth();
  const { t } = useTranslation('settings');

  usePageSEO({
    title: 'Settings — Genesis AI Visual Storytelling',
    description: 'Manage your Genesis account, preferences, subscriptions, and creative workspace settings.',
    canonical: '/settings',
  });

  const [userProfile, setUserProfile] = React.useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = React.useState(true);
  const profileLoadedRef = React.useRef(false);

  // Fetch user profile to get real tier
  React.useEffect(() => {
    const fetchProfile = async () => {
      setIsLoadingProfile(true);
      const profile = await getUserProfile();
      setUserProfile(profile);
      setIsLoadingProfile(false);
    };
    fetchProfile();
  }, [user]);

  // Get actual user tier from profile, fallback to props or SPARK
  const actualUserTier = userProfile?.user_tier || propsUserTier || UserTier.SPARK;
  const [activeTab, setActiveTab] = useState<SettingsTabId>('profile');
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const memberSince = user?.created_at
    ? new Date(user.created_at).getFullYear()
    : new Date().getFullYear();

  // Initialize avatar from localStorage or user's avatar
  const [avatarPreview, setAvatarPreview] = useState<string | null>(() => {
    try {
      // Try localStorage first, then fall back to user's avatar
      return localStorage.getItem('genesis_avatar') || null;
    } catch (_e) {
      return null;
    }
  });

  // Initialize form data from localStorage or defaults
  const [formData, setFormData] = useState(() => {
    const defaults = {
      displayName: '',
      email: '',
      bio: 'I love creating magical stories for children...',
      defaultStyle: 'Watercolor',
      temperature: 0.7,
      emailUpdates: true,
      marketingEmails: false,
      publicProfile: true,
      dataSharing: false,
      autoRotate: false,
      // Accessibility
      reducedMotion: false,
      highContrast: false,
      screenReaderMode: false,
      keyboardNavigation: true,
      fontSize: 'medium',
      soundEffects: true,
      // Advanced
      developerMode: false,
      debugLogs: false,
      betaFeatures: false,
      experimentalUI: false,
      showPerformanceMetrics: false,
      autoSave: true,
    };

    try {
      const saved = localStorage.getItem('genesis_settings');
      if (saved) {
        return { ...defaults, ...JSON.parse(saved) };
      }
      return defaults;
    } catch (_e) {
      return defaults;
    }
  });

  // Sync form data with DB profile — DB is the source of truth for identity + settings
  useEffect(() => {
    if (!user) return;

    // When DB profile loads for the first time, force-set ALL fields from DB
    // This ensures DB data overrides stale localStorage for identity fields
    if (userProfile && !profileLoadedRef.current) {
      profileLoadedRef.current = true;

      const dbName =
        userProfile.display_name ||
        userProfile.full_name ||
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split('@')[0] ||
        'Creative Author';

      setFormData((prev: any) => ({
        ...prev,
        // Identity fields: DB always wins
        displayName: dbName,
        email: userProfile.email || user.email || prev.email,
        // Settings fields: DB wins over defaults, but localStorage overrides (user may have unsaved local changes)
        bio: userProfile.bio || prev.bio,
        defaultStyle: userProfile.default_style || prev.defaultStyle,
        temperature: userProfile.creativity_temperature ?? prev.temperature,
        emailUpdates: userProfile.email_notifications ?? prev.emailUpdates,
        marketingEmails: userProfile.marketing_emails ?? prev.marketingEmails,
        publicProfile: userProfile.is_public ?? prev.publicProfile,
        dataSharing: userProfile.data_sharing_enabled ?? prev.dataSharing,
      }));

      // Avatar: DB profile > metadata > localStorage
      const dbAvatar =
        userProfile.avatar_url ||
        user.user_metadata?.avatar_url ||
        user.user_metadata?.picture ||
        null;
      if (dbAvatar) {
        // Only override if user hasn't uploaded a custom avatar
        const customAvatar = localStorage.getItem('genesis_avatar');
        if (!customAvatar || !customAvatar.startsWith('data:')) {
          setAvatarPreview(dbAvatar);
        }
      }
      return;
    }

    // Before DB profile loads, use metadata as temporary fallback
    if (!userProfile && !profileLoadedRef.current) {
      const metaName =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split('@')[0] ||
        'Creative Author';

      setFormData((prev: any) => ({
        ...prev,
        displayName: prev.displayName || metaName,
        email: user.email || prev.email,
      }));

      const metaAvatar =
        user.user_metadata?.avatar_url ||
        user.user_metadata?.picture ||
        null;
      if (metaAvatar && !localStorage.getItem('genesis_avatar')) {
        setAvatarPreview(metaAvatar);
      }
    }
  }, [user, userProfile]);

  const handleChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      // 1. Persist UI preferences to localStorage (themes, toggles, etc.)
      localStorage.setItem('genesis_settings', JSON.stringify(formData));
      if (avatarPreview) {
        localStorage.setItem('genesis_avatar', avatarPreview);
      }
      window.dispatchEvent(new Event('genesis-settings-changed'));

      // 2. Persist profile data to Supabase DB (the source of truth)
      if (user) {
        const profileUpdates: Record<string, any> = {
          display_name: formData.displayName || undefined,
          full_name: formData.displayName || undefined,
          bio: formData.bio || undefined,
          default_style: formData.defaultStyle || undefined,
          creativity_temperature: formData.temperature,
          email_notifications: formData.emailUpdates,
          marketing_emails: formData.marketingEmails,
          is_public: formData.publicProfile,
          data_sharing_enabled: formData.dataSharing,
        };

        // If avatar is a URL (not base64), persist it to DB
        if (avatarPreview && !avatarPreview.startsWith('data:')) {
          profileUpdates.avatar_url = avatarPreview;
        }

        const updatedProfile = await updateUserProfile(profileUpdates);
        if (updatedProfile) {
          setUserProfile(updatedProfile);
          // Refresh AuthContext's profile so all components get fresh data
          await refreshProfile();
        } else {
          console.error('[Settings] Failed to save profile to database');
        }
      }
    } catch (e) {
      console.error('Failed to save settings:', e);
      setIsSaving(false);
      toast.error(t('messages.saveError', { defaultValue: 'Failed to save settings' }), {
        description: 'Please try again.',
      });
      return;
    }

    setIsSaving(false);
    toast.success(t('savedSuccessfully', { defaultValue: 'Settings saved successfully' }));
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error(t('messages.selectImageFile', { defaultValue: 'Please select an image file.' }));
        return;
      }
      // Validate file size (max 2MB to stay within localStorage limits)
      if (file.size > 2 * 1024 * 1024) {
        toast.error(
          t('messages.imageTooLarge', {
            defaultValue: 'Image is too large',
          }),
          { description: 'Choose an image smaller than 2MB.' }
        );
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };


  return (
    <div className="w-full max-w-4xl mx-auto p-4 md:p-6 pb-24 animate-fadeIn relative">


      <div className="mb-6 md:mb-10 flex items-center gap-3 md:gap-4">
        {onNavigate && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onNavigate(AppMode.DASHBOARD)}
            className="p-2 -ml-2 hover:bg-cream-soft text-cocoa-light hover:text-coral-burst touch-manipulation"
            aria-label={t('actions.goBack', { defaultValue: 'Go back' })}
          >
            <ArrowLeft className="w-5 h-5 md:w-6 md:h-6" />
          </Button>
        )}
        <div>
          <h1 className="font-heading font-bold text-2xl md:text-4xl text-charcoal-soft mb-1 md:mb-2">
            {t('settings', { defaultValue: 'Settings' })}
          </h1>
          <p className="text-cocoa-light font-body text-sm md:text-base">
            {t('settingsDescription', {
              defaultValue: 'Manage your profile, preferences, and system configuration.',
            })}
          </p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 md:gap-8">
        {/* Sidebar Menu - Horizontal scroll on mobile, vertical on desktop */}
        <div className="w-full md:w-64">
          <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide">
            <SettingsTabButton activeTab={activeTab} onSelect={setActiveTab} id="profile" icon={User} label={t('tabs.profile', { defaultValue: 'Profile' })} />
            <SettingsTabButton activeTab={activeTab} onSelect={setActiveTab} id="library" icon={FolderOpen} label={t('tabs.library', { defaultValue: 'My Library' })} />
            <SettingsTabButton activeTab={activeTab} onSelect={setActiveTab} id="themes" icon={ImageIcon} label={t('tabs.themes', { defaultValue: 'Themes' })} />
            <SettingsTabButton activeTab={activeTab} onSelect={setActiveTab} id="typography" icon={Type} label={t('tabs.typography', { defaultValue: 'Typography' })} />
            <SettingsTabButton activeTab={activeTab} onSelect={setActiveTab} id="language" icon={Globe} label={t('tabs.language', { defaultValue: 'Language' })} />
            <SettingsTabButton activeTab={activeTab} onSelect={setActiveTab} id="accessibility" icon={Eye} label={t('tabs.accessibility', { defaultValue: 'Accessibility' })} />
            <SettingsTabButton activeTab={activeTab} onSelect={setActiveTab} id="subscriptions" icon={CreditCard} label={t('tabs.subscriptions', { defaultValue: 'Subscriptions' })} />
            <SettingsTabButton activeTab={activeTab} onSelect={setActiveTab} id="notifications" icon={Bell} label={t('tabs.notifications', { defaultValue: 'Notifications' })} />
            <SettingsTabButton activeTab={activeTab} onSelect={setActiveTab} id="privacy" icon={Shield} label={t('tabs.privacy', { defaultValue: 'Privacy' })} />
            <SettingsTabButton activeTab={activeTab} onSelect={setActiveTab} id="data" icon={Database} label={t('tabs.data', { defaultValue: 'Data & Export' })} />
            <SettingsTabButton activeTab={activeTab} onSelect={setActiveTab} id="sessions" icon={Smartphone} label={t('tabs.sessions', { defaultValue: 'Sessions' })} />
            <SettingsTabButton activeTab={activeTab} onSelect={setActiveTab} id="advanced" icon={Wrench} label={t('tabs.advanced', { defaultValue: 'Advanced' })} />
            <SettingsTabButton activeTab={activeTab} onSelect={setActiveTab} id="about" icon={Info} label={t('tabs.about', { defaultValue: 'About' })} />

            <a
              href="https://genesis-1765265007.documentationai.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 md:w-full flex items-center gap-2 md:gap-3 px-4 md:px-4 py-3 rounded-xl transition-all duration-200 touch-manipulation min-w-30 md:min-w-0 bg-transparent text-cocoa-light hover:bg-surface/50 hover:text-charcoal-soft"
            >
              <IcoBook className="w-4 h-4 md:w-5 md:h-5 shrink-0" />
              <span className="text-sm md:text-base whitespace-nowrap">{t('helpCenter', { defaultValue: 'Help Center' })}</span>
            </a>

            <a
              href="/blog"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 md:w-full flex items-center gap-2 md:gap-3 px-3 md:px-4 py-3 rounded-xl transition-all duration-200 touch-manipulation min-w-30 md:min-w-0 bg-cream-base border border-peach-soft hover:bg-peach-soft/20"
            >
              <Newspaper className="w-4 h-4 md:w-5 md:h-5 shrink-0 text-coral-burst" />
              <span
                className="text-sm md:text-base whitespace-nowrap text-coral-burst font-normal tracking-[0.01em]"
                style={{ fontFamily: '"Instrument Serif", Georgia, serif' }}
              >
                Blog
              </span>
            </a>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 bg-surface rounded-2xl md:rounded-3xl border border-peach-soft/50 p-4 md:p-8 min-h-100 md:min-h-[500px] relative">
          {/* Content Area */}
          <div className="space-y-6">
            {activeTab === 'profile' && (
              <div className="animate-fadeIn space-y-6 md:space-y-8">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 md:gap-6">
                  <div className="relative group shrink-0">
                    <Avatar className="w-20 h-20 md:w-24 md:h-24 border border-gold-sunshine">
                      <AvatarImage src={avatarPreview || undefined} alt="Avatar" />
                      <AvatarFallback className="bg-linear-to-br from-gold-sunshine to-coral-burst text-white">
                        <User className="w-8 h-8 md:w-10 md:h-10" />
                      </AvatarFallback>
                    </Avatar>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleAvatarClick}
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 touch-manipulation"
                    >
                      <Upload className="w-5 h-5 md:w-6 md:h-6 text-white" />
                    </Button>
                    <Input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      className="hidden"
                      accept="image/*"
                    />
                  </div>
                  <div className="text-center sm:text-left">
                    <h3 className="font-heading font-bold text-xl md:text-2xl text-charcoal-soft">
                      {formData.displayName}
                    </h3>
                    <p className="text-cocoa-light text-sm md:text-base">
                      {isLoadingProfile ? (
                        <span className="animate-pulse">{t('loading', { defaultValue: 'Loading...' })}</span>
                      ) : (
                        <>
                          <span
                            className={`font-bold ${
                              actualUserTier === UserTier.SPARK
                                ? 'text-cocoa-light'
                                : actualUserTier === UserTier.CREATOR
                                  ? 'text-blue-600'
                                  : actualUserTier === UserTier.STUDIO
                                    ? 'text-coral-burst'
                                    : 'text-purple-600'
                            }`}
                          >
                            {t(`tiers.${actualUserTier.toLowerCase()}`, {
                              defaultValue: actualUserTier.charAt(0) + actualUserTier.slice(1).toLowerCase(),
                            })}
                          </span>
                          {` ${t('profilePlanMemberSince', {
                            defaultValue: 'Plan • Member since {{year}}',
                            year: memberSince,
                          })}`}
                        </>
                      )}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleAvatarClick}
                      className="mt-2 text-coral-burst hover:underline mx-auto sm:mx-0 touch-manipulation"
                    >
                      <ImageIcon className="w-3 h-3" /> {t('changeAvatar', { defaultValue: 'Change Avatar' })}
                    </Button>
                  </div>
                </div>
                <div className="h-px bg-peach-soft/50 w-full"></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>
                      {t('displayName', { defaultValue: 'Display Name' })}
                    </Label>
                    <Input
                      type="text"
                      value={formData.displayName}
                      onChange={(e) => handleChange('displayName', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>
                      {t('emailAddress', { defaultValue: 'Email Address' })}
                    </Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>
                    {t('bioAuthorNote', { defaultValue: 'Bio / Author Note' })}
                  </Label>
                  <Textarea
                    value={formData.bio}
                    onChange={(e) => handleChange('bio', e.target.value)}
                    className="h-24"
                  />
                </div>
                <div className="space-y-2">
                  <Label>
                    {t('defaultArtStyle', { defaultValue: 'Default Art Style' })}
                  </Label>
                  <Select
                    value={formData.defaultStyle}
                    onValueChange={(value) => handleChange('defaultStyle', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('chooseArtStyle', { defaultValue: 'Choose art style' })} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Watercolor">Watercolor</SelectItem>
                      <SelectItem value="3D Render (Pixar Style)">3D Render (Pixar Style)</SelectItem>
                      <SelectItem value="Japanese Manga">Japanese Manga</SelectItem>
                      <SelectItem value="Corporate Minimalist">Corporate Minimalist</SelectItem>
                      <SelectItem value="Cyberpunk Neon">Cyberpunk Neon</SelectItem>
                      <SelectItem value="Vintage Illustration">Vintage Illustration</SelectItem>
                      <SelectItem value="Paper Cutout Art">Paper Cutout Art</SelectItem>
                      <SelectItem value="Flat Design">Flat Design</SelectItem>
                      <SelectItem value="Modern Infographic">Modern Infographic</SelectItem>
                      <SelectItem value="Technical Blueprint">Technical Blueprint</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <Label className="text-xs text-cocoa-light uppercase">
                      {t('creativityTemperature', { defaultValue: 'Creativity (Temperature)' })}
                    </Label>
                    <span className="text-xs font-bold text-coral-burst bg-coral-burst/10 px-2 py-1 rounded">
                      {formData.temperature}
                    </span>
                  </div>
                  <Slider
                    min={0}
                    max={1}
                    step={0.1}
                    value={[formData.temperature]}
                    onValueChange={([val]) => handleChange('temperature', val)}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-cocoa-light">
                    <span>{t('creativityScale.precise', { defaultValue: 'Precise' })}</span>
                    <span>{t('creativityScale.balanced', { defaultValue: 'Balanced' })}</span>
                    <span>{t('creativityScale.wild', { defaultValue: 'Wild' })}</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="animate-fadeIn space-y-2">
                <h3 className="font-heading font-bold text-lg text-charcoal-soft mb-4">
                  {t('emailPreferences', { defaultValue: 'Email Preferences' })}
                </h3>
                <ToggleRow
                  label={t('notificationLabels.generationComplete', { defaultValue: 'Generation Complete Alerts' })}
                  checked={formData.emailUpdates}
                  onCheckedChange={(val) => handleChange('emailUpdates', val)}
                />
                <ToggleRow
                  label={t('notificationLabels.marketingUpdates', { defaultValue: 'Marketing & Product Updates' })}
                  checked={formData.marketingEmails}
                  onCheckedChange={(val) => handleChange('marketingEmails', val)}
                />
              </div>
            )}

            {activeTab === 'privacy' && (
              <div className="animate-fadeIn space-y-2">
                <h3 className="font-heading font-bold text-lg text-charcoal-soft mb-4">
                  {t('privacyData', { defaultValue: 'Privacy & Data' })}
                </h3>
                <ToggleRow
                  label={t('privacyLabels.publicProfileVisibility', { defaultValue: 'Public Profile Visibility' })}
                  checked={formData.publicProfile}
                  onCheckedChange={(val) => handleChange('publicProfile', val)}
                />
                <ToggleRow
                  label={t('privacyLabels.allowAiTraining', { defaultValue: 'Allow Content Analysis for AI Training' })}
                  checked={formData.dataSharing}
                  onCheckedChange={(val) => handleChange('dataSharing', val)}
                />
                <div className="mt-8 p-4 bg-red-50 rounded-2xl border border-red-100">
                  <h4 className="text-sm font-bold text-red-800 mb-2">{t('dangerZone', { defaultValue: 'Danger Zone' })}</h4>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() =>
                      toast.info(
                        t('messages.deleteAccountRequested', {
                          defaultValue: 'To delete your account, please contact our support team.',
                        })
                      )
                    }
                    className="text-red-600 hover:underline hover:text-red-800"
                  >
                    {t('deleteAccountAllData', { defaultValue: 'Delete Account & All Data' })}
                  </Button>
                </div>
              </div>
            )}

            {activeTab === 'themes' && (
              <div className="space-y-6">
                <div className="bg-surface rounded-2xl p-6 border border-peach-soft/50">
                  <h3 className="font-heading font-bold text-lg text-charcoal-soft mb-4">
                    {t('displaySettings', { defaultValue: 'Display Settings' })}
                  </h3>
                  <ToggleRow
                    label={t('autoRotateScreen', { defaultValue: 'Auto Rotate Screen' })}
                    description={t('autoRotateScreenDescription', {
                      defaultValue:
                        'Allow the app to rotate when you turn your device. Keep off for vertical-only mode.',
                    })}
                    checked={formData.autoRotate}
                    onCheckedChange={(val) => handleChange('autoRotate', val)}
                  />
                </div>
                <ThemeSelector />
              </div>
            )}

            {activeTab === 'typography' && <FontSelector />}

            {activeTab === 'language' && <LanguageSelector />}

            {activeTab === 'library' && <LibraryPanel onViewBook={onViewBook} />}

            {activeTab === 'subscriptions' && (
              <div className="animate-fadeIn space-y-6">
                <div>
                  <h3 className="font-heading font-bold text-xl md:text-2xl text-charcoal-soft mb-2">
                    {t('currentPlan', { defaultValue: 'Current Plan' })}
                  </h3>
                  <p className="text-cocoa-light text-sm">{t('manageSubscriptionBilling', { defaultValue: 'Manage your subscription and billing' })}</p>
                </div>

                {/* Premium Black Card */}
                <div className="relative bg-linear-to-br from-gray-900 via-gray-800 to-black rounded-2xl md:rounded-3xl p-6 md:p-8 overflow-hidden">
                  {/* Card shine effect */}
                  <div className="absolute top-0 right-0 w-48 h-48 md:w-64 md:h-64 bg-linear-to-br from-white/10 to-transparent rounded-full blur-3xl"></div>

                  {/* Card Content */}
                  <div className="relative z-10">
                    <div className="flex items-start justify-between mb-6 md:mb-8">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-linear-to-br from-gold-sunshine to-coral-burst flex items-center justify-center">
                            <span className="text-white font-heading font-bold text-base md:text-lg">
                              G
                            </span>
                          </div>
                          <span className="text-white/60 text-xs md:text-sm font-medium">
                            Genesis
                          </span>
                        </div>
                        <h4 className="font-heading font-bold text-2xl md:text-3xl text-white mb-1">
                          {t('subscriptionSection.currentTierPlan', {
                            defaultValue: '{{tier}} Plan',
                            tier: t(`tiers.${actualUserTier.toLowerCase()}`, {
                              defaultValue: actualUserTier.charAt(0) + actualUserTier.slice(1).toLowerCase(),
                            }),
                          })}
                        </h4>
                        <p className="text-white/70 text-xs md:text-sm">
                          {actualUserTier === UserTier.SPARK
                            ? t('subscriptionSection.freeForever', { defaultValue: 'Free Forever' })
                            : t('subscriptionSection.activeSubscription', { defaultValue: 'Active Subscription' })}
                        </p>
                      </div>
                      <span className="px-2.5 md:px-3 py-1 md:py-1.5 bg-green-500/20 text-green-400 text-xs font-bold rounded-full border border-green-500/30">
                        {t('active', { defaultValue: 'Active' })}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 md:gap-4 mb-5 md:mb-6">
                      <div>
                        <p className="text-white/50 text-xs mb-1">{t('subscriptionSection.ebooksPerMonth', { defaultValue: 'Ebooks / Month' })}</p>
                        <p className="text-white font-bold text-lg md:text-xl">{getTierLimits(actualUserTier).ebooksPerMonth === Number.POSITIVE_INFINITY ? '∞' : getTierLimits(actualUserTier).ebooksPerMonth}</p>
                      </div>
                      <div>
                        <p className="text-white/50 text-xs mb-1">{t('subscriptionSection.maxPages', { defaultValue: 'Max Pages' })}</p>
                        <p className="text-white font-bold text-lg md:text-xl">{getTierLimits(actualUserTier).maxPagesPerBook === 999 ? '∞' : getTierLimits(actualUserTier).maxPagesPerBook}</p>
                      </div>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-white/80">
                        <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                        <span>{t('subscriptionSection.featureStyles', { defaultValue: '5 illustration styles' })}</span>
                      </div>
                      <div className="flex items-center gap-2 text-white/80">
                        <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                        <span>{t('subscriptionSection.featureTemplates', { defaultValue: 'Standard templates' })}</span>
                      </div>
                      <div className="flex items-center gap-2 text-white/80">
                        <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                        <span>{t('subscriptionSection.featureSupport', { defaultValue: 'Community support' })}</span>
                      </div>
                    </div>

                    {/* Card chip effect */}
                    <div className="absolute bottom-6 right-6 md:bottom-8 md:right-8 w-10 h-10 md:w-12 md:h-12 bg-linear-to-br from-gold-sunshine/30 to-coral-burst/30 rounded-lg  border border-white/10"></div>
                  </div>
                </div>

                {/* Upgrade CTA */}
                <div className="bg-linear-to-r from-coral-burst to-gold-sunshine p-5 md:p-6 rounded-2xl text-white">
                  <h4 className="font-heading font-bold text-lg md:text-xl mb-2">
                    {t('subscriptionSection.unlockPremium', { defaultValue: 'Unlock Premium Features' })}
                  </h4>
                  <p className="text-sm text-white/90 mb-4">
                    {t('subscriptionSection.upgradeMessage', {
                      defaultValue:
                        'Upgrade to Creator (10 ebooks/month) or Visionary (unlimited) for advanced AI and priority support',
                    })}
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => onNavigate?.(AppMode.PRICING)}
                    className="bg-surface text-coral-burst hover:bg-surface/90 rounded-full border border-white"
                  >
                    {t('subscriptionSection.viewPlans', { defaultValue: 'View Plans' })}
                  </Button>
                </div>

                {/* Billing History */}
                <div>
                  <h4 className="font-heading font-bold text-base md:text-lg text-charcoal-soft mb-4">
                    {t('billingHistory', { defaultValue: 'Billing History' })}
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 bg-cream-base rounded-xl">
                      <div className="flex items-center gap-3">
                        <Calendar className="w-5 h-5 text-cocoa-light shrink-0" />
                        <div>
                          <p className="font-bold text-sm text-charcoal-soft">{t('subscriptionSection.sparkPlan', { defaultValue: 'Spark Plan' })}</p>
                          <p className="text-xs text-cocoa-light">{t('subscriptionSection.freeTierNoCharges', { defaultValue: 'Free tier - No charges' })}</p>
                        </div>
                      </div>
                      <span className="text-base md:text-lg font-bold text-charcoal-soft">
                        $0.00
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'accessibility' && (
              <AccessibilitySettings settings={formData} onUpdate={setFormData} />
            )}

            {activeTab === 'data' && (
              <DataManagement
                onShowSuccess={(_msg) => {
                  setShowSuccess(true);
                  setTimeout(() => setShowSuccess(false), 3000);
                }}
              />
            )}

            {activeTab === 'sessions' && (
              <SessionManagement
                onShowSuccess={(_msg) => {
                  setShowSuccess(true);
                  setTimeout(() => setShowSuccess(false), 3000);
                }}
              />
            )}

            {activeTab === 'advanced' && (
              <AdvancedSettings settings={formData} onUpdate={setFormData} />
            )}

            {activeTab === 'about' && <AboutSection />}
          </div>

          {/* Footer */}
          <div className="mt-8 md:mt-10 pt-5 md:pt-6 border-t border-peach-soft/50">
            <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 md:gap-4 mb-4">
              <Button
                variant="ghost"
                onClick={async () => {
                  await signOut();
                  window.location.href = '/auth';
                }}
                className="md:justify-start text-cocoa-light hover:text-red-500 px-4 py-3 md:py-2 hover:bg-red-50 touch-manipulation">
                <LogOut className="w-4 h-4" /> {t('actions.signOut', { defaultValue: 'Sign Out' })}
              </Button>
              <Button
                variant="primary"
                onClick={handleSave}
                disabled={isSaving}
                className="w-full md:w-auto rounded-full"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border border-white/30 border-t-white rounded-full animate-spin"></div>
                    {t('actions.saving', { defaultValue: 'Saving...' })}
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {t('actions.saveChanges', { defaultValue: 'Save Changes' })}
                  </>
                )}
              </Button>
            </div>

            {/* Legal Links */}
            <div className="flex flex-wrap justify-center gap-3 md:gap-4 text-xs text-cocoa-light/70 pt-3 border-t border-peach-soft/30">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigate?.(AppMode.LEGAL)}
                className="hover:text-coral-burst"
              >
                {t('privacyPolicy', { defaultValue: 'Privacy Policy' })}
              </Button>
              <span className="text-peach-soft">•</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigate?.(AppMode.LEGAL)}
                className="hover:text-coral-burst"
              >
                {t('termsOfService', { defaultValue: 'Terms of Service' })}
              </Button>
              <span className="text-peach-soft">•</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigate?.(AppMode.LEGAL)}
                className="hover:text-coral-burst"
              >
                {t('cookiePolicy', { defaultValue: 'Cookie Policy' })}
              </Button>
              <span className="text-peach-soft">•</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigate?.(AppMode.LEGAL)}
                className="hover:text-coral-burst"
              >
                {t('acceptableUse', { defaultValue: 'Acceptable Use' })}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;
