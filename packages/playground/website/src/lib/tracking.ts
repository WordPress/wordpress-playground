/**
 * Declare the global window.gtag function
 */
declare global {
    interface Window { gtag: any; }
}

/**
 * Google Analytics event names
 */
type GAEvent = 'load' | 'step';

/**
 * Log a tracking event to Google Analytics
 * @param GAEvent The event name
 * @param Object Event data
 */
export const logTrackingEvent = (event: GAEvent, data?: {[key: string]: string}) => {
    if (typeof window === 'undefined' || !window.gtag) {
        return;
    }
    window.gtag('event', event, data);
}
