import { useState, useEffect } from 'react';

export const useResponsive = () => {
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return {
    windowWidth,
    isMobile: windowWidth < 640,
    isSm: windowWidth >= 640,
    isMd: windowWidth >= 768,
    isLg: windowWidth >= 1024,
    isXl: windowWidth >= 1280,
    is2Xl: windowWidth >= 1536,
  };
};
