/**
 * Bento Desktop Updater Endpoint
 *
 * Proxies GitHub releases to provide Tauri updater-compatible JSON.
 * Supports GET and HEAD requests.
 *
 * @see https://tauri.app/plugin/updater/
 */

import { type NextRequest, NextResponse } from 'next/server';

const GITHUB_OWNER = 'Kimenzo';
const GITHUB_REPO = 'Bento';

interface UpdaterResponse {
  version: string;
  notes: string;
  pub_date: string;
  platforms: Record<
    string,
    {
      signature: string;
      url: string;
    }
  >;
}

interface GitHubRelease {
  tag_name: string;
  body: string;
  published_at: string;
  assets: GitHubAsset[];
}

interface GitHubAsset {
  name: string;
  browser_download_url: string;
  content_type: string;
  size: number;
}

const PLATFORM_PATTERNS: Array<{
  key: string;
  assetPattern: RegExp;
  sigPattern: RegExp;
}> = [
  {
    key: 'windows-x86_64',
    assetPattern: /\.nsis\.zip$/i,
    sigPattern: /\.nsis\.zip\.sig$/i,
  },
  {
    key: 'darwin-aarch64',
    assetPattern: /\.dmg\.tar\.gz$/i,
    sigPattern: /\.dmg\.tar\.gz\.sig$/i,
  },
  {
    key: 'linux-x86_64',
    assetPattern: /\.AppImage\.tar\.gz$/i,
    sigPattern: /\.AppImage\.tar\.gz\.sig$/i,
  },
];

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  return handleUpdater(request);
}

export async function HEAD(request: NextRequest) {
  return handleUpdater(request);
}

async function handleUpdater(_request: NextRequest) {
  try {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Bento-Updater',
    };

    const token = process.env.GITHUB_TOKEN || process.env.VERCEL_GITHUB_TOKEN;
    if (token) {
      headers.Authorization = 'Bearer ' + token;
    }

    const releaseRes = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
      { headers }
    );

    if (!releaseRes.ok) {
      if (releaseRes.status === 404) {
        return new NextResponse(null, { status: 204 });
      }
      console.error('GitHub API error:', releaseRes.status, await releaseRes.text());
      return NextResponse.json({ error: 'Failed to fetch release data' }, { status: 502 });
    }

    const release: GitHubRelease = await releaseRes.json();

    const platforms: UpdaterResponse['platforms'] = {};
    let hasAnyPlatform = false;

    for (const pattern of PLATFORM_PATTERNS) {
      const sigAsset = release.assets.find((a) => pattern.sigPattern.test(a.name));
      const dlAsset = release.assets.find((a) => pattern.assetPattern.test(a.name));

      if (!sigAsset || !dlAsset) continue;

      const sigRes = await fetch(sigAsset.browser_download_url);
      if (!sigRes.ok) continue;

      const signature = (await sigRes.text()).trim();
      if (!signature) continue;

      platforms[pattern.key] = {
        signature,
        url: dlAsset.browser_download_url,
      };
      hasAnyPlatform = true;
    }

    if (!hasAnyPlatform) {
      return new NextResponse(null, { status: 204 });
    }

    const body: UpdaterResponse = {
      version: release.tag_name.startsWith('v') ? release.tag_name.slice(1) : release.tag_name,
      notes: release.body || '',
      pub_date: release.published_at,
      platforms,
    };

    const resp = NextResponse.json(body, { status: 200 });
    resp.headers.set('Access-Control-Allow-Origin', '*');
    resp.headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    resp.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

    return resp;
  } catch (err) {
    console.error('Updater handler error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
