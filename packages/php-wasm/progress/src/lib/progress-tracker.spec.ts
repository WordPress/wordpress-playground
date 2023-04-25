import { ProgressTracker } from './progress-tracker';
import type { ProgressTrackerEvent } from './progress-tracker';

describe('Tracks total progress', () => {
	it('A single ProgressTracker populated via fillSlowly (stopBeforeFinishing=true)', async () => {
		const tracker = new ProgressTracker({
			fillTime: 20,
		});
		tracker.fillSlowly({ stopBeforeFinishing: true });

		await new Promise((resolve) => setTimeout(resolve, 200));
		// Should not get to 100% unless we explicitly set it
		expect(tracker.progress).toBeCloseTo(99);
		tracker.finish();
		expect(tracker.progress).toBeCloseTo(100);
	});
	it('A single ProgressTracker populated via fillSlowly (stopBeforeFinishing=false)', async () => {
		const tracker = new ProgressTracker({
			fillTime: 20,
		});
		tracker.fillSlowly({ stopBeforeFinishing: false });

		await new Promise((resolve) => setTimeout(resolve, 200));
		expect(tracker.progress).toBeCloseTo(100);
	});

	it('A single ProgressTracker populated via set', () => {
		const tracker = new ProgressTracker();
		tracker.set(50);

		expect(tracker.progress).toBeCloseTo(50);
	});

	it('Equally-weighted subtrackers should sum to 100 total progress after completion', () => {
		const tracker = new ProgressTracker();
		const partial1 = tracker.stage(1 / 3, 'Part 1');
		const partial2 = tracker.stage(1 / 3, 'Part 2');
		const partial3 = tracker.stage(1 / 3, 'Part 3');

		partial1.set(100);
		expect(tracker.progress).toBeCloseTo(33.33, 2);

		partial2.set(100);
		partial2.set(100);
		expect(tracker.progress).toBeCloseTo(66.67, 2);

		partial3.set(100);
		expect(tracker.progress).toBeCloseTo(100);
	});

	it('Differently-weighted subtrackers should sum to 100 total progress after completion', () => {
		const tracker = new ProgressTracker();
		const partial1 = tracker.stage(0.2, 'Part 1');
		const partial2 = tracker.stage(0.3, 'Part 2');
		const partial3 = tracker.stage(0.5, 'Part 3');

		partial1.set(100);
		expect(tracker.progress).toBeCloseTo(20);

		partial2.set(100);
		expect(tracker.progress).toBeCloseTo(50);

		partial3.set(100);
		expect(tracker.progress).toBeCloseTo(100);
	});

	describe('Subtrackers should sum to 100 total progress after completion even if the top-level tracker also has self-progress', () => {
		it('When subtrackers cover the entire progress range ', () => {
			const tracker = new ProgressTracker();
			const partial1 = tracker.stage(1 / 3, 'Part 1');
			const partial2 = tracker.stage(1 / 3, 'Part 2');
			const partial3 = tracker.stage(1 / 3, 'Part 3');

			tracker.set(100);
			partial1.set(100);
			partial2.set(100);
			partial3.set(100);
			expect(tracker.progress).toBeCloseTo(100);
		});
		it('When subtrackers only cover 2/3 of the progress range ', () => {
			const tracker = new ProgressTracker();
			const partial1 = tracker.stage(1 / 3, 'Part 1');
			const partial2 = tracker.stage(1 / 3, 'Part 2');

			tracker.set(100);
			partial1.set(100);
			partial2.set(100);
			expect(tracker.progress).toBeCloseTo(100);
		});
	});

	it('Two levels of sub-trackers should sum to 100 total progress after completion', () => {
		const tracker = new ProgressTracker();
		const level1A = tracker.stage(0.6, 'Level 1A');
		const level1B = tracker.stage(0.4, 'Level 1B');

		const level2A1 = level1A.stage(0.5, 'Level 2A1');
		const level2A2 = level1A.stage(0.5, 'Level 2A2');
		const level2B1 = level1B.stage(0.7, 'Level 2B1');
		const level2B2 = level1B.stage(0.3, 'Level 2B2');
		level2A1.set(100);
		expect(tracker.progress).toBeCloseTo(30, 2);

		level2A2.set(100);
		expect(tracker.progress).toBeCloseTo(60, 2);

		level2B1.set(100);
		expect(tracker.progress).toBeCloseTo(88, 2);

		level2B2.set(100);
		expect(tracker.progress).toBeCloseTo(100);
	});
});

