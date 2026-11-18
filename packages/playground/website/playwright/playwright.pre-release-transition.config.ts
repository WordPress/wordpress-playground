import { defineConfig } from '@playwright/test';
import wordpressFrame from './playwright.wordpress-frame.config';

// This opt-in rehearsal requires the pinned historical deployment artifact.
export default defineConfig({
	...wordpressFrame,
	testMatch: ['deployment-transition/*.spec.ts'],
	workers: 1,
	fullyParallel: false,
	retries: 0,
});
