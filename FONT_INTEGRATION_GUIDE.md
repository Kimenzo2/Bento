# Font Customization System - Integration Guide

## Overview
This guide explains how to integrate the dynamic font customization system into your Genesis application.

## Files Created

### Core Logic
- **`src/types/fonts.d.ts`** - TypeScript type definitions for font pairings
- **`src/config/fontPairings.ts`** - Configuration of 6 curated font pairings
- **`src/utils/fontLoader.ts`** - Utilities for loading Google Fonts dynamically
- **`src/hooks/useDynamicFontLoader.ts`** - Hook for lazy-loading fonts
- **`src/contexts/FontContext.tsx`** - React Context for managing font state
- **`src/hooks/useFonts.ts`** - Custom hook to consume FontContext

### UI Components
- **`src/components/settings/FontPreviewCard.tsx`** - Preview card for each font pairing
- **`src/components/settings/FontSelector.tsx`** - Main font selector UI component

### Modified Files
- **`index.css`** - Added CSS variables `--font-heading` and `--font-body`, added `.fonts-loading` class
- **`tailwind.config.js`** - Updated `fontFamily` to use CSS variables
- **`App.tsx`** - Wrapped app with `FontProvider`
- **`components/SettingsPanel.tsx`** - Added Typography tab

## Integration Steps

### 1. Wrap Your App with FontProvider

The `FontProvider` has already been added to `App.tsx`:

```tsx
import { FontProvider } from './contexts/FontContext';

const AppWithErrorBoundary: React.FC = () => (
  <ErrorBoundary>
    <ThemeProvider>
      <FontProvider>
        <App />
      </FontProvider>
    </ThemeProvider>
  </ErrorBoundary>
);
```

### 2. Access Font Context in Components

Use the `useFonts()` hook to access font state:

```tsx
import { useFonts } from '../hooks/useFonts';

function MyComponent() {
  const { activeFontPairing, setFontPairing, availablePairings } = useFonts();

  return (
    <div>
      <h1 className="font-heading">Heading using active font</h1>
      <p className="font-body">Body text using active font</p>
    </div>
  );
}
```

### 3. Use Font Classes in Your Components

Tailwind utilities `font-heading` and `font-body` now use the active font:

```tsx
<h1 className="font-heading font-bold text-4xl">
  This heading uses the selected heading font
</h1>

<p className="font-body text-base">
  This paragraph uses the selected body font
</p>
```

### 4. Navigate to Typography Settings

Users can access the Typography settings via the Settings panel:

1. Click the Settings icon in the navigation
2. Select the "Typography" tab
3. Choose from 6 font pairings

## Font Pairings

1. **Playful Classic** (Default) - Fredoka + Manrope
2. **Classic Academic** - Playfair Display + Source Sans 3
3. **Modern Tech** - Inter + IBM Plex Sans
4. **Storybook Magic** - Quicksand + Nunito
5. **Editorial Elegance** - Spectral + Lato
6. **Handwritten Warmth** - Caveat + Karla

## How It Works

1. **Font Loading**: Fonts are loaded dynamically from Google Fonts CDN when selected
2. **Persistence**: Selected font is saved to `localStorage` under key `genesis_font_pairing`
3. **CSS Variables**: Font family is applied via CSS variables `--font-heading` and `--font-body`
4. **FOUT Prevention**: `.fonts-loading` class prevents flash of unstyled text during font loading
5. **Performance**: Fonts are lazy-loaded only when viewed or selected

## Performance Considerations

- **Preconnect**: The system preconnects to Google Fonts domains for faster loading
- **Subset**: Fonts are subset to Latin characters only (`&subset=latin`)
- **Display Swap**: `font-display: swap` is used for better perceived performance
- **Lazy Loading**: Non-default fonts load only when previewed or selected
- **Caching**: Browser caches loaded fonts to prevent re-downloads

## Troubleshooting

### Fonts not loading?
- Check browser console for network errors
- Verify Google Fonts CDN is accessible
- Check that `FontProvider` wraps your app

### Fonts flash/flicker?
- The `.fonts-loading` class should prevent this
- Check that the class is being applied/removed correctly
- Verify CSS transitions in `index.css`

### Fonts don't persist?
- Check that localStorage is available and not blocked
- Verify the key `genesis_font_pairing` is being saved
- Clear localStorage and try again

## Advanced Usage

### Programmatically Change Fonts

```tsx
import { useFonts } from '../hooks/useFonts';

function MyComponent() {
  const { setFontPairing } = useFonts();
  
  const switchToModernTech = () => {
    setFontPairing('modern-tech');
  };
  
  return <button onClick={switchToModernTech}>Use Modern Tech</button>;
}
```

### Get Current Font Info

```tsx
const { activeFontPairing } = useFonts();

console.log(activeFontPairing.name); // e.g., "Playful Classic"
console.log(activeFontPairing.headingFont.family); // e.g., "Fredoka"
console.log(activeFontPairing.bodyFont.family); // e.g., "Manrope"
```

## Testing Checklist

- [ ] Navigate to Settings → Typography
- [ ] Click through all 6 font pairings
- [ ] Verify fonts change instantly across the app
- [ ] Reload page and verify selected font persists
- [ ] Check Network tab for font downloads
- [ ] Test on mobile devices
- [ ] Verify no FOUT (Flash of Unstyled Text)
- [ ] Check that text remains readable with all pairings

## Future Enhancements

Potential features to add:
- Font size control (14px - 20px)
- Line spacing control (1.3x - 2x)
- Font weight preference toggle
- Reader mode preset
- Per-book font override
- OpenDyslexic font for accessibility
