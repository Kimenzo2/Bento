// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

import type { MetadataRoute } from 'next';

const base = 'https://iamazeyou.me';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: base, lastModified: new Date('2026-07-11'), changeFrequency: 'weekly', priority: 1.0 },
    {
      url: `${base}/pricing`,
      lastModified: new Date('2026-07-11'),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${base}/download`,
      lastModified: new Date('2026-07-11'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${base}/auth/signup`,
      lastModified: new Date('2026-07-11'),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${base}/auth/login`,
      lastModified: new Date('2026-07-11'),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${base}/legal/privacy`,
      lastModified: new Date('2026-07-11'),
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${base}/legal/terms`,
      lastModified: new Date('2026-07-11'),
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${base}/legal/cookies`,
      lastModified: new Date('2026-07-11'),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ];
}
