import type React from 'react';

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Instrument+Serif:ital@0;1&display=swap');
      `}</style>
      {children}
    </>
  );
}
