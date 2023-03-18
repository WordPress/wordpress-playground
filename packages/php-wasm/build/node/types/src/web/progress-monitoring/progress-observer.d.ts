import { DownloadProgress } from "./emscripten-download-monitor";
export type ProgressMode = 
/**
 * Real-time progress is used when we get real-time reports
 * about the progress.
 */
'REAL_TIME'
/**
 * Slowly increment progress is used when we don't know how long
 * an operation will take and just want to keep slowly incrementing
 * the progress bar.
 */
 | 'SLOWLY_INCREMENT';
export type ProgressObserverEvent = {
    progress: number;
    mode: ProgressMode;
    caption: string;
};
export declare class ProgressObserver extends EventTarget {
    #private;
    progress: number;
    mode: ProgressMode;
    caption: string;
    partialObserver(progressBudget: any, caption?: string): (progress: CustomEvent<DownloadProgress>) => void;
    slowlyIncrementBy(progress: any): void;
    get totalProgress(): number;
}
