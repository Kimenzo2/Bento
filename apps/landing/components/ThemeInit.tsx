// ⚠️ ABSOLUTE GIT SAFETY LAW ⚠️ — THE AGENT MUST NEVER RUN git reset, git stash, git checkout --, git clean -f, git restore, git revert, git rebase, git cherry-pick, git commit --amend, git push --force, OR ANY OTHER DESTRUCTIVE GIT OPERATION WITHOUT EXPLICIT CONSENT FROM THE OWNER. WORKING TREE CHANGES ARE PRECIOUS AND IRREPLACEABLE. THEY MUST NEVER BE STASHED, DISCARDED, REVERTED, RESET, OR OVERWRITTEN. ALWAYS ASK THE OWNER FIRST. NO EXCEPTIONS, EVER.

'use client';

import Script from 'next/script';

export default function ThemeInit() {
  return (
    <Script
      id="theme-init"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `(function(){try{var m=document.cookie.match(/(?:^|;\\s*)theme=(dark|light)(?:;|$)/);if(m){document.documentElement.setAttribute("data-theme",m[1])}else if(window.matchMedia("(prefers-color-scheme:dark)").matches){document.documentElement.setAttribute("data-theme","dark")}}catch(e){}})()`,
      }}
    />
  );
}
