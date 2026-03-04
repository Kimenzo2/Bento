import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Check, CheckSquare, Copy, Download, Square, Trash2, X } from 'lucide-react';
import type React from 'react';
import { useCallback, useState } from 'react';
import type { SavedBook } from '../types';
import { Button } from './ui/button';

interface _BulkActionsProps {
  books: SavedBook[];
  selectedIds: Set<string>;
  onSelect: (id: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onDelete: (ids: string[]) => Promise<void>;
  onExport?: (ids: string[]) => Promise<void>;
  onDuplicate?: (ids: string[]) => Promise<void>;
}

export const useBulkSelection = (items: { id: string }[]) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(items.map((i) => i.id)));
  }, [items]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setIsSelectionMode(false);
  }, []);

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);

  const enterSelectionMode = useCallback(() => {
    setIsSelectionMode(true);
  }, []);

  return {
    selectedIds,
    selectedCount: selectedIds.size,
    isSelectionMode,
    toggle,
    selectAll,
    clearSelection,
    isSelected,
    enterSelectionMode,
    hasSelection: selectedIds.size > 0,
    isAllSelected: selectedIds.size === items.length && items.length > 0,
  };
};

// Bulk Actions Bar Component
interface BulkActionsBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onDelete: () => void;
  onExport?: () => void;
  onDuplicate?: () => void;
  isAllSelected: boolean;
  isDeleting?: boolean;
}

export const BulkActionsBar: React.FC<BulkActionsBarProps> = ({
  selectedCount,
  totalCount,
  onSelectAll,
  onClearSelection,
  onDelete,
  onExport,
  onDuplicate,
  isAllSelected,
  isDeleting = false,
}) => {
  if (selectedCount === 0) return null;

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-100"
    >
      <div className="bg-charcoal-soft text-white rounded-2xl border-2 border-peach-soft px-4 py-3 flex items-center gap-4">
        {/* Selection info */}
        <div className="flex items-center gap-3 pr-4 border-r border-gray-700">
          <Button
            variant="ghost"
            size="icon"
            onClick={isAllSelected ? onClearSelection : onSelectAll}
            className="p-1.5 hover:bg-gray-700"
          >
            {isAllSelected ? (
              <CheckSquare className="w-5 h-5 text-coral-burst" />
            ) : (
              <Square className="w-5 h-5" />
            )}
          </Button>
          <span className="text-sm font-medium">
            {selectedCount} of {totalCount} selected
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {onDuplicate && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDuplicate}
              className="flex px-3 py-1.5 hover:bg-gray-700"
            >
              <Copy className="w-4 h-4" />
              Duplicate
            </Button>
          )}

          {onExport && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onExport}
              className="flex px-3 py-1.5 hover:bg-gray-700"
            >
              <Download className="w-4 h-4" />
              Export
            </Button>
          )}

          <Button
            variant="destructive"
            size="sm"
            onClick={onDelete}
            disabled={isDeleting}
            className="flex px-3 py-1.5"
          >
            {isDeleting ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1 }}
              >
                <Trash2 className="w-4 h-4" />
              </motion.div>
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            Delete
          </Button>
        </div>

        {/* Close button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onClearSelection}
          title="Clear selection"
          className="p-1.5 hover:bg-gray-700 ml-2"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>
    </motion.div>
  );
};

// Delete Confirmation Modal
interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  count: number;
  isDeleting: boolean;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  count,
  isDeleting,
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-200 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

        <motion.div
          className="relative bg-white rounded-2xl border-2 border-peach-soft w-full max-w-sm overflow-hidden"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
        >
          <div className="p-6 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>

            <h3 className="text-xl font-bold text-charcoal-soft mb-2">
              Delete {count} Book{count > 1 ? 's' : ''}?
            </h3>

            <p className="text-cocoa-light mb-6">
              This action cannot be undone. All selected books and their illustrations will be
              permanently deleted.
            </p>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={isDeleting}
                className="flex-1 py-3"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={onConfirm}
                disabled={isDeleting}
                className="flex-1 py-3 flex"
              >
                {isDeleting ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1 }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </motion.div>
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </>
                )}
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// Selectable Book Card wrapper
interface SelectableCardProps {
  children: React.ReactNode;
  isSelectionMode: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onLongPress?: () => void;
}

export const SelectableCard: React.FC<SelectableCardProps> = ({
  children,
  isSelectionMode,
  isSelected,
  onSelect,
  onLongPress,
}) => {
  const [pressTimer, setPressTimer] = useState<NodeJS.Timeout | null>(null);

  const handleTouchStart = () => {
    if (!isSelectionMode && onLongPress) {
      const timer = setTimeout(() => {
        onLongPress();
        onSelect();
      }, 500);
      setPressTimer(timer);
    }
  };

  const handleTouchEnd = () => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      setPressTimer(null);
    }
  };

  return (
    <div
      className={`
                relative transition-all duration-200
                ${isSelectionMode ? 'cursor-pointer' : ''}
                ${isSelected ? 'ring-2 ring-coral-burst ring-offset-2 rounded-2xl' : ''}
            `}
      onClick={isSelectionMode ? onSelect : undefined}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {/* Selection checkbox */}
      <AnimatePresence>
        {isSelectionMode && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="absolute top-3 left-3 z-10"
          >
            <div
              className={`
                            w-6 h-6 rounded-full flex items-center justify-center
                            transition-colors
                            ${
                              isSelected
                                ? 'bg-coral-burst text-white'
                                : 'bg-white border-2 border-peach-soft'
                            }
                        `}
            >
              {isSelected && <Check className="w-4 h-4" />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overlay when selected */}
      {isSelected && (
        <div className="absolute inset-0 bg-coral-burst/10 rounded-2xl pointer-events-none" />
      )}

      {children}
    </div>
  );
};

export default { useBulkSelection, BulkActionsBar, DeleteConfirmModal, SelectableCard };
