import { useEffect } from 'react';

interface PageSEO {
  title: string;
  description: string;
  canonical?: string;
  ogTitle?: string;
  ogDescription?: string;
}

const BASE_URL = 'https://iamazeyou.me';

export function usePageSEO({ title, description, canonical, ogTitle, ogDescription }: PageSEO) {
  useEffect(() => {
    document.title = title;

    const setMeta = (attr: string, key: string, content: string) => {
      let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
      if (el) {
        el.setAttribute('content', content);
      } else {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        el.setAttribute('content', content);
        document.head.appendChild(el);
      }
    };

    setMeta('name', 'description', description);
    setMeta('property', 'og:title', ogTitle || title);
    setMeta('property', 'og:description', ogDescription || description);

    if (canonical) {
      const fullUrl = canonical.startsWith('http') ? canonical : `${BASE_URL}${canonical}`;
      setMeta('property', 'og:url', fullUrl);
      const link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
      if (link) {
        link.href = fullUrl;
      }
    }

    return () => {
      document.title = 'Genesis | AI Visual Storytelling for the Next Generation';
      setMeta('name', 'description', 'Create and explore interactive stories across various realms with our AI-powered visual storytelling and learning platform.');
      setMeta('property', 'og:title', 'Genesis | Where Imagination Becomes Reality');
      setMeta('property', 'og:description', 'AI-powered visual storytelling for the next generation. Transform ideas into living worlds — explore galaxies, kingdoms, and the microscopic universe of life.');
      setMeta('property', 'og:url', BASE_URL);
      const link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
      if (link) link.href = `${BASE_URL}/`;
    };
  }, [title, description, canonical, ogTitle, ogDescription]);
}
