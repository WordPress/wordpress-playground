import { DownloadProgress } from './emscripten-download-monitor';

export type ProgressMode =
	/**
	 * Real-time progress is used when we get real-time reports
	 * about the progress.
	 */
	| 'REAL_TIME'

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

export class ProgressObserver extends EventTarget {
	#observedProgresses: Record<number, number> = {};
	#lastObserverId = 0;

	progress = 0;
	mode: ProgressMode = 'REAL_TIME';
	caption = '';

	partialObserver(progressBudget: number, caption = '') {
		const id = ++this.#lastObserverId;
		this.#observedProgresses[id] = 0;
		return (progress: CustomEvent<DownloadProgress>) => {
			const { loaded, total } = progress?.detail || {};
			this.#observedProgresses[id] = (loaded / total) * progressBudget;
			this.#onProgress(this.totalProgress, 'REAL_TIME', caption);
		};
	}

	slowlyIncrementBy(progress: number) {
		const id = ++this.#lastObserverId;
		this.#observedProgresses[id] = progress;
		this.#onProgress(this.totalProgress, 'SLOWLY_INCREMENT');
	}

	get totalProgress() {
		return Object.values(this.#observedProgresses).reduce(
			(total, progress) => total + progress,
			0
		);
	}

	#onProgress(progress: number, mode: ProgressMode, caption?: string) {
		this.dispatchEvent(
			new CustomEvent('progress', {
				detail: {
					progress,
					mode,
					caption,
				},
			})
		);
	}
}
