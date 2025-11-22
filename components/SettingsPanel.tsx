
import React, { useState } from 'react';
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
  CheckCircle
} from 'lucide-react';

const SettingsPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'profile' | 'ai' | 'notifications' | 'privacy'>('profile');
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    displayName: 'Creative Author',
    email: 'author@genesis.ai',
    bio: 'I love creating magical stories for children...',
    defaultStyle: 'Pixar 3D',
    temperature: 0.7,
    emailUpdates: true,
    marketingEmails: false,
    publicProfile: true,
    dataSharing: false
  });

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      alert("Settings saved successfully!");
    }, 1500);
  };

  const handleChangeAvatar = () => {
    alert("Avatar upload dialog would open here.");
  };

  const TabButton = ({ id, icon: Icon, label }: { id: typeof activeTab, icon: any, label: string }) => (
    <button 
      onClick={() => setActiveTab(id)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 
        ${activeTab === id 
          ? 'bg-white shadow-soft-sm text-coral-burst font-bold border border-peach-soft' 
          : 'bg-transparent text-cocoa-light hover:bg-white/50 hover:text-charcoal-soft'
        }`}
    >
      <Icon className="w-5 h-5" /> {label}
    </button>
  );

  const Toggle = ({ label, checked, onChange }: { label: string, checked: boolean, onChange: (val: boolean) => void }) => (
    <div className="flex items-center justify-between py-4 border-b border-peach-soft/30 last:border-0">
      <span className="text-charcoal-soft font-medium text-sm">{label}</span>
      <button 
        onClick={() => onChange(!checked)}
        className={`w-11 h-6 rounded-full p-1 transition-colors duration-300 relative focus:outline-none ${checked ? 'bg-coral-burst' : 'bg-gray-200'}`}
      >
        <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${checked ? 'translate-x-5' : 'translate-x-0'}`}></div>
      </button>
    </div>
  );

  return (
    <div className="w-full max-w-4xl mx-auto p-6 pb-24 animate-fadeIn">
        
        <div className="mb-10">
            <h1 className="font-heading font-bold text-4xl text-charcoal-soft mb-2">Settings</h1>
            <p className="text-cocoa-light font-body">Manage your profile, preferences, and system configuration.</p>
        </div>

        <div className="flex flex-col md:flex-row gap-8">
            
            {/* Sidebar Menu */}
            <div className="w-full md:w-64 space-y-2">
                <TabButton id="profile" icon={User} label="Profile" />
                <TabButton id="ai" icon={Cpu} label="AI Config" />
                <TabButton id="notifications" icon={Bell} label="Notifications" />
                <TabButton id="privacy" icon={Shield} label="Privacy" />
            </div>

            {/* Main Content */}
            <div className="flex-1 bg-white rounded-3xl shadow-soft-lg border border-white/50 p-8 min-h-[500px] relative">
                
                {/* Content Area */}
                <div className="space-y-6">
                    
                    {activeTab === 'profile' && (
                        <div className="animate-fadeIn space-y-8">
                             <div className="flex items-center gap-6">
                                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-gold-sunshine to-coral-burst flex items-center justify-center shadow-lg text-white relative group">
                                     <User className="w-10 h-10" />
                                     <button 
                                        onClick={handleChangeAvatar}
                                        className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                     >
                                         <Upload className="w-6 h-6 text-white" />
                                     </button>
                                </div>
                                <div>
                                    <h3 className="font-heading font-bold text-2xl text-charcoal-soft">{formData.displayName}</h3>
                                    <p className="text-cocoa-light">Pro Plan • Member since 2023</p>
                                    <button onClick={handleChangeAvatar} className="mt-2 text-sm font-bold text-coral-burst hover:underline">Change Avatar</button>
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
                        </div>
                    )}

                    {activeTab === 'ai' && (
                         <div className="animate-fadeIn space-y-6">
                            <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 mb-6">
                                <h3 className="font-bold text-blue-800 mb-1 flex items-center gap-2">
                                    <Cpu className="w-4 h-4" /> Model Configuration
                                </h3>
                                <p className="text-xs text-blue-600">Adjust how the AI behaves during story generation.</p>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-cocoa-light uppercase">Default Art Style</label>
                                <select 
                                    value={formData.defaultStyle}
                                    onChange={(e) => handleChange('defaultStyle', e.target.value)}
                                    className="w-full bg-cream-base border border-peach-soft rounded-xl p-3 text-charcoal-soft"
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
                                    <span className="text-xs font-bold text-coral-burst">{formData.temperature}</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="0" 
                                    max="1" 
                                    step="0.1"
                                    value={formData.temperature}
                                    onChange={(e) => handleChange('temperature', parseFloat(e.target.value))}
                                    className="w-full accent-coral-burst h-2 bg-peach-soft rounded-lg appearance-none cursor-pointer"
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
                                <button className="text-xs text-red-600 hover:underline font-bold">Delete Account & All Data</button>
                            </div>
                        </div>
                    )}

                </div>

                {/* Footer */}
                <div className="mt-10 pt-6 border-t border-peach-soft/50 flex flex-col md:flex-row justify-between items-center gap-4">
                     <button className="flex items-center gap-2 text-cocoa-light font-bold hover:text-red-500 text-sm px-4 py-2 rounded-lg hover:bg-red-50 transition-colors">
                        <LogOut className="w-4 h-4" /> Sign Out
                     </button>
                     <button 
                        onClick={handleSave}
                        disabled={isSaving}
                        className="w-full md:w-auto px-8 py-3 bg-coral-burst text-white rounded-full font-heading font-bold shadow-soft-md hover:shadow-soft-lg hover:scale-105 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                     >
                        {isSaving ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                Saving Changes...
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
