import { useEffect } from 'react';

export const DEFAULT_FAVICON = '/wiserlogo.png';
const DEFAULT_APP_NAME = 'POS System';

const setFavicon = (href) => {
  const selectors = [
    "link[rel='icon']",
    "link[rel='shortcut icon']",
    "link[rel*='icon']",
  ];

  let link = null;
  for (const selector of selectors) {
    link = document.querySelector(selector);
    if (link) break;
  }

  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/png';
    document.head.appendChild(link);
  }

  const nextHref = new URL(href, window.location.origin).href;
  if (link.href !== nextHref) {
    link.href = href;
    link.type = 'image/png';
  }
};

/**
 * Updates the browser tab title and favicon.
 * Title format: "{pageTitle} - {companyName}" or just "{companyName}" when no page title.
 */
export const usePageTitle = ({
  title = '',
  companyName = '',
  favicon = DEFAULT_FAVICON,
} = {}) => {
  useEffect(() => {
    const name = (companyName || '').trim() || DEFAULT_APP_NAME;
    const pageTitle = (title || '').trim();
    document.title = pageTitle ? `${pageTitle} - ${name}` : name;
    setFavicon(favicon);
  }, [title, companyName, favicon]);
};
