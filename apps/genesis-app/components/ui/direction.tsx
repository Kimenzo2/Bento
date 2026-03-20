import type React from 'react';
import { createContext, useContext, useEffect, useMemo } from 'react';

type TextDirection = 'ltr' | 'rtl';

const DirectionContext = createContext<TextDirection>('ltr');

interface DirectionProviderProps {
  children: React.ReactNode;
  direction: TextDirection;
  language?: string;
}

export const DirectionProvider: React.FC<DirectionProviderProps> = ({
  children,
  direction,
  language,
}) => {
  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute('dir', direction);
    if (language) {
      html.setAttribute('lang', language);
    }
  }, [direction, language]);

  const value = useMemo(() => direction, [direction]);

  return (
    <DirectionContext.Provider value={value}>
      <div dir={direction}>{children}</div>
    </DirectionContext.Provider>
  );
};

export const useDirectionContext = (): TextDirection => {
  return useContext(DirectionContext);
};

export default DirectionProvider;
