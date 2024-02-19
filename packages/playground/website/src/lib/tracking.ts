/**
 * Declare the global window.gtag function
 */
declare global {
    interface Window { gtag: any; }
}

/**
 * Google Analytics event names
 */
export enum GAEvent {
    Step = 'step',
    Load = 'load',
}

/**
 * Add an event to Google Analytics
 * @param GAEvent The event name
 * @param Object Event data
 */
export const addEvent = (event: GAEvent, data?: {[key: string]: string}) => {
    if (typeof window === 'undefined' || !window.gtag) {
        return;
    }
    window.gtag('event', event, data);
}