describe('Events', () => {
	it('Progress event emitted when using fillSlowly', async () => {
		const tracker = new ProgressTracker();
		let eventProgress = 0;

		tracker.addEventListener('progress', (event: ProgressTrackerEvent) => {
			eventProgress = event.detail.progress;
		});

		tracker.fillSlowly();

		// Wait for 1 second
		await new Promise((resolve) => setTimeout(resolve, 1000));

		expect(eventProgress).toBeGreaterThan(0);
	});

	it('Progress event emitted when using set', () => {
		const tracker = new ProgressTracker();
		let eventProgress = 0;

		tracker.addEventListener('progress', (event: ProgressTrackerEvent) => {
			eventProgress = event.detail.progress;
		});

		tracker.set(50);

		expect(eventProgress).toBeCloseTo(50);
	});

	it('Progress event emitted when setting caption', () => {
		const tracker = new ProgressTracker();
		let eventCaption = '';

		tracker.addEventListener('progress', (event: CustomEvent) => {
			eventCaption = event.detail.caption;
		});

		tracker.setCaption('Test caption');

		expect(eventCaption).toBe('Test caption');
	});

	it('Progress event emitted for sub trackers', () => {
		const tracker = new ProgressTracker();
		const partial1 = tracker.stage(0.5, 'Part 1');
		let eventProgress = 0;

		tracker.addEventListener('progress', (event: CustomEvent) => {
			eventProgress = event.detail.progress;
		});

		partial1.set(100);

		expect(eventProgress).toBeCloseTo(50);
	});
});

describe('Caption management', () => {
	it('Should return caption of a ProgressTracker', () => {
		const tracker = new ProgressTracker({ caption: 'Initial caption' });

		expect(tracker.caption).toBe('Initial caption');
	});

	it('Should return the updated caption of a single ProgressTracker', ({
		expect,
	}) => {
		const tracker = new ProgressTracker({ caption: 'Initial caption' });
		tracker.setCaption('Updated caption');

		expect(tracker.caption).toBe('Updated caption');
	});

	it('Should return caption of the most recently started sub tracker', async ({
		expect,
	}) => {
		const tracker = new ProgressTracker();
		tracker.stage(0.5, 'Part 1');
		tracker.stage(0.5, 'Part 2');
		expect(tracker.caption).toBe('Part 2');
	});

	it('Should return caption of the most recently started sub tracker – multi-level', async ({
		expect,
	}) => {
		const tracker = new ProgressTracker();
		const partial1 = tracker.stage(0.5, 'Part 1');
		expect(tracker.caption).toBe('Part 1');

		partial1.stage(0.5, 'Part 1.a');
		expect(tracker.caption).toBe('Part 1.a');

		partial1.stage(0.5, 'Part 1.b');
		expect(tracker.caption).toBe('Part 1.b');

		const partial2 = tracker.stage(0.5, 'Part 2');
		expect(tracker.caption).toBe('Part 2');

		partial2.stage(0.5, 'Part 2.a');
		expect(tracker.caption).toBe('Part 2.a');

		partial2.stage(0.5, 'Part 2.b');
		expect(tracker.caption).toBe('Part 2.b');
	});

	it('Should return caption of the most recent incomplete sub tracker – multi-level', async ({
		expect,
	}) => {
		const tracker = new ProgressTracker();
		const partial1 = tracker.stage(0.5, 'Part 1');
		expect(tracker.caption).toBe('Part 1');

		const partial1a = partial1.stage(0.5, 'Part 1.a');
		const partial1b = partial1.stage(0.5, 'Part 1.b');
		const partial2 = tracker.stage(0.5, 'Part 2');
		const partial2a = partial2.stage(0.5, 'Part 2.a');
		const partial2b = partial2.stage(0.5, 'Part 2.b');

		partial2b.set(100);
		expect(tracker.caption).toBe('Part 2.a');

		partial2a.set(100);
		expect(partial2.done).toBe(true);
		expect(tracker.caption).toBe('Part 1.b');

		partial1a.set(100);
		expect(tracker.caption).toBe('Part 1.b');

		partial1b.set(100);
		expect(tracker.caption).toBe('');
	});

	it('Should return caption of the most recently started and not completed sub tracker', async ({
		expect,
	}) => {
		const tracker = new ProgressTracker();
		tracker.stage(0.5, 'Part 1');
		const partial2 = tracker.stage(0.5, 'Part 2');

		partial2.set(95);
		expect(tracker.caption).toBe('Part 2');

		partial2.set(100);
		expect(tracker.caption).toBe('Part 1');
	});

	it('Should return no caption when all sub trackers are completed', async ({
		expect,
	}) => {
		const tracker = new ProgressTracker();
		const partial1 = tracker.stage(0.5, 'Part 1');
		const partial2 = tracker.stage(0.5, 'Part 2');

		partial1.set(100);
		partial2.set(100);

		expect(tracker.caption).toBe('');
	});
});
