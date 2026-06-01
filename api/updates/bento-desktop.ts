import type { VercelRequest, VercelResponse } from '@vercel/node';

const GITHUB_OWNER = 'Kimenzo';
const GITHUB_REPO = 'Genesis';

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'bento-desktop-updater',
    };

    const token = process.env.GITHUB_TOKEN || process.env.VERCEL_GITHUB_TOKEN;
    if (token) {
      headers.Authorization = 'Bearer ' + token;
    }

    const releaseRes = await fetch(
      'https://api.github.com/repos/' + GITHUB_OWNER + '/' + GITHUB_REPO + '/releases/latest',
      { headers }
    );

    if (!releaseRes.ok) {
      if (releaseRes.status === 404) {
        return res.status(204).end();
      }
      console.error('GitHub API error:', releaseRes.status, await releaseRes.text());
      return res.status(502).json({ error: 'Failed to fetch release data' });
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
      return res.status(204).end();
    }

    const body: UpdaterResponse = {
      version: release.tag_name.startsWith('v') ? release.tag_name.slice(1) : release.tag_name,
      notes: release.body || '',
      pub_date: release.published_at,
      platforms,
    };

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

    return res.status(200).json(body);
  } catch (err) {
    console.error('Updater handler error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
