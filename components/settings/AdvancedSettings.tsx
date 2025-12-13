import React from 'react';
import { 
  Code, 
  Wrench, 
  Zap, 
  TestTube2, 
  Bug, 
  Terminal,
  Eye,
  RefreshCw
} from 'lucide-react';

interface AdvancedSettingsProps {
  settings: {
    developerMode: boolean;
    debugLogs: boolean;
    betaFeatures: boolean;
    experimentalUI: boolean;
    showPerformanceMetrics: boolean;
    autoSave: boolean;
  };
  onUpdate: (settings: any) => void;
}

const AdvancedSettings: React.FC<AdvancedSettingsProps> = ({ settings, onUpdate }) => {
  const Toggle = ({ 
    label, 
    description, 
    checked, 
    onChange,
    icon: Icon,
    badge 
  }: { 
    label: string;
    description?: string;
    checked: boolean;
    onChange: (val: boolean) => void;
    icon: any;
    badge?: string;
  }) => (
    <div 
      className="flex items-center justify-between py-4 md:py-4 border-b border-peach-soft/30 last:border-0 cursor-pointer group touch-manipulation active:bg-cream-base/50 -mx-2 px-2 rounded-lg transition-colors" 
      onClick={() => onChange(!checked)}
    >
      <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
        <Icon className="w-5 h-5 text-coral-burst flex-shrink-0" />
        <div className="flex flex-col min-w-0">
          <div className="flex flex-wrap items-center gap-1 md:gap-2">
            <span className="text-charcoal-soft font-medium text-sm group-hover:text-coral-burst transition-colors">
              {label}
            </span>
            {badge && (
              <span className="px-1.5 md:px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-bold rounded-full">
                {badge}
              </span>
            )}
          </div>
          {description && (
            <span className="text-xs text-gray-500 mt-0.5 md:mt-1 line-clamp-2">{description}</span>
          )}
        </div>
      </div>
      <button
        className={`w-12 h-7 md:w-11 md:h-6 rounded-full p-1 transition-colors duration-300 relative focus:outline-none flex-shrink-0 ml-3 md:ml-4 ${
          checked ? 'bg-coral-burst' : 'bg-gray-200'
        }`}
      >
        <div 
          className={`w-5 h-5 md:w-4 md:h-4 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );

  const handleResetSettings = () => {
    if (confirm('Reset all settings to defaults? This cannot be undone.')) {
      localStorage.removeItem('genesis_settings');
      localStorage.removeItem('genesis_avatar');
      window.location.reload();
    }
  };

  const handleClearAllData = () => {
    if (confirm('This will clear ALL local data including settings, cache, and drafts. Continue?')) {
      localStorage.clear();
      sessionStorage.clear();
      window.location.reload();
    }
  };

  return (
    <div className="animate-fadeIn space-y-6">
      {/* Warning Banner */}
      <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-3 md:p-4">
        <div className="flex items-start gap-2 md:gap-3">
          <Wrench className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-yellow-900 mb-0.5 md:mb-1 text-sm md:text-base">Advanced Settings</h4>
            <p className="text-xs md:text-sm text-yellow-800">
              For power users and developers. Changes may affect app stability.
            </p>
          </div>
        </div>
      </div>

      {/* Developer Tools */}
      <div>
        <h3 className="font-heading font-bold text-lg text-charcoal-soft mb-2">
          Developer Tools
        </h3>
        <p className="text-sm text-cocoa-light mb-4">
          Enable advanced debugging and development features
        </p>
        
        <div className="space-y-0">
          <Toggle
            label="Developer Mode"
            description="Show technical details and debugging tools"
            checked={settings.developerMode}
            onChange={(val) => {
              onUpdate({ ...settings, developerMode: val });
              if (val) {
                console.log('[Genesis] Developer mode enabled');
              }
            }}
            icon={Code}
          />
          
          <Toggle
            label="Debug Logs"
            description="Enable verbose console logging"
            checked={settings.debugLogs}
            onChange={(val) => {
              onUpdate({ ...settings, debugLogs: val });
              if (val) {
                localStorage.setItem('genesis_debug', 'true');
              } else {
                localStorage.removeItem('genesis_debug');
              }
            }}
            icon={Bug}
          />

          <Toggle
            label="Performance Metrics"
            description="Show render times and performance stats"
            checked={settings.showPerformanceMetrics}
            onChange={(val) => {
              onUpdate({ ...settings, showPerformanceMetrics: val });
            }}
            icon={Zap}
          />
        </div>
      </div>

      <div className="h-px bg-peach-soft/50 w-full" />

      {/* Beta Features */}
      <div>
        <h3 className="font-heading font-bold text-lg text-charcoal-soft mb-2">
          Experimental Features
        </h3>
        <p className="text-sm text-cocoa-light mb-4">
          Try new features before they're officially released
        </p>
        
        <div className="space-y-0">
          <Toggle
            label="Beta Features"
            description="Enable experimental features (may be unstable)"
            checked={settings.betaFeatures}
            onChange={(val) => onUpdate({ ...settings, betaFeatures: val })}
            icon={TestTube2}
            badge="BETA"
          />
          
          <Toggle
            label="Experimental UI"
            description="Try redesigned interface components"
            checked={settings.experimentalUI}
            onChange={(val) => onUpdate({ ...settings, experimentalUI: val })}
            icon={Eye}
            badge="EXPERIMENTAL"
          />
        </div>
      </div>

      <div className="h-px bg-peach-soft/50 w-full" />

      {/* Auto-Save */}
      <div>
        <h3 className="font-heading font-bold text-lg text-charcoal-soft mb-2">
          Data & Sync
        </h3>
        <p className="text-sm text-cocoa-light mb-4">
          Configure automatic saving and synchronization
        </p>
        
        <div className="space-y-0">
          <Toggle
            label="Auto-Save"
            description="Automatically save changes as you work"
            checked={settings.autoSave}
            onChange={(val) => onUpdate({ ...settings, autoSave: val })}
            icon={RefreshCw}
          />
        </div>
      </div>

      <div className="h-px bg-peach-soft/50 w-full" />

      {/* System Actions */}
      <div>
        <h3 className="font-heading font-bold text-lg text-charcoal-soft mb-2">
          System Actions
        </h3>
        <p className="text-sm text-cocoa-light mb-4">
          Reset or clear application data
        </p>
        
        <div className="space-y-3">
          <button
            onClick={handleResetSettings}
            className="w-full flex items-center justify-between p-3 md:p-4 bg-white border-2 border-orange-200 rounded-xl hover:border-orange-400 hover:bg-orange-50 active:bg-orange-100 transition-all group touch-manipulation"
          >
            <div className="flex items-center gap-2 md:gap-3">
              <RefreshCw className="w-5 h-5 text-orange-600" />
              <div className="text-left">
                <div className="font-bold text-sm md:text-base text-charcoal-soft group-hover:text-orange-700">Reset Settings</div>
                <div className="text-xs text-gray-500">Restore defaults</div>
              </div>
            </div>
            <span className="text-sm font-bold text-orange-600">Reset</span>
          </button>

          <button
            onClick={handleClearAllData}
            className="w-full flex items-center justify-between p-3 md:p-4 bg-white border-2 border-red-200 rounded-xl hover:border-red-400 hover:bg-red-50 active:bg-red-100 transition-all group touch-manipulation"
          >
            <div className="flex items-center gap-2 md:gap-3">
              <Terminal className="w-5 h-5 text-red-600" />
              <div className="text-left">
                <div className="font-bold text-sm md:text-base text-charcoal-soft group-hover:text-red-700">Clear All Data</div>
                <div className="text-xs text-gray-500">Remove local storage</div>
              </div>
            </div>
            <span className="text-sm font-bold text-red-600">Clear</span>
          </button>
        </div>
      </div>

      {/* Developer Info */}
      {settings.developerMode && (
        <div className="bg-gray-900 text-green-400 rounded-xl p-3 md:p-4 font-mono text-xs overflow-x-auto">
          <div className="space-y-0.5 md:space-y-1 whitespace-nowrap">
            <div>• React: {React.version}</div>
            <div className="truncate">• UA: {navigator.userAgent.slice(0, 40)}...</div>
            <div>• Screen: {window.screen.width}x{window.screen.height}</div>
            <div>• Viewport: {window.innerWidth}x{window.innerHeight}</div>
            <div>• SW: {navigator.serviceWorker ? 'Yes' : 'No'}</div>
          </div>
        </div>
      )}

      <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 md:p-4">
        <p className="text-xs md:text-sm text-purple-900">
          <strong>Need Help?</strong> Visit our{' '}
          <a 
            href="https://genesis-1765265007.documentationai.com/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="font-bold text-purple-700 hover:underline"
          >
            docs
          </a>
          {' '}for API references.
        </p>
      </div>
    </div>
  );
};

export default AdvancedSettings;
