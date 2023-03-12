import { DownloadProgress } from "./emscripten-download-monitor";

export const enum ProgressType {
	/**
	 * Real-time progress is used when we get real-time reports
	 * about the progress.
	 */
	REAL_TIME = 'REAL_TIME',
	/**
	 * Slowly increment progress is used when we don't know how long
	 * an operation will take and just want to keep slowly incrementing
	 * the progress bar.
	 */
	SLOWLY_INCREMENT = 'SLOWLY_INCREMENT',
}

export class ProgressObserver {
	#observedProgresses: Record<number, number> = {};
	#lastObserverId = 0;
	#onProgress: (
		progress: number,
		mode: ProgressType,
		caption?: string
	) => void;

	constructor(onProgress) {
		this.#onProgress = onProgress;
	}

	partialObserver(progressBudget, caption = '') {
		const id = ++this.#lastObserverId;
		this.#observedProgresses[id] = 0;
		return (progress: CustomEvent<DownloadProgress>) => {
			const { loaded, total } = progress?.detail || {};
			this.#observedProgresses[id] = (loaded / total) * progressBudget;
			this.#onProgress(
				this.totalProgress,
				ProgressType.REAL_TIME,
				caption
			);
		};
	}

	slowlyIncrementBy(progress) {
		const id = ++this.#lastObserverId;
		this.#observedProgresses[id] = progress;
		this.#onProgress(this.totalProgress, ProgressType.SLOWLY_INCREMENT);
	}

	get totalProgress() {
		return Object.values(this.#observedProgresses).reduce(
			(total, progress) => total + progress,
			0
		);
	}
}
