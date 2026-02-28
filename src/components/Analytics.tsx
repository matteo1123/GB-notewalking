declare global {
    interface Window {
        gtag?: (...args: any[]) => void;
    }
}

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function Analytics() {
    const location = useLocation();

    useEffect(() => {
        if (typeof window.gtag === 'function') {
            window.gtag('config', 'G-9LF8QJFEGG', {
                page_path: location.pathname + location.search
            });
        }
    }, [location]);

    return null;
}
