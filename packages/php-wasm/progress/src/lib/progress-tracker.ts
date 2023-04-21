export interface ProgressTrackerOptions {
	weight?: number;
	caption?: string;
	fillTime?: number;
}

export type LoadingEvent = CustomEvent<{
	loaded: number;
	total: number;
}>;
export type ProgressTrackerEvent = CustomEvent<ProgressDetails>;
export type DoneEvent = CustomEvent<ProgressDetails>;

export interface ProgressDetails {
	progress: number;
	caption: string;
}

export type ProgressObserver = (progress: number) => void;
export type Listener<T> = (event: T) => void;

export type TSCompatibleListener<T> =
	| EventListenerOrEventListenerObject
	| null
	| Listener<T>;

export interface ProgressReceiver {
	setProgress(details: ProgressDetails): any;
	setLoaded(): any;
}

export class ProgressTracker extends EventTarget {
	private _selfWeight = 1;
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

	stage(weight: number, caption = ''): ProgressTracker {
		if (this._selfWeight - weight < -Number.EPSILON) {
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
		if (this._selfProgress + Number.EPSILON >= 100) {
			this.finish();
		}
	}

	finish(): void {
		if (this._fillInterval) {
			clearInterval(this._fillInterval);
		}
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
		return this.progress + Number.EPSILON >= 100;
	}

	get progress(): number {
		return this._subTrackers.reduce(
			(sum, tracker) => sum + tracker.progress * tracker.weight,
			this._selfProgress * this._selfWeight
		);
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

	addProgressReceiver(receiver: ProgressReceiver) {
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
