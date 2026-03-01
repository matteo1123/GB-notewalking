declare global {
    interface Window {
        gtag?: (...args: any[]) => void;
        fbq?: (...args: any[]) => void;
    }
}

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function Analytics() {
    const location = useLocation();

    useEffect(() => {
        // Google Analytics PageView
        if (typeof window.gtag === 'function') {
            window.gtag('config', 'G-9LF8QJFEGG', {
                page_path: location.pathname + location.search
            });
        }

        // Meta (Facebook) Pixel PageView
        if (typeof window.fbq === 'function') {
            window.fbq('track', 'PageView');
        }
    }, [location]);

    return null;
}
