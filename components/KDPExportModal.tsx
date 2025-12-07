import React, { useState, useEffect } from 'react';
import { X, Download, BookOpen, AlertCircle, CheckCircle, Info, FileText, Settings } from 'lucide-react';
import { BookProject, UserTier } from '../types';
import { TrimSize } from '../services/export/kdpTypes';
import {
  exportToKDP,
  downloadKDP,
  previewKDPExport
} from '../services/export/kdpExportService';
import {
  getQualityAssessment
} from '../services/export/kdpValidation';

interface KDPExportModalProps {
  project: BookProject;
  isOpen: boolean;
  onClose: () => void;
  userTier?: UserTier;
}

const KDPExportModal: React.FC<KDPExportModalProps> = ({
  project,
  isOpen,
  onClose,
  userTier = UserTier.SPARK
}) => {
  const [trimSize, setTrimSize] = useState<TrimSize>('8.5x8.5');
  const [includeBleed, setIncludeBleed] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('Preparing export...');
  const [preview, setPreview] = useState<any>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Load preview when modal opens
  useEffect(() => {
    if (isOpen) {
      loadPreview();
    }
  }, [isOpen, trimSize, includeBleed]);

  const loadPreview = async () => {
    try {
      const previewData = await previewKDPExport(project, {
        trimSize,
        includeBleed
      });
      setPreview(previewData);
    } catch (error) {
      console.error('Preview failed:', error);
    }
  };

  const handleExport = async () => {
    // Check tier restrictions
    if (userTier === UserTier.SPARK) {
      alert('KDP Export is a premium feature! Upgrade to Creator tier to unlock.');
      return;
    }

    setIsExporting(true);
    setExportProgress(0);
    setProgressMessage('Preparing export...');

    try {
      await downloadKDP(
        project,
        {
          trimSize,
          includeBleed,
          copyrightYear: new Date().getFullYear()
        },
        (progress, message) => {
          // Real-time progress updates from export service
          setExportProgress(progress);
          setProgressMessage(message);
        }
      );

      // Brief success message before closing
      setProgressMessage('Download complete!');
      setTimeout(() => {
        setIsExporting(false);
        setExportProgress(0);
        onClose();
      }, 1500);
    } catch (error) {
      console.error('Export failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Export failed. Please check your images and try again.';
      alert(`Export Error: ${errorMessage}`);
      setIsExporting(false);
      setExportProgress(0);
      setProgressMessage('');
    }
  };

  if (!isOpen) return null;

  const qualityAssessment = preview?.quality 
    ? getQualityAssessment(preview.quality.overallScore)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-coral-burst to-gold-sunshine p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-heading font-bold">Amazon KDP Export</h2>
              <p className="text-white/90 text-sm">Professional Print-Ready PDF</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Quality Dashboard */}
          {preview && preview.quality && (
            <div className="mb-6 p-6 bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl border border-blue-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-heading font-bold text-charcoal-soft">Quality Assessment</h3>
                <div className={`text-3xl font-bold ${qualityAssessment?.color}`}>
                  {preview.quality.overallScore}%
                </div>
              </div>
              
              {qualityAssessment && (
                <div className={`flex items-center gap-2 mb-4 ${qualityAssessment.color}`}>
                  {qualityAssessment.level === 'excellent' || qualityAssessment.level === 'good' ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <AlertCircle className="w-5 h-5" />
                  )}
                  <span className="font-bold">{qualityAssessment.message}</span>
                </div>
              )}

              {/* Quality Metrics */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <QualityMetric
                  label="Image Resolution"
                  score={preview.quality.imageResolution}
                  icon="📸"
                />
                <QualityMetric
                  label="Color Accuracy"
                  score={preview.quality.colorAccuracy}
                  icon="🎨"
                />
                <QualityMetric
                  label="Margin Compliance"
                  score={preview.quality.marginCompliance}
                  icon="📐"
                />
                <QualityMetric
                  label="Font Embedding"
                  score={preview.quality.fontEmbedding}
                  icon="✍️"
                />
              </div>

              {/* File Info */}
              <div className="flex items-center justify-between text-sm text-cocoa-light">
                <span>Estimated File Size: {(preview.estimatedFileSize / 1024 / 1024).toFixed(2)} MB</span>
                <span>Pages: {preview.validation.pageCount}</span>
              </div>
            </div>
          )}

          {/* Export Settings */}
          <div className="mb-6">
            <h3 className="text-lg font-heading font-bold text-charcoal-soft mb-4">Export Settings</h3>
            
            {/* Trim Size Selection */}
            <div className="mb-4">
              <label className="block text-sm font-bold text-cocoa-light mb-2">Book Size (Trim Size)</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { value: '6x9', label: '6" × 9"', desc: 'Standard Novel' },
                  { value: '8.5x8.5', label: '8.5" × 8.5"', desc: 'Square Picture Book' },
                  { value: '8x10', label: '8" × 10"', desc: 'Premium Format' },
                  { value: '8.5x11', label: '8.5" × 11"', desc: 'Large Format' }
                ].map((size) => (
                  <button
                    key={size.value}
                    onClick={() => setTrimSize(size.value as TrimSize)}
                    className={`p-4 rounded-xl border-2 transition-all text-left ${
                      trimSize === size.value
                        ? 'border-coral-burst bg-coral-burst/10 shadow-md'
                        : 'border-peach-soft hover:border-coral-burst/50'
                    }`}
                  >
                    <div className="font-bold text-charcoal-soft">{size.label}</div>
                    <div className="text-xs text-cocoa-light mt-1">{size.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Bleed Option */}
            <div className="flex items-start gap-3 p-4 bg-cream-soft rounded-xl">
              <input
                type="checkbox"
                id="includeBleed"
                checked={includeBleed}
                onChange={(e) => setIncludeBleed(e.target.checked)}
                className="mt-1 w-5 h-5 text-coral-burst rounded focus:ring-coral-burst"
              />
              <label htmlFor="includeBleed" className="flex-1 cursor-pointer">
                <div className="font-bold text-charcoal-soft">Include Bleed (Recommended)</div>
                <div className="text-sm text-cocoa-light mt-1">
                  Extends images 0.125" past trim edge for professional full-page illustrations
                </div>
              </label>
            </div>

            {/* Advanced Options */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="mt-4 text-sm text-coral-burst font-bold flex items-center gap-2 hover:underline"
            >
              <Settings className="w-4 h-4" />
              {showAdvanced ? 'Hide' : 'Show'} Advanced Options
            </button>

            {showAdvanced && (
              <div className="mt-4 p-4 bg-gray-50 rounded-xl space-y-3">
                <div className="text-sm">
                  <div className="font-bold text-charcoal-soft mb-2">Advanced Settings</div>
                  <div className="space-y-2 text-cocoa-light">
                    <div>✓ Resolution: 300 DPI (Print Quality)</div>
                    <div>✓ Color Mode: RGB (Auto-converted by KDP)</div>
                    <div>✓ PDF Format: PDF/X-1a:2001</div>
                    <div>✓ Fonts: Fully Embedded</div>
                    <div>✓ Compression: Optimized</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Pre-flight Checklist */}
          {preview && preview.checklist && (
            <div className="mb-6">
              <h3 className="text-lg font-heading font-bold text-charcoal-soft mb-3">Pre-flight Checklist</h3>
              <div className="space-y-2">
                {preview.checklist.map((item: any, idx: number) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-3 p-3 rounded-xl ${
                      item.status === 'pass'
                        ? 'bg-green-50 border border-green-200'
                        : item.status === 'warning'
                        ? 'bg-yellow-50 border border-yellow-200'
                        : 'bg-red-50 border border-red-200'
                    }`}
                  >
                    {item.status === 'pass' ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : item.status === 'warning' ? (
                      <Info className="w-5 h-5 text-yellow-600" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-600" />
                    )}
                    <div className="flex-1">
                      <div className="font-bold text-sm text-charcoal-soft">{item.category}</div>
                      <div className="text-xs text-cocoa-light">{item.message}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warnings */}
          {preview && preview.validation && preview.validation.warnings && preview.validation.warnings.length > 0 && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <div className="font-bold text-yellow-800 mb-2">Warnings</div>
                  <ul className="text-sm text-yellow-700 space-y-1">
                    {preview.validation.warnings.map((warning: string, idx: number) => (
                      <li key={idx}>• {warning}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Tier Restriction */}
          {userTier === UserTier.SPARK && (
            <div className="mb-6 p-6 bg-gradient-to-r from-gold-sunshine/20 to-coral-burst/20 border-2 border-gold-sunshine rounded-2xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-gold-sunshine rounded-full flex items-center justify-center">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-bold text-charcoal-soft">Premium Feature</div>
                  <div className="text-sm text-cocoa-light">Upgrade to unlock KDP export</div>
                </div>
              </div>
              <ul className="text-sm text-cocoa-light space-y-1 mb-4">
                <li>✓ Professional print-ready PDFs</li>
                <li>✓ Multiple trim sizes (6x9, 8.5x8.5, 8x10, 8.5x11)</li>
                <li>✓ 300 DPI print quality</li>
                <li>✓ Bleed support for full-page images</li>
                <li>✓ Quality validation dashboard</li>
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-peach-soft p-6 bg-cream-base flex items-center justify-between gap-4">
          <button
            onClick={onClose}
            className="px-6 py-3 rounded-xl border-2 border-peach-soft hover:border-coral-burst transition-colors font-bold text-charcoal-soft"
            disabled={isExporting}
          >
            Cancel
          </button>
          
          <button
            onClick={handleExport}
            disabled={isExporting || userTier === UserTier.SPARK}
            className="px-8 py-3 rounded-xl bg-gradient-to-r from-coral-burst to-gold-sunshine text-white font-heading font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {isExporting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <div className="flex flex-col items-start">
                  <span>{exportProgress}%</span>
                  <span className="text-xs text-white/80">{progressMessage}</span>
                </div>
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                {userTier === UserTier.SPARK ? 'Upgrade to Export' : 'Export for Amazon KDP'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// Quality Metric Component
const QualityMetric: React.FC<{ label: string; score: number; icon: string }> = ({ label, score, icon }) => {
  const getColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="bg-white rounded-xl p-3 border border-gray-200">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{icon}</span>
        <span className="text-xs font-bold text-cocoa-light">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${getColor(score)}`}>{score}%</div>
      <div className="w-full h-2 bg-gray-200 rounded-full mt-2 overflow-hidden">
        <div
          className={`h-full transition-all ${
            score >= 90 ? 'bg-green-500' : score >= 70 ? 'bg-yellow-500' : 'bg-red-500'
          }`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
};

export default KDPExportModal;
