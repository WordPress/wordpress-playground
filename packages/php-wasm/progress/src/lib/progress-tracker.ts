/**
 * Options for customizing the progress tracker.
 */
export interface ProgressTrackerOptions {
	/** The weight of the progress, a number between 0 and 1. */
	weight?: number;
	/** The caption to display during progress, a string. */
	caption?: string;
	/** The time in milliseconds to fill the progress, a number. */
	fillTime?: number;
}

/**
 * Custom event providing information about a loading process.
 */
export type LoadingEvent = CustomEvent<{
	/** The number representing how much was loaded. */
	loaded: number;
	/** The number representing how much needs to loaded in total. */
	total: number;
}>;

/**
 * Custom event providing progress details.
 */
export type ProgressTrackerEvent = CustomEvent<ProgressDetails>;

/**
 * Custom event providing progress details when the task is done.
 */
export type DoneEvent = CustomEvent<ProgressDetails>;

export interface ProgressDetails {
	/** The progress percentage as a number between 0 and 100. */
	progress: number;
	/** The caption to display during progress, a string. */
	caption: string;
}

/**
 * ProgressObserver A function that receives progress updates.
 *
 * @param progress The progress percentage as a number between 0 and 100.
 */
type ProgressObserver = (progress: number) => void;

/**
 * Listener A function for handling specific event types.
 *
 * @param event The event of type T.
 */
export type Listener<T> = (event: T) => void;

export type TSCompatibleListener<T> =
	| EventListenerOrEventListenerObject
	| null
	| Listener<T>;

export interface ProgressReceiver {
	setProgress(details: ProgressDetails): any;
	setLoaded(): any;
}

/*
 * Like Number.EPSILON, but better tuned to tracking progress.
 *
 * With Number.EPSILON, progress like 99.99999999999997 is still
 * considered to be below 100 – this is highly undeisrable.
 */
const PROGRESS_EPSILON = 0.00001;

/**
 * The ProgressTracker class is a tool for tracking progress in an operation
 * that is divided into multiple stages. It allows you to create sub-trackers
 * for each stage, with individual weights and captions. The main tracker
 * automatically calculates the progress based on the weighted sum of each
 * sub-tracker's progress. This makes it easy to keep track of a complex,
 * multi-stage process and report progress in a user-friendly way.
 *
 * After creating the sub-trackers, you can call the set() method to update the
 * progress of the current stage. You can also call the finish() method to mark
 * the current stage as complete and move on to the next one. Alternatively,
 * you can call the fillSlowly() method to simulate progress filling up slowly
 * to 100% before calling finish().
 *
 * @example
 * ```ts
 * const tracker = new ProgressTracker();
 * tracker.addEventListener('progress', (e) => {
 * 		console.log(
 * 				e.detail.progress,
 * 				e.detail.caption
 * 		);
 * });
 *
 * const stage1 = tracker.stage(0.5, 'Calculating pi digits');
 * const stage2 = tracker.stage(0.5, 'Downloading data');
 *
 * stage1.fillSlowly();
 * await calc100DigitsOfPi();
 * stage1.finish();
 *
 * await fetchWithProgress(function onProgress(loaded, total) {
 * 		stage2.set( loaded / total * 100);
 * });
 * stage2.finish();
 */
export class ProgressTracker extends EventTarget {
	private _selfWeight = 1;
	private _selfDone = false;
	private _selfProgress = 0;
	private _selfCaption = '';
	private _weight: number;
	private _progressObserver?: ProgressObserver;
	private _loadingListener?: Listener<LoadingEvent>;
	private _isFilling = false;
	private _fillTime: number;
	private _fillInterval?: any;
	private _subTrackers: ProgressTracker[] = [];

	constructor({
		weight = 1,
		caption = '',
		fillTime = 4,
	}: ProgressTrackerOptions = {}) {
		super();
		this._weight = weight;
		this._selfCaption = caption;
		this._fillTime = fillTime;
	}

