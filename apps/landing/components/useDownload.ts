import { useEffect, useState } from 'react';

export type Platform = 'windows' | 'macos' | 'linux';

export interface PlatformInfo {
  label: string;
  arch: string;
  href: string;
}

export function useDownload(platforms: Record<Platform, PlatformInfo>) {
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [detecting, setDetecting] = useState(true);

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('win')) setPlatform('windows');
    else if (ua.includes('mac')) setPlatform('macos');
    else if (ua.includes('linux')) setPlatform('linux');
    setDetecting(false);
  }, []);

  const active = platform ? platforms[platform] : null;
  const downloadHref = active?.href ?? null;

  function scrollToDownload() {
    const el = document.getElementById('download');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return { platform, active, detecting, downloadHref, scrollToDownload } as const;
}
