
import React, { useState, useRef, useEffect } from 'react';
import {
  Settings,
  User,
  CreditCard,
  Bell,
  Shield,
  LogOut,
  Cpu,
  Save,
  Upload,
  CheckCircle,
  Image as ImageIcon,
  Calendar,
  Download,
  ArrowLeft
} from 'lucide-react';
import { AppMode } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface SettingsPanelProps {
  onNavigate?: (mode: AppMode) => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'privacy' | 'subscriptions'>('profile');
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const memberSince = user?.created_at ? new Date(user.created_at).getFullYear() : new Date().getFullYear();

  // Initialize avatar from localStorage
  const [avatarPreview, setAvatarPreview] = useState<string | null>(() => {
    try {
      return localStorage.getItem('genesis_avatar');
    } catch (e) {
      return null;
    }
  });

  // Initialize form data from localStorage or defaults
  const [formData, setFormData] = useState(() => {
    try {
      const saved = localStorage.getItem('genesis_settings');
      return saved ? JSON.parse(saved) : {
        displayName: 'Creative Author',
        email: 'author@genesis.ai',
        bio: 'I love creating magical stories for children...',
        defaultStyle: 'Pixar 3D',
        temperature: 0.7,
        emailUpdates: true,
        marketingEmails: false,
        publicProfile: true,
        dataSharing: false
      };
    } catch (e) {
      return {
        displayName: 'Creative Author',
        email: 'author@genesis.ai',
        bio: 'I love creating magical stories for children...',
        defaultStyle: 'Pixar 3D',
        temperature: 0.7,
        emailUpdates: true,
        marketingEmails: false,
        publicProfile: true,
        dataSharing: false
      };
    }
  });

  const handleChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    setIsSaving(true);

    // Persist settings and avatar
    try {
      localStorage.setItem('genesis_settings', JSON.stringify(formData));
      if (avatarPreview) {
        localStorage.setItem('genesis_avatar', avatarPreview);
      }
    } catch (e) {
      console.error("Failed to save settings to local storage", e);
    }

    setTimeout(() => {
      setIsSaving(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }, 800);
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const TabButton = ({ id, icon: Icon, label }: { id: typeof activeTab, icon: any, label: string }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex-shrink-0 md:w-full flex items-center gap-2 md:gap-3 px-4 md:px-4 py-3 rounded-xl transition-all duration-200 touch-manipulation min-w-[120px] md:min-w-0
        ${activeTab === id
          ? 'bg-white shadow-soft-sm text-coral-burst font-bold border border-peach-soft'
          : 'bg-transparent text-cocoa-light hover:bg-white/50 hover:text-charcoal-soft'
        }`}
    >
      <Icon className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0" />
      <span className="text-sm md:text-base whitespace-nowrap">{label}</span>
    </button>
  );

  const Toggle = ({ label, checked, onChange }: { label: string, checked: boolean, onChange: (val: boolean) => void }) => (
    <div className="flex items-center justify-between py-4 border-b border-peach-soft/30 last:border-0 cursor-pointer group" onClick={() => onChange(!checked)}>
      <span className="text-charcoal-soft font-medium text-sm group-hover:text-coral-burst transition-colors">{label}</span>
      <button
        className={`w-11 h-6 rounded-full p-1 transition-colors duration-300 relative focus:outline-none ${checked ? 'bg-coral-burst' : 'bg-gray-200'}`}
      >
        <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${checked ? 'translate-x-5' : 'translate-x-0'}`}></div>
      </button>
    </div>
  );

  return (
    <div className="w-full max-w-4xl mx-auto p-4 md:p-6 pb-24 animate-fadeIn relative">

      {/* Success Toast */}
      {showSuccess && (
        <div className="fixed top-20 md:top-24 left-4 right-4 md:left-auto md:right-6 z-50 bg-white border border-green-200 text-green-700 px-4 md:px-6 py-3 md:py-4 rounded-xl shadow-soft-lg flex items-center gap-3 animate-fadeIn">
          <CheckCircle className="w-5 h-5 md:w-6 md:h-6 text-green-500 flex-shrink-0" />
          <div>
            <h4 className="font-bold text-sm">Success</h4>
            <p className="text-xs">Settings saved successfully.</p>
          </div>
        </div>
      )}

      <div className="mb-6 md:mb-10 flex items-center gap-3 md:gap-4">
        {onNavigate && (
          <button
            onClick={() => onNavigate(AppMode.DASHBOARD)}
            className="p-2 -ml-2 rounded-full hover:bg-cream-soft text-cocoa-light hover:text-coral-burst transition-colors touch-manipulation"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        )}
        <div>
          <h1 className="font-heading font-bold text-2xl md:text-4xl text-charcoal-soft mb-1 md:mb-2">Settings</h1>
          <p className="text-cocoa-light font-body text-sm md:text-base">Manage your profile, preferences, and system configuration.</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 md:gap-8">

        {/* Sidebar Menu - Horizontal scroll on mobile, vertical on desktop */}
        <div className="w-full md:w-64">
          <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide">
            <TabButton id="profile" icon={User} label="Profile" />
            <TabButton id="subscriptions" icon={CreditCard} label="Subscriptions" />
            <TabButton id="notifications" icon={Bell} label="Notifications" />
            <TabButton id="privacy" icon={Shield} label="Privacy" />
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 bg-white rounded-2xl md:rounded-3xl shadow-soft-lg border border-white/50 p-4 md:p-8 min-h-[400px] md:min-h-[500px] relative">

          {/* Content Area */}
          <div className="space-y-6">

            {activeTab === 'profile' && (
              <div className="animate-fadeIn space-y-6 md:space-y-8">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 md:gap-6">
                  <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-br from-gold-sunshine to-coral-burst flex items-center justify-center shadow-lg text-white relative group overflow-hidden flex-shrink-0">
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-8 h-8 md:w-10 md:h-10" />
                    )}
                    <button
                      onClick={handleAvatarClick}
                      className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer touch-manipulation"
                    >
                      <Upload className="w-5 h-5 md:w-6 md:h-6 text-white" />
                    </button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      className="hidden"
                      accept="image/*"
                    />
                  </div>
                  <div className="text-center sm:text-left">
                    <h3 className="font-heading font-bold text-xl md:text-2xl text-charcoal-soft">{formData.displayName}</h3>
                    <p className="text-cocoa-light text-sm md:text-base">Pro Plan • Member since {memberSince}</p>
                    <button onClick={handleAvatarClick} className="mt-2 text-sm font-bold text-coral-burst hover:underline flex items-center gap-1 mx-auto sm:mx-0 touch-manipulation">
                      <ImageIcon className="w-3 h-3" /> Change Avatar
                    </button>
                  </div>
                </div>
                <div className="h-px bg-peach-soft/50 w-full"></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-cocoa-light uppercase">Display Name</label>
                    <input
                      type="text"
                      value={formData.displayName}
                      onChange={(e) => handleChange('displayName', e.target.value)}
                      className="w-full bg-cream-base border border-peach-soft rounded-xl p-3 text-charcoal-soft focus:border-coral-burst outline-none transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-cocoa-light uppercase">Email Address</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                      className="w-full bg-cream-base border border-peach-soft rounded-xl p-3 text-charcoal-soft focus:border-coral-burst outline-none transition-colors"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-cocoa-light uppercase">Bio / Author Note</label>
                  <textarea
                    value={formData.bio}
                    onChange={(e) => handleChange('bio', e.target.value)}
                    className="w-full h-24 bg-cream-base border border-peach-soft rounded-xl p-3 text-charcoal-soft resize-none focus:border-coral-burst outline-none transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-cocoa-light uppercase">Default Art Style</label>
                  <select
                    value={formData.defaultStyle}
                    onChange={(e) => handleChange('defaultStyle', e.target.value)}
                    className="w-full bg-cream-base border border-peach-soft rounded-xl p-3 text-charcoal-soft focus:border-coral-burst focus:ring-2 focus:ring-coral-burst/20 outline-none transition-all cursor-pointer"
                  >
                    <option>Pixar 3D</option>
                    <option>Watercolor</option>
                    <option>Cyberpunk</option>
                    <option>Manga</option>
                  </select>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <label className="text-xs font-bold text-cocoa-light uppercase">Creativity (Temperature)</label>
                    <span className="text-xs font-bold text-coral-burst bg-coral-burst/10 px-2 py-1 rounded">{formData.temperature}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={formData.temperature}
                    onChange={(e) => handleChange('temperature', parseFloat(e.target.value))}
                    className="w-full accent-coral-burst h-2 bg-peach-soft rounded-lg appearance-none cursor-pointer hover:bg-peach-light transition-colors"
                  />
                  <div className="flex justify-between text-xs text-cocoa-light">
                    <span>Precise</span>
                    <span>Balanced</span>
                    <span>Wild</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="animate-fadeIn space-y-2">
                <h3 className="font-heading font-bold text-lg text-charcoal-soft mb-4">Email Preferences</h3>
                <Toggle
                  label="Generation Complete Alerts"
                  checked={formData.emailUpdates}
                  onChange={(val) => handleChange('emailUpdates', val)}
                />
                <Toggle
                  label="Marketing & Product Updates"
                  checked={formData.marketingEmails}
                  onChange={(val) => handleChange('marketingEmails', val)}
                />
              </div>
            )}

            {activeTab === 'privacy' && (
              <div className="animate-fadeIn space-y-2">
                <h3 className="font-heading font-bold text-lg text-charcoal-soft mb-4">Privacy & Data</h3>
                <Toggle
                  label="Public Profile Visibility"
                  checked={formData.publicProfile}
                  onChange={(val) => handleChange('publicProfile', val)}
                />
                <Toggle
                  label="Allow Content Analysis for AI Training"
                  checked={formData.dataSharing}
                  onChange={(val) => handleChange('dataSharing', val)}
                />
                <div className="mt-8 p-4 bg-red-50 rounded-2xl border border-red-100">
                  <h4 className="text-sm font-bold text-red-800 mb-2">Danger Zone</h4>
                  <button
                    onClick={() => alert('Account deletion requested. Please contact support to finalize.')}
                    className="text-xs text-red-600 hover:underline font-bold hover:text-red-800 transition-colors"
                  >
                    Delete Account & All Data
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'subscriptions' && (
              <div className="animate-fadeIn space-y-6">
                <div>
                  <h3 className="font-heading font-bold text-xl md:text-2xl text-charcoal-soft mb-2">Current Plan</h3>
                  <p className="text-cocoa-light text-sm">Manage your subscription and billing</p>
                </div>

                {/* Premium Black Card */}
                <div className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-black rounded-2xl md:rounded-3xl p-6 md:p-8 shadow-2xl overflow-hidden">
                  {/* Card shine effect */}
                  <div className="absolute top-0 right-0 w-48 h-48 md:w-64 md:h-64 bg-gradient-to-br from-white/10 to-transparent rounded-full blur-3xl"></div>

                  {/* Card Content */}
                  <div className="relative z-10">
                    <div className="flex items-start justify-between mb-6 md:mb-8">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-gradient-to-br from-gold-sunshine to-coral-burst flex items-center justify-center">
                            <span className="text-white font-heading font-bold text-base md:text-lg">G</span>
                          </div>
                          <span className="text-white/60 text-xs md:text-sm font-medium">Genesis</span>
                        </div>
                        <h4 className="font-heading font-bold text-2xl md:text-3xl text-white mb-1">Spark Plan</h4>
                        <p className="text-white/70 text-xs md:text-sm">Free Forever</p>
                      </div>
                      <span className="px-2.5 md:px-3 py-1 md:py-1.5 bg-green-500/20 text-green-400 text-xs font-bold rounded-full border border-green-500/30">Active</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 md:gap-4 mb-5 md:mb-6">
                      <div>
                        <p className="text-white/50 text-xs mb-1">Ebooks / Month</p>
                        <p className="text-white font-bold text-lg md:text-xl">3</p>
                      </div>
                      <div>
                        <p className="text-white/50 text-xs mb-1">Max Pages</p>
                        <p className="text-white font-bold text-lg md:text-xl">4</p>
                      </div>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-white/80">
                        <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                        <span>5 illustration styles</span>
                      </div>
                      <div className="flex items-center gap-2 text-white/80">
                        <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                        <span>Standard templates</span>
                      </div>
                      <div className="flex items-center gap-2 text-white/80">
                        <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                        <span>Community support</span>
                      </div>
                    </div>

                    {/* Card chip effect */}
                    <div className="absolute bottom-6 right-6 md:bottom-8 md:right-8 w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-gold-sunshine/30 to-coral-burst/30 rounded-lg backdrop-blur-sm border border-white/10"></div>
                  </div>
                </div>

                {/* Upgrade CTA */}
                <div className="bg-gradient-to-r from-coral-burst to-gold-sunshine p-5 md:p-6 rounded-2xl text-white">
                  <h4 className="font-heading font-bold text-lg md:text-xl mb-2">Unlock Premium Features</h4>
                  <p className="text-sm text-white/90 mb-4">Upgrade to Creator (10 ebooks/month) or Visionary (unlimited) for advanced AI and priority support</p>
                  <button
                    onClick={() => onNavigate?.(AppMode.PRICING)}
                    className="px-6 py-3 bg-white text-coral-burst rounded-full font-bold hover:scale-105 transition-transform shadow-lg touch-manipulation"
                  >
                    View Plans
                  </button>
                </div>

                {/* Billing History */}
                <div>
                  <h4 className="font-heading font-bold text-base md:text-lg text-charcoal-soft mb-4">Billing History</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 bg-cream-base rounded-xl">
                      <div className="flex items-center gap-3">
                        <Calendar className="w-5 h-5 text-cocoa-light flex-shrink-0" />
                        <div>
                          <p className="font-bold text-sm text-charcoal-soft">Spark Plan</p>
                          <p className="text-xs text-cocoa-light">Free tier - No charges</p>
                        </div>
                      </div>
                      <span className="text-base md:text-lg font-bold text-charcoal-soft">$0.00</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Footer */}
          <div className="mt-8 md:mt-10 pt-5 md:pt-6 border-t border-peach-soft/50 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 md:gap-4">
            <button className="flex items-center justify-center md:justify-start gap-2 text-cocoa-light font-bold hover:text-red-500 text-sm px-4 py-3 md:py-2 rounded-lg hover:bg-red-50 transition-colors touch-manipulation">
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full md:w-auto px-6 md:px-8 py-3.5 md:py-3 bg-coral-burst text-white rounded-full font-heading font-bold shadow-soft-md hover:shadow-soft-lg hover:scale-105 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed touch-manipulation"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;
