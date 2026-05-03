import { Image as ImageIcon, Clock3, Sparkles } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import type { LifeInColourGenerationRecord } from '../../types';

interface SavedGenerationPanelProps {
  generations: LifeInColourGenerationRecord[];
  selectedId: string | null;
  onSelect: (generation: LifeInColourGenerationRecord) => void;
  onClear: () => void;
  isLoading: boolean;
  error: string | null;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Recently';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function SavedGenerationPanel({
  generations,
  selectedId,
  onSelect,
  onClear,
  isLoading,
  error,
}: SavedGenerationPanelProps) {
  if (!isLoading && !error && generations.length === 0) {
    return null;
  }

  return (
    <div className="rounded-[28px] border border-peach-soft bg-surface/75 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-cocoa-light">Previous colouring pages</div>
          <div className="mt-1 text-sm font-semibold text-charcoal-soft">Open a saved colouring page</div>
        </div>
        <Badge variant="secondary">{generations.length}</Badge>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-coral-burst/20 bg-coral-burst/5 px-4 py-3 text-sm text-charcoal-soft">
          {error}
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-3">
        {isLoading ? (
          <div className="rounded-2xl border border-peach-soft bg-white px-4 py-5 text-sm text-cocoa-light">
            Loading previous colouring pages...
          </div>
        ) : (
          generations.map((generation) => {
            const active = generation.id === selectedId;
            return (
              <button
                key={generation.id}
                type="button"
                onClick={() => onSelect(generation)}
                className={`rounded-2xl border px-4 py-4 text-left transition-all ${
                  active
                    ? 'border-coral-burst/35 bg-coral-burst/5 shadow-sm'
                    : 'border-peach-soft bg-white hover:-translate-y-0.5 hover:border-coral-burst/25'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="h-4 w-4 text-coral-burst" />
                      <span className="truncate font-heading text-sm font-bold text-charcoal-soft">
                        {generation.title}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-cocoa-light">
                      {generation.brief}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {generation.promptVersion || 'andrew-v2'}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {generation.analysisModel || 'gpt-5-nano'}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {generation.renderModel || generation.model || 'gpt-image-2'}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {generation.retryCount} repair{generation.retryCount === 1 ? '' : 's'}
                      </Badge>
                    </div>
                  </div>
                  <Badge variant={generation.status === 'ready' ? 'primary' : 'secondary'}>
                    {generation.status}
                  </Badge>
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-cocoa-light">
                  <Clock3 className="h-3.5 w-3.5" />
                  {formatDate(generation.createdAt)}
                </div>
              </button>
            );
          })
        )}
      </div>

      {selectedId ? (
        <div className="mt-4 flex justify-end">
          <Button variant="outline" size="sm" onClick={onClear}>
            <Sparkles className="h-4 w-4" />
            Clear selection
          </Button>
        </div>
      ) : null}
    </div>
  );
}
