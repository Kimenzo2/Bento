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
