import { Bug, Code, Eye, RefreshCw, Terminal, TestTube2, Wrench, Zap } from 'lucide-react';
import React from 'react';
import { ToggleRow } from '../ui/toggle-row';
import { toast } from '../ui/sonner';

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
  onResetLocalPreferences: () => void;
}

const AdvancedSettings: React.FC<AdvancedSettingsProps> = ({
  settings,
  onUpdate,
  onResetLocalPreferences,
}) => {
  const handleResetSettings = () => {
    toast('Reset local preferences to defaults?', {
      description: 'This restores device-specific preferences and debugging toggles.',
      action: {
        label: 'Reset',
        onClick: () => {
          onResetLocalPreferences();
        },
      },
      cancel: { label: 'Cancel', onClick: () => {} },
    });
  };

  const handleClearAllData = () => {
    toast('Clear ALL local data?', {
      description: 'This removes settings, cache, and drafts. Cannot be undone.',
      action: {
        label: 'Clear Everything',
        onClick: () => {
          localStorage.clear();
          sessionStorage.clear();
          window.location.reload();
        },
      },
      cancel: { label: 'Cancel', onClick: () => {} },
    });
  };

  return (
    <div className="animate-fadeIn space-y-6">
      {/* Warning Banner */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 md:p-4">
        <div className="flex items-start gap-2 md:gap-3">
          <Wrench className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-yellow-900 mb-0.5 md:mb-1 text-sm md:text-base">
              Advanced Settings
            </h4>
            <p className="text-xs md:text-sm text-yellow-800">
              For power users and developers. Changes may affect app stability.
            </p>
          </div>
        </div>
      </div>

      {/* Developer Tools */}
      <div>
        <h3 className="font-heading font-bold text-lg text-charcoal-soft mb-2">Developer Tools</h3>
        <p className="text-sm text-cocoa-light mb-4">
          Enable advanced debugging and development features
        </p>

        <div className="space-y-0">
          <ToggleRow
            label="Developer Mode"
            description="Show technical details and debugging tools"
            checked={settings.developerMode}
            onCheckedChange={(val) => {
              onUpdate({ ...settings, developerMode: val });
              if (val) {
                console.warn('[Genesis] Developer mode enabled');
              }
            }}
            icon={Code}
          />

          <ToggleRow
            label="Debug Logs"
            description="Enable verbose console logging"
            checked={settings.debugLogs}
            onCheckedChange={(val) => {
              onUpdate({ ...settings, debugLogs: val });
              if (val) {
                localStorage.setItem('genesis_debug', 'true');
              } else {
                localStorage.removeItem('genesis_debug');
              }
            }}
            icon={Bug}
          />

          <ToggleRow
            label="Performance Metrics"
            description="Show render times and performance stats"
            checked={settings.showPerformanceMetrics}
            onCheckedChange={(val) => {
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
          <ToggleRow
            label="Beta Features"
            description="Enable experimental features (may be unstable)"
            checked={settings.betaFeatures}
            onCheckedChange={(val) => onUpdate({ ...settings, betaFeatures: val })}
            icon={TestTube2}
            badge="BETA"
          />

          <ToggleRow
            label="Experimental UI"
            description="Try redesigned interface components"
            checked={settings.experimentalUI}
            onCheckedChange={(val) => onUpdate({ ...settings, experimentalUI: val })}
            icon={Eye}
            badge="EXPERIMENTAL"
          />
        </div>
      </div>

      <div className="h-px bg-peach-soft/50 w-full" />

      {/* Auto-Save */}
      <div>
        <h3 className="font-heading font-bold text-lg text-charcoal-soft mb-2">Data & Sync</h3>
        <p className="text-sm text-cocoa-light mb-4">
          Configure automatic saving and synchronization
        </p>

        <div className="space-y-0">
          <ToggleRow
            label="Auto-Save"
            description="Automatically save changes as you work"
            checked={settings.autoSave}
            onCheckedChange={(val) => onUpdate({ ...settings, autoSave: val })}
            icon={RefreshCw}
          />
        </div>
      </div>

      <div className="h-px bg-peach-soft/50 w-full" />

      {/* System Actions */}
      <div>
        <h3 className="font-heading font-bold text-lg text-charcoal-soft mb-2">System Actions</h3>
        <p className="text-sm text-cocoa-light mb-4">Reset or clear application data</p>

        <div className="space-y-3">
          <button
            onClick={handleResetSettings}
            className="w-full flex items-center justify-between p-3 md:p-4 bg-surface border border-orange-200 rounded-xl hover:border-orange-400 hover:bg-orange-50 active:bg-orange-100 transition-all group touch-manipulation"
          >
            <div className="flex items-center gap-2 md:gap-3">
              <RefreshCw className="w-5 h-5 text-orange-600" />
              <div className="text-left">
                <div className="font-bold text-sm md:text-base text-charcoal-soft group-hover:text-orange-700">
                  Reset Local Preferences
                </div>
                <div className="text-xs text-cocoa-light">Restore UI defaults</div>
              </div>
            </div>
            <span className="text-sm font-bold text-orange-600">Reset</span>
          </button>

          <button
            onClick={handleClearAllData}
            className="w-full flex items-center justify-between p-3 md:p-4 bg-surface border border-red-200 rounded-xl hover:border-red-400 hover:bg-red-50 active:bg-red-100 transition-all group touch-manipulation"
          >
            <div className="flex items-center gap-2 md:gap-3">
              <Terminal className="w-5 h-5 text-red-600" />
              <div className="text-left">
                <div className="font-bold text-sm md:text-base text-charcoal-soft group-hover:text-red-700">
                  Clear All Data
                </div>
                <div className="text-xs text-cocoa-light">Remove local storage</div>
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
            <div>
              • Screen: {window.screen.width}x{window.screen.height}
            </div>
            <div>
              • Viewport: {window.innerWidth}x{window.innerHeight}
            </div>
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
          </a>{' '}
          for API references.
        </p>
      </div>
    </div>
  );
};

export default AdvancedSettings;
