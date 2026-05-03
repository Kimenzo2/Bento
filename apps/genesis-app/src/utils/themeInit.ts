/**
 * themeInit — anti-FOUC inline script
 *
 * This module documents the logic inlined into index.html <head>.
 * It runs BEFORE React hydration to prevent a flash of unstyled light mode
 * when the user has a dark preference saved.
 *
 * The contents of `INLINE_SCRIPT` below are what is embedded verbatim
 * in index.html. This file is NOT imported by the React bundle.
 *
 * Logic:
 *  1. Read 'genesis_theme_mode' from localStorage ('light' | 'dark' | 'system')
 *  2. If 'dark': add .dark to <html>
 *  3. If 'system' and OS prefers dark: add .dark to <html>
 *  4. Set color-scheme accordingly
 */

export const INLINE_SCRIPT = /* js */ `
(function(){
  var m=localStorage.getItem('genesis_theme_mode');
  var legacy=localStorage.getItem('genesis_dark_mode');
  var dark=m==='dark'||(m==='system'&&window.matchMedia('(prefers-color-scheme:dark)').matches)||(!m&&legacy==='true');
  if(dark){document.documentElement.classList.add('dark');document.documentElement.style.colorScheme='dark';}
  else{document.documentElement.style.colorScheme='light';}
})();
`.trim();
