import { useState, useEffect } from 'react';

export function useDeviceMode() {
    const [isMobile, setIsMobile] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);

    useEffect(() => {
        // Evaluate initially
        const touchQuery = window.matchMedia('(pointer: coarse)');
        const standaloneQuery = window.matchMedia('(display-mode: standalone)');
        
        const updateMode = () => {
            const hasTouch = touchQuery.matches;
            const isPWA = standaloneQuery.matches;
            setIsStandalone(isPWA);
            // We consider the device "Mobile Intent" if it's running as a PWA,
            // OR if it's a touch device and width is small-ish (extra safety net).
            // But relying primarily on touch + standalone is what we designed.
            setIsMobile(hasTouch || isPWA || window.innerWidth < 768);
        };

        updateMode();

        // Listen for changes (e.g., devtools toggling)
        touchQuery.addEventListener('change', updateMode);
        standaloneQuery.addEventListener('change', updateMode);
        window.addEventListener('resize', updateMode);

        return () => {
            touchQuery.removeEventListener('change', updateMode);
            standaloneQuery.removeEventListener('change', updateMode);
            window.removeEventListener('resize', updateMode);
        };
    }, []);

    return { isMobile, isStandalone };
}
