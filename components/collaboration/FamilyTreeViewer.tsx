import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  GitBranch, 
  GitCommit, 
  GitMerge,
  Clock,
  Eye,
  RotateCcw,
  Copy,
  ChevronRight,
  ChevronDown,
  X,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  Move,
  Info,
  Star,
  Sparkles
} from 'lucide-react';
import { versionControlService } from '../../services/versionControlService';
import type { VisualVersion, VisualBranch, VersionNode } from '../../types/advanced';

interface FamilyTreeViewerProps {
  visualId: string;
  isOpen: boolean;
  onClose: () => void;
  onRestoreVersion?: (version: VisualVersion) => void;
  onForkVersion?: (version: VisualVersion) => void;
}

export const FamilyTreeViewer: React.FC<FamilyTreeViewerProps> = ({
  visualId,
  isOpen,
  onClose,
  onRestoreVersion,
  onForkVersion
}) => {
  const [versions, setVersions] = useState<VisualVersion[]>([]);
  const [branches, setBranches] = useState<VisualBranch[]>([]);
  const [familyTree, setFamilyTree] = useState<VersionNode | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<VisualVersion | null>(null);
  const [compareVersion, setCompareVersion] = useState<VisualVersion | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [viewMode, setViewMode] = useState<'tree' | 'timeline' | 'branches'>('timeline');
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [expandedBranches, setExpandedBranches] = useState<Set<string>>(new Set(['main']));

  useEffect(() => {
    if (isOpen && visualId) {
      loadVersionHistory();
    }
  }, [isOpen, visualId]);

  const loadVersionHistory = async () => {
    setLoading(true);
    try {
      const [history, branchList, tree] = await Promise.all([
        versionControlService.getVersions(visualId),
        versionControlService.getBranches(visualId),
        versionControlService.getFamilyTree(visualId)
      ]);

      setVersions(history);
      setBranches(branchList);
      // Convert FamilyTree to VersionNode format
      if (tree && tree.root) {
        setFamilyTree(tree.root as unknown as VersionNode);
      }
    } catch (error) {
      console.error('Error loading version history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (version: VisualVersion) => {
    try {
      await versionControlService.restoreVersion(visualId, version.id);
      onRestoreVersion?.(version);
      await loadVersionHistory();
    } catch (error) {
      console.error('Error restoring version:', error);
    }
  };

  const handleFork = async (version: VisualVersion) => {
    try {
      const branchName = `fork-${Date.now()}`;
      await versionControlService.createBranch(visualId, branchName, version.id);
      onForkVersion?.(version);
      await loadVersionHistory();
    } catch (error) {
      console.error('Error forking version:', error);
    }
  };

  const handleCompare = (version: VisualVersion) => {
    if (!isComparing) {
      setCompareVersion(version);
      setIsComparing(true);
    } else if (compareVersion && compareVersion.id !== version.id) {
      // Show comparison
      setSelectedVersion(version);
    }
  };

  const cancelCompare = () => {
    setIsComparing(false);
    setCompareVersion(null);
  };

  const toggleBranch = (branchName: string) => {
    setExpandedBranches(prev => {
      const next = new Set(prev);
      if (next.has(branchName)) {
        next.delete(branchName);
      } else {
        next.add(branchName);
      }
      return next;
    });
  };

  const groupedVersions = useMemo(() => {
    const groups: Record<string, VisualVersion[]> = {};
    versions.forEach(v => {
      const branch = v.branch_name || 'main';
      if (!groups[branch]) groups[branch] = [];
      groups[branch].push(v);
    });
    return groups;
  }, [versions]);

  const formatDate = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    
    return d.toLocaleDateString();
  };

  if (!isOpen) return null;

  return (
    <div 
      className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center ${
        isFullscreen ? 'p-0' : 'p-4'
      }`}
    >
      <div 
        className={`bg-gray-900 rounded-2xl overflow-hidden flex flex-col ${
          isFullscreen ? 'w-full h-full rounded-none' : 'w-full max-w-5xl max-h-[90vh]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
              <GitBranch className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Version History</h2>
              <p className="text-gray-400 text-sm">
                {versions.length} versions • {branches.length} branches
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Tabs */}
            <div className="flex bg-gray-800 rounded-lg p-1">
              {[
                { id: 'timeline', label: 'Timeline', icon: Clock },
                { id: 'branches', label: 'Branches', icon: GitBranch },
                { id: 'tree', label: 'Tree', icon: GitMerge }
              ].map(mode => (
                <button
                  key={mode.id}
                  onClick={() => setViewMode(mode.id as typeof viewMode)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                    viewMode === mode.id
                      ? 'bg-gray-700 text-white'
                      : 'text-gray-400 hover:text-gray-300'
                  }`}
                >
                  <mode.icon className="w-4 h-4" />
                  {mode.label}
                </button>
              ))}
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1 ml-2">
              <button
                onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}
                className="p-1.5 hover:bg-gray-800 rounded transition-colors"
              >
                <ZoomOut className="w-4 h-4 text-gray-400" />
              </button>
              <span className="text-xs text-gray-500 w-12 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom(z => Math.min(2, z + 0.1))}
                className="p-1.5 hover:bg-gray-800 rounded transition-colors"
              >
                <ZoomIn className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              {isFullscreen ? (
                <Minimize2 className="w-5 h-5 text-gray-400" />
              ) : (
                <Maximize2 className="w-5 h-5 text-gray-400" />
              )}
            </button>

            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Compare Mode Banner */}
        {isComparing && (
          <div className="px-4 py-2 bg-blue-500/20 border-b border-blue-500/30 flex items-center justify-between">
            <p className="text-sm text-blue-300">
              <span className="font-medium">Compare Mode:</span> Select another version to compare with "{compareVersion?.version_name || `v${compareVersion?.version_number}`}"
            </p>
            <button
              onClick={cancelCompare}
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
            </div>
          ) : (
            <>
              {/* Main View */}
              <div 
                className="flex-1 overflow-auto p-4"
                style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
              >
                {/* Timeline View */}
                {viewMode === 'timeline' && (
                  <div className="space-y-4 max-w-2xl mx-auto">
                    {versions.map((version, index) => (
                      <VersionCard
                        key={version.id}
                        version={version}
                        isFirst={index === 0}
                        isLast={index === versions.length - 1}
                        isSelected={selectedVersion?.id === version.id}
                        isCompareTarget={compareVersion?.id === version.id}
                        isComparing={isComparing}
                        onSelect={() => setSelectedVersion(version)}
                        onRestore={() => handleRestore(version)}
                        onFork={() => handleFork(version)}
                        onCompare={() => handleCompare(version)}
                        formatDate={formatDate}
                      />
                    ))}

                    {versions.length === 0 && (
                      <div className="text-center py-12">
                        <GitCommit className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                        <p className="text-gray-400">No versions yet</p>
                        <p className="text-sm text-gray-500">
                          Versions are created when you save changes
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Branches View */}
                {viewMode === 'branches' && (
                  <div className="space-y-4">
                    {Object.entries(groupedVersions).map(([branchName, branchVersions]) => (
                      <div key={branchName} className="bg-gray-800/50 rounded-xl overflow-hidden">
                        <button
                          onClick={() => toggleBranch(branchName)}
                          className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-800/70 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <GitBranch className="w-5 h-5 text-green-400" />
                            <span className="font-medium text-white">{branchName}</span>
                            <span className="text-xs text-gray-500">
                              {branchVersions.length} versions
                            </span>
                            {branchName === 'main' && (
                              <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
                                default
                              </span>
                            )}
                          </div>
                          {expandedBranches.has(branchName) ? (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-gray-400" />
                          )}
                        </button>

                        {expandedBranches.has(branchName) && (
                          <div className="px-4 pb-4 space-y-2">
                            {branchVersions.map((version, index) => (
                              <div
                                key={version.id}
                                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                                  selectedVersion?.id === version.id
                                    ? 'bg-green-500/20 border border-green-500/30'
                                    : 'bg-gray-900/50 hover:bg-gray-900/70'
                                }`}
                                onClick={() => setSelectedVersion(version)}
                              >
                                <div className="flex items-center gap-3">
                                  <GitCommit className="w-4 h-4 text-gray-500" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-white text-sm font-medium truncate">
                                      {version.version_name || `Version ${version.version_number}`}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      {formatDate(version.created_at)}
                                    </p>
                                  </div>
                                  {version.is_starred && (
                                    <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Tree View */}
                {viewMode === 'tree' && familyTree && (
                  <div className="min-w-max">
                    <TreeNode
                      node={familyTree}
                      depth={0}
                      selectedId={selectedVersion?.id}
                      onSelect={(id) => {
                        const version = versions.find(v => v.id === id);
                        if (version) setSelectedVersion(version);
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Detail Panel */}
              {selectedVersion && (
                <div className="w-80 border-l border-gray-800 overflow-y-auto">
                  <VersionDetailPanel
                    version={selectedVersion}
                    compareWith={isComparing && compareVersion ? compareVersion : undefined}
                    onRestore={() => handleRestore(selectedVersion)}
                    onFork={() => handleFork(selectedVersion)}
                    onClose={() => setSelectedVersion(null)}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Version Card Component
interface VersionCardProps {
  version: VisualVersion;
  isFirst: boolean;
  isLast: boolean;
  isSelected: boolean;
  isCompareTarget: boolean;
  isComparing: boolean;
  onSelect: () => void;
  onRestore: () => void;
  onFork: () => void;
  onCompare: () => void;
  formatDate: (date: string) => string;
}

const VersionCard: React.FC<VersionCardProps> = ({
  version,
  isFirst,
  isLast,
  isSelected,
  isCompareTarget,
  isComparing,
  onSelect,
  onRestore,
  onFork,
  onCompare,
  formatDate
}) => {
  return (
    <div className="relative flex gap-4">
      {/* Timeline Line */}
      <div className="flex flex-col items-center">
        <div className={`w-4 h-4 rounded-full border-2 z-10 ${
          isFirst 
            ? 'bg-green-500 border-green-400' 
            : isCompareTarget
              ? 'bg-blue-500 border-blue-400'
              : isSelected
                ? 'bg-purple-500 border-purple-400'
                : 'bg-gray-700 border-gray-600'
        }`} />
        {!isLast && (
          <div className="w-0.5 flex-1 bg-gray-700" />
        )}
      </div>

      {/* Card */}
      <div
        className={`flex-1 p-4 rounded-xl cursor-pointer transition-all mb-4 ${
          isSelected
            ? 'bg-purple-500/20 border border-purple-500/30'
            : isCompareTarget
              ? 'bg-blue-500/20 border border-blue-500/30'
              : 'bg-gray-800/50 hover:bg-gray-800/70 border border-transparent'
        }`}
        onClick={onSelect}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-white">
                {version.version_name || `Version ${version.version_number}`}
              </h4>
              {version.is_auto_save && (
                <span className="px-1.5 py-0.5 bg-gray-700 text-gray-400 text-xs rounded">
                  Auto
                </span>
              )}
              {version.is_starred && (
                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              )}
            </div>
            <p className="text-sm text-gray-400 mt-1">
              {formatDate(version.created_at)}
            </p>
            {version.description && (
              <p className="text-sm text-gray-500 mt-2 line-clamp-2">
                {version.description}
              </p>
            )}
            {version.changes_summary && (
              <div className="flex gap-2 mt-2 text-xs">
                {version.changes_summary.prompt_changed && (
                  <span className="text-blue-400">Prompt changed</span>
                )}
                {version.changes_summary.style_changed && (
                  <span className="text-purple-400">Style changed</span>
                )}
                {version.changes_summary.settings_changed && (
                  <span className="text-orange-400">Settings changed</span>
                )}
              </div>
            )}
          </div>

          {/* Thumbnail */}
          {version.thumbnail_url && (
            <div 
              className="w-16 h-16 rounded-lg bg-cover bg-center ml-4 flex-shrink-0"
              style={{ backgroundImage: `url(${version.thumbnail_url})` }}
            />
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-700/50">
          <button
            onClick={(e) => { e.stopPropagation(); onRestore(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restore
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onFork(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
            Fork
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onCompare(); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
              isComparing
                ? 'bg-blue-500 hover:bg-blue-600 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-white'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            Compare
          </button>
        </div>
      </div>
    </div>
  );
};

// Tree Node Component
interface TreeNodeProps {
  node: VersionNode;
  depth: number;
  selectedId?: string;
  onSelect: (id: string) => void;
}

const TreeNode: React.FC<TreeNodeProps> = ({ node, depth, selectedId, onSelect }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="ml-8 relative">
      {/* Connection Line */}
      {depth > 0 && (
        <div className="absolute -left-4 top-0 h-6 w-4 border-l-2 border-b-2 border-gray-600 rounded-bl" />
      )}

      {/* Node */}
      <div
        className={`inline-flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors mb-2 ${
          selectedId === node.id
            ? 'bg-purple-500/20 border border-purple-500/30'
            : 'hover:bg-gray-800'
        }`}
        onClick={() => onSelect(node.id)}
      >
        {hasChildren && (
          <button
            onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
            className="p-0.5"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            )}
          </button>
        )}
        {!hasChildren && <div className="w-5" />}

        <GitCommit className="w-4 h-4 text-green-400" />
        <span className="text-white text-sm">v{node.version_number}</span>
        {node.branch_name !== 'main' && (
          <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded">
            {node.branch_name}
          </span>
        )}
        {node.thumbnail_url && (
          <div 
            className="w-8 h-8 rounded bg-cover bg-center"
            style={{ backgroundImage: `url(${node.thumbnail_url})` }}
          />
        )}
      </div>

      {/* Children */}
      {isExpanded && hasChildren && (
        <div>
          {node.children!.map((child: VersionNode) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Version Detail Panel
interface VersionDetailPanelProps {
  version: VisualVersion;
  compareWith?: VisualVersion;
  onRestore: () => void;
  onFork: () => void;
  onClose: () => void;
}

const VersionDetailPanel: React.FC<VersionDetailPanelProps> = ({
  version,
  compareWith,
  onRestore,
  onFork,
  onClose
}) => {
  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-white">Version Details</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-800 rounded"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* Preview */}
      {version.thumbnail_url && (
        <div 
          className="w-full aspect-square rounded-xl bg-cover bg-center mb-4"
          style={{ backgroundImage: `url(${version.thumbnail_url})` }}
        />
      )}

      {/* Compare View */}
      {compareWith && (
        <div className="mb-4 p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
          <p className="text-sm text-blue-300 mb-2">Comparing with:</p>
          <p className="text-white font-medium">
            {compareWith.version_name || `Version ${compareWith.version_number}`}
          </p>
        </div>
      )}

      {/* Info */}
      <div className="space-y-3">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Name</p>
          <p className="text-white">
            {version.version_name || `Version ${version.version_number}`}
          </p>
        </div>

        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Created</p>
          <p className="text-white">
            {new Date(version.created_at).toLocaleString()}
          </p>
        </div>

        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Branch</p>
          <p className="text-white flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-green-400" />
            {version.branch_name || 'main'}
          </p>
        </div>

        {version.description && (
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Description</p>
            <p className="text-gray-300 text-sm">{version.description}</p>
          </div>
        )}

        {version.data && (
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Settings</p>
            <div className="bg-gray-800 rounded-lg p-3 space-y-2 text-sm">
              {(version.data as any).prompt && (
                <div>
                  <span className="text-gray-400">Prompt:</span>
                  <p className="text-white line-clamp-3">{String((version.data as any).prompt)}</p>
                </div>
              )}
              {(version.data as any).style && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Style:</span>
                  <span className="text-white">{String((version.data as any).style)}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-6 space-y-2">
        <button
          onClick={onRestore}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Restore This Version
        </button>
        <button
          onClick={onFork}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
        >
          <GitBranch className="w-4 h-4" />
          Create Branch From Here
        </button>
      </div>
    </div>
  );
};

export default FamilyTreeViewer;
