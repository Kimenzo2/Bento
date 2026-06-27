/**
 * Bento Landing Page
 *
 * Download links point to CrabNebula Cloud CDN for the latest release.
 * CI copies installer artifacts to public/downloads/ as fallback.
 */

import fs from 'fs';
import path from 'path';
import Nav from '../components/Nav';
import Hero from '../components/Hero';
import AppShowcase from '../components/AppShowcase';
import WhyBento from '../components/WhyBento';
import DownloadSection from '../components/DownloadSection';
import Footer from '../components/Footer';

const CN_CDN = 'https://cdn.crabnebula.app/download/bento-industries/bento/latest/platform';

function buildPlatforms(_version: string) {
  return {
    windows: {
      label: 'Windows',
      arch: 'Windows 64-bit',
      href: CN_CDN + '/nsis-x86_64',
    },
    macos: {
      label: 'macOS',
      arch: 'macOS (Universal)',
      href: CN_CDN + '/dmg-universal',
    },
    linux: {
      label: 'Linux',
      arch: 'Linux (AppImage + deb)',
      href: CN_CDN + '/appimage-x86_64',
    },
  };
}

function getLatestVersion(): string {
  try {
    const dir = path.join(process.cwd(), 'public', 'downloads');
    if (!fs.existsSync(dir)) return '0.1.0';

    const versions = fs
      .readdirSync(dir)
      .map((f) => f.match(/Bento_(\d+\.\d+\.\d+)_/))
      .filter(Boolean)
      .map((m) => m![1])
      .sort((a, b) => {
        const [am, ab, ap] = a.split('.').map(Number);
        const [bm, bb, bp] = b.split('.').map(Number);
        return bm - am || bb - ab || bp - ap;
      });
    return versions[0] || '0.1.0';
  } catch {
    return '0.1.0';
  }
}

export default function HomePage() {
  const version = getLatestVersion();
  const platforms = buildPlatforms(version);

  return (
    <>
      <Nav platforms={platforms} />
      <main id="main-content">
        <Hero version={version} platforms={platforms} />
        <div className="section-divider" aria-hidden="true" />
        <AppShowcase />
        <div className="section-divider" aria-hidden="true" />
        <WhyBento />
        <div className="section-divider" aria-hidden="true" />
        <DownloadSection version={version} />
      </main>
      <Footer />
    </>
  );
}