	/**
	 * Creates a new sub-tracker with a specific weight.
	 *
	 * The weight determines what percentage of the overall progress
	 * the sub-tracker represents. For example, if the main tracker is
	 * monitoring a process that has two stages, and the first stage
	 * is expected to take twice as long as the second stage, you could
	 * create the first sub-tracker with a weight of 0.67 and the second
	 * sub-tracker with a weight of 0.33.
	 *
	 * The caption is an optional string that describes the current stage
	 * of the operation. If provided, it will be used as the progress caption
	 * for the sub-tracker. If not provided, the main tracker will look for
	 * the next sub-tracker with a non-empty caption and use that as the progress
	 * caption instead.
	 *
	 * Returns the newly-created sub-tracker.
	 *
	 * @throws {Error} If the weight of the new stage would cause the total weight of all stages to exceed 1.
	 *
	 * @param weight The weight of the new stage, as a decimal value between 0 and 1.
	 * @param caption The caption for the new stage, which will be used as the progress caption for the sub-tracker.
	 *
	 * @example
	 * ```ts
	 * const tracker = new ProgressTracker();
	 * const subTracker1 = tracker.stage(0.67, 'Slow stage');
	 * const subTracker2 = tracker.stage(0.33, 'Fast stage');
	 *
	 * subTracker2.set(50);
	 * subTracker1.set(75);
	 * subTracker2.set(100);
	 * subTracker1.set(100);
	 * ```
	 */
	stage(weight?: number, caption = ''): ProgressTracker {
		if (!weight) {
			weight = this._selfWeight;
		}
		if (this._selfWeight - weight < -PROGRESS_EPSILON) {
			throw new Error(
				`Cannot add a stage with weight ${weight} as the total weight of registered stages would exceed 1.`
			);
		}
		this._selfWeight -= weight;

		const subTracker = new ProgressTracker({
			caption,
			weight,
			fillTime: this._fillTime,
		});
		this._subTrackers.push(subTracker);
		subTracker.addEventListener('progress', () => this.notifyProgress());
		subTracker.addEventListener('done', () => {
			if (this.done) {
				this.notifyDone();
			}
		});
		return subTracker;
	}

	/**
	 * Fills the progress bar slowly over time, simulating progress.
	 *
	 * The progress bar is filled in a 100 steps, and each step, the progress
	 * is increased by 1. If `stopBeforeFinishing` is true, the progress bar
	 * will stop filling when it reaches 99% so that you can call `finish()`
	 * explicitly.
	 *
	 * If the progress bar is filling or already filled, this method does nothing.
	 *
	 * @example
	 * ```ts
	 * const progress = new ProgressTracker({ caption: 'Processing...' });
	 * progress.fillSlowly();
	 * ```
	 *
	 * @param options Optional options.
	 */
	fillSlowly({ stopBeforeFinishing = true } = {}): void {
		if (this._isFilling) {
			return;
		}
		this._isFilling = true;
		const steps = 100;
		const interval = this._fillTime / steps;
		this._fillInterval = setInterval(() => {
			this.set(this._selfProgress + 1);
			if (stopBeforeFinishing && this._selfProgress >= 99) {
				clearInterval(this._fillInterval);
			}
		}, interval);
	}

	set(value: number): void {
		this._selfProgress = Math.min(value, 100);
		this.notifyProgress();
		if (this._selfProgress + PROGRESS_EPSILON >= 100) {
			this.finish();
		}
	}

	finish(): void {
		if (this._fillInterval) {
			clearInterval(this._fillInterval);
		}
		this._selfDone = true;
		this._selfProgress = 100;
		this._isFilling = false;
		this._fillInterval = undefined;
		this.notifyProgress();
		this.notifyDone();
	}

	get caption(): string {
		for (let i = this._subTrackers.length - 1; i >= 0; i--) {
			if (!this._subTrackers[i].done) {
				const captionMaybe = this._subTrackers[i].caption;
				if (captionMaybe) {
					return captionMaybe;
				}
			}
		}
		return this._selfCaption;
	}

	setCaption(caption: string) {
		this._selfCaption = caption;
		this.notifyProgress();
	}

	get done(): boolean {
		return this.progress + PROGRESS_EPSILON >= 100;
	}

	get progress(): number {
		if (this._selfDone) {
			return 100;
		}
		const sum = this._subTrackers.reduce(
			(sum, tracker) => sum + tracker.progress * tracker.weight,
			this._selfProgress * this._selfWeight
		);
		return Math.round(sum * 10000) / 10000;
	}

	get weight(): number {
		return this._weight;
	}

	get observer() {
		if (!this._progressObserver) {
			this._progressObserver = (progress: number) => {
				this.set(progress);
			};
		}
		return this._progressObserver;
	}

	get loadingListener() {
		if (!this._loadingListener) {
			this._loadingListener = (event: LoadingEvent) => {
				this.set((event.detail.loaded / event.detail.total) * 100);
			};
		}
		return this._loadingListener;
	}

	pipe(receiver: ProgressReceiver) {
		receiver.setProgress({
			progress: this.progress,
			caption: this.caption,
		});
		this.addEventListener('progress', (event: ProgressTrackerEvent) => {
			receiver.setProgress({
				progress: event.detail.progress,
				caption: event.detail.caption,
			});
		});
		this.addEventListener('done', () => {
			receiver.setLoaded();
		});
	}

	override addEventListener(
		type: string,
		listener: TSCompatibleListener<ProgressTrackerEvent>
	) {
		super.addEventListener(type, listener as any);
	}

	override removeEventListener(
		type: string,
		listener: TSCompatibleListener<ProgressTrackerEvent>
	) {
		super.removeEventListener(type, listener as any);
	}

	private notifyProgress() {
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const self = this;
		this.dispatchEvent(
			new CustomEvent('progress', {
				detail: {
					get progress() {
						return self.progress;
					},
					get caption() {
						return self.caption;
					},
				},
			})
		);
	}

	private notifyDone() {
		this.dispatchEvent(new CustomEvent('done'));
	}
}
