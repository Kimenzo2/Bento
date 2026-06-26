/**
 * Bento Landing Page
 *
 * Download links point to local /downloads/ directory.
 * Version is detected by scanning the downloads folder at build time.
 * CI copies installer artifacts to public/downloads/ before deploying.
 */

import fs from 'fs';
import path from 'path';
import Nav from '../components/Nav';
import Hero from '../components/Hero';
import AppShowcase from '../components/AppShowcase';
import WhyBento from '../components/WhyBento';
import DownloadSection from '../components/DownloadSection';
import Footer from '../components/Footer';

function buildPlatforms(version: string) {
  return {
    windows: {
      label: 'Windows',
      arch: 'Windows 64-bit',
      href: '/downloads/Bento_' + version + '_x64-setup.exe',
    },
    macos: {
      label: 'macOS',
      arch: 'macOS (Apple Silicon)',
      href: '/downloads/Bento_' + version + '_aarch64.dmg',
    },
    linux: {
      label: 'Linux',
      arch: 'Linux (AppImage + deb)',
      href: '/downloads/Bento_' + version + '_amd64.AppImage',
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
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <Nav />
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
