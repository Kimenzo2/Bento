import React, { useState, useEffect } from 'react';
import { 
  Download, 
  Trash2, 
  Database, 
  AlertTriangle, 
  CheckCircle,
  HardDrive,
  FileText,
  Image as ImageIcon
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';

interface DataManagementProps {
  onShowSuccess: (message: string) => void;
}

const DataManagement: React.FC<DataManagementProps> = ({ onShowSuccess }) => {
  const { user } = useAuth();
  const [storageInfo, setStorageInfo] = useState({
    projects: 0,
    images: 0,
    totalSize: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    loadStorageInfo();
  }, []);

  const loadStorageInfo = async () => {
    if (!user) return;

    try {
      const { count: projectCount } = await supabase
        .from('projects')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      const { count: imageCount } = await supabase
        .from('visual_generations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      setStorageInfo({
        projects: projectCount || 0,
        images: imageCount || 0,
        totalSize: ((projectCount || 0) * 0.5 + (imageCount || 0) * 2), // Rough estimate in MB
      });
    } catch (error) {
      console.error('Error loading storage info:', error);
    }
  };

  const handleExportData = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      // Fetch all user data
      const { data: projects } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', user.id);

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      // Get settings from localStorage
      const settings = localStorage.getItem('genesis_settings');

      // Create export data
      const exportData = {
        exportDate: new Date().toISOString(),
        user: {
          email: user.email,
          profile,
        },
        settings: settings ? JSON.parse(settings) : null,
        projects: projects || [],
        metadata: {
          version: '2.0.0',
          format: 'genesis-export-v1',
        },
      };

      // Create and download JSON file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `genesis-data-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      onShowSuccess('Data exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearCache = () => {
    try {
      // Clear only cache-related items, preserve important data
      const keysToKeep = ['genesis_settings', 'genesis_avatar'];
      const allKeys = Object.keys(localStorage);
      
      allKeys.forEach(key => {
        if (key.startsWith('genesis_') && !keysToKeep.includes(key)) {
          localStorage.removeItem(key);
        }
      });

      // Clear session storage
      sessionStorage.clear();

      onShowSuccess('Cache cleared successfully');
    } catch (error) {
      console.error('Clear cache error:', error);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      // Delete user data
      await supabase.from('projects').delete().eq('user_id', user.id);
      await supabase.from('visual_generations').delete().eq('user_id', user.id);
      await supabase.from('profiles').delete().eq('id', user.id);
      
      // Delete auth user (requires admin privileges or RLS policies)
      // Note: In production, this should be done via a secure backend function
      onShowSuccess('Account deletion initiated. Please contact support to complete.');
      
      // Sign out
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } catch (error) {
      console.error('Delete account error:', error);
      alert('Failed to delete account. Please contact support.');
    } finally {
      setIsLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="animate-fadeIn space-y-6">
      {/* Storage Usage */}
      <div>
        <h3 className="font-heading font-bold text-lg text-charcoal-soft mb-2">
          Storage Usage
        </h3>
        <p className="text-sm text-cocoa-light mb-4">
          Monitor your account storage and data
        </p>
        
        <div className="grid grid-cols-3 md:grid-cols-3 gap-2 md:gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-3 md:p-4 border border-blue-200">
            <div className="flex items-center gap-2 md:gap-3 mb-1 md:mb-2">
              <FileText className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
              <span className="text-xs font-bold text-blue-900 uppercase hidden sm:block">Projects</span>
            </div>
            <p className="text-xl md:text-2xl font-bold text-blue-900">{storageInfo.projects}</p>
            <p className="text-xs text-blue-700 mt-0.5 md:mt-1 truncate">Saved books</p>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-3 md:p-4 border border-purple-200">
            <div className="flex items-center gap-2 md:gap-3 mb-1 md:mb-2">
              <ImageIcon className="w-4 h-4 md:w-5 md:h-5 text-purple-600" />
              <span className="text-xs font-bold text-purple-900 uppercase hidden sm:block">Images</span>
            </div>
            <p className="text-xl md:text-2xl font-bold text-purple-900">{storageInfo.images}</p>
            <p className="text-xs text-purple-700 mt-0.5 md:mt-1 truncate">Visuals</p>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-3 md:p-4 border border-orange-200">
            <div className="flex items-center gap-2 md:gap-3 mb-1 md:mb-2">
              <HardDrive className="w-4 h-4 md:w-5 md:h-5 text-orange-600" />
              <span className="text-xs font-bold text-orange-900 uppercase hidden sm:block">Storage</span>
            </div>
            <p className="text-xl md:text-2xl font-bold text-orange-900">{storageInfo.totalSize.toFixed(1)} MB</p>
            <p className="text-xs text-orange-700 mt-0.5 md:mt-1 truncate">Usage</p>
          </div>
        </div>
      </div>

      <div className="h-px bg-peach-soft/50 w-full" />

      {/* Export Data */}
      <div>
        <h3 className="font-heading font-bold text-lg text-charcoal-soft mb-2">
          Export Your Data
        </h3>
        <p className="text-sm text-cocoa-light mb-4">
          Download a copy of your projects, settings, and profile information
        </p>
        
        <button
          onClick={handleExportData}
          disabled={isLoading}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-gray-300 text-white font-bold py-3.5 md:py-3 px-6 rounded-xl transition-colors touch-manipulation"
        >
          <Download className="w-5 h-5" />
          {isLoading ? 'Exporting...' : 'Export Data (JSON)'}
        </button>
      </div>

      <div className="h-px bg-peach-soft/50 w-full" />

      {/* Clear Cache */}
      <div>
        <h3 className="font-heading font-bold text-lg text-charcoal-soft mb-2">
          Clear Cache
        </h3>
        <p className="text-sm text-cocoa-light mb-4">
          Remove temporary files and cached data to free up space
        </p>
        
        <button
          onClick={handleClearCache}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white font-bold py-3.5 md:py-3 px-6 rounded-xl transition-colors touch-manipulation"
        >
          <Database className="w-5 h-5" />
          Clear Cache
        </button>
      </div>

      <div className="h-px bg-peach-soft/50 w-full" />

      {/* Delete Account */}
      <div>
        <h3 className="font-heading font-bold text-lg text-charcoal-soft mb-2 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          Danger Zone
        </h3>
        <p className="text-sm text-cocoa-light mb-4">
          Permanently delete your account and all associated data
        </p>
        
        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold py-3.5 md:py-3 px-6 rounded-xl transition-colors touch-manipulation"
          >
            <Trash2 className="w-5 h-5" />
            Delete Account
          </button>
        ) : (
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3 md:p-4 space-y-3 md:space-y-4">
            <div className="flex items-start gap-2 md:gap-3">
              <AlertTriangle className="w-5 h-5 md:w-6 md:h-6 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <h4 className="font-bold text-red-900 mb-1 text-sm md:text-base">Are you absolutely sure?</h4>
                <p className="text-xs md:text-sm text-red-800 mb-2">
                  This action cannot be undone. This will permanently delete your account and remove all your data.
                </p>
                <ul className="text-xs md:text-sm text-red-800 list-disc list-inside space-y-0.5 md:space-y-1 mb-2 md:mb-3">
                  <li>{storageInfo.projects} projects deleted</li>
                  <li>{storageInfo.images} images removed</li>
                  <li>Subscription cancelled</li>
                </ul>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 bg-white border-2 border-gray-300 text-gray-700 font-bold py-3 md:py-2 px-4 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-colors touch-manipulation order-2 sm:order-1"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={isLoading}
                className="flex-1 bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:bg-gray-300 text-white font-bold py-3 md:py-2 px-4 rounded-xl transition-colors touch-manipulation order-1 sm:order-2"
              >
                {isLoading ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 md:p-4">
        <p className="text-xs md:text-sm text-yellow-900">
          <strong>Data Retention:</strong> Deleted data may be retained in backups for up to 30 days.
        </p>
      </div>
    </div>
  );
};

export default DataManagement;
