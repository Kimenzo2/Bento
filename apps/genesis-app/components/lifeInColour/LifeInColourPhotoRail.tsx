import { Plus, X } from 'lucide-react';
import { Button } from '../ui/button';
import type { LifeInColourDisplaySize } from './lifeInColourSizing';
import { LIFE_IN_COLOUR_DISPLAY_SIZE_CONFIG } from './lifeInColourSizing';

export interface LifeInColourPhotoItem {
  id: string;
  file: File;
  name: string;
  sizeLabel: string;
  previewUrl: string;
}

interface LifeInColourPhotoRailProps {
  photos: LifeInColourPhotoItem[];
  layoutSize?: LifeInColourDisplaySize;
  onAddPhoto: () => void;
  onRemovePhoto: (photoId: string) => void;
}

export function LifeInColourPhotoRail({
  photos,
  layoutSize = 'medium',
  onAddPhoto,
  onRemovePhoto,
}: LifeInColourPhotoRailProps) {
  if (photos.length === 0) {
    return null;
  }

  const displayConfig = LIFE_IN_COLOUR_DISPLAY_SIZE_CONFIG[layoutSize];

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.18em] text-cocoa-light">Photos</div>
          <div className="mt-1 text-sm font-semibold text-charcoal-soft">
            {photos.length} uploaded
          </div>
        </div>

        <Button variant="outline" size="sm" onClick={onAddPhoto} className="shrink-0">
          <Plus className="h-4 w-4" />
          Add more
        </Button>
      </div>

      <div className={`mt-4 grid gap-4 ${displayConfig.galleryGridClassName}`}>
        {photos.map((photo) => {
          return (
            <div key={photo.id} className="relative overflow-hidden rounded-[18px]">
              <div
                className={`relative overflow-hidden rounded-[18px] ${displayConfig.galleryTileHeight} bg-transparent`}
              >
                <img
                  src={photo.previewUrl}
                  alt={photo.name ? `Uploaded preview for ${photo.name}` : 'Uploaded preview'}
                  draggable={false}
                  className="pointer-events-none h-full w-full select-none object-cover"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-2 top-2 h-8 w-8 rounded-full border border-white/10 bg-charcoal-soft/75 text-white shadow-[0_10px_24px_-14px_rgba(0,0,0,0.55)] backdrop-blur-sm hover:bg-charcoal-soft/88 hover:text-white"
                onClick={() => onRemovePhoto(photo.id)}
                aria-label="Remove uploaded image"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
