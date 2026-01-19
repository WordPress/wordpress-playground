import type { PHP } from '@php-wasm/universal';
import { logger } from '@php-wasm/logger';

/**
 * Cleans up WordPress memory by removing expired transients,
 * clearing object cache, and removing temporary files.
 *
 * This helps reduce WASM memory footprint in long-running sessions.
 */
export async function cleanupWordPressMemory(php: PHP): Promise<void> {
	try {
		await php.run({
			code: `<?php
				// Delete expired transients to free memory
				if (function_exists('delete_expired_transients')) {
					delete_expired_transients(true);
				}

				// Clear object cache if available
				if (function_exists('wp_cache_flush')) {
					wp_cache_flush();
				}

				// Remove old temporary files (older than 1 hour)
				$tmp_dir = sys_get_temp_dir();
				if (is_dir($tmp_dir)) {
					$cutoff_time = time() - 3600; // 1 hour ago
					$files = new RecursiveIteratorIterator(
						new RecursiveDirectoryIterator($tmp_dir, RecursiveDirectoryIterator::SKIP_DOTS),
						RecursiveIteratorIterator::CHILD_FIRST
					);

					foreach ($files as $file) {
						if ($file->isFile() && $file->getMTime() < $cutoff_time) {
							@unlink($file->getPathname());
						}
					}
				}

				// Clear stat cache to free some memory
				clearstatcache(true);
			?>`,
		});

		logger.debug('WordPress memory cleanup completed');
	} catch (error) {
		logger.warn('WordPress memory cleanup failed:', error);
	}
}

/**
 * Tracks request count and triggers cleanup periodically.
 */
export class MemoryCleanupScheduler {
	private requestCount = 0;
	private readonly cleanupInterval: number;
	private lastCleanupTime = 0;
	private readonly minTimeBetweenCleanups = 10 * 60 * 1000; // 10 minutes

	constructor(cleanupInterval = 50) {
		this.cleanupInterval = cleanupInterval;
	}

	/**
	 * Call this after each request. Triggers cleanup periodically.
	 */
	async afterRequest(php: PHP): Promise<void> {
		this.requestCount++;
		const now = Date.now();

		// Cleanup every N requests OR every 10 minutes (whichever comes first)
		const shouldCleanup =
			this.requestCount >= this.cleanupInterval ||
			now - this.lastCleanupTime >= this.minTimeBetweenCleanups;

		if (shouldCleanup) {
			await cleanupWordPressMemory(php);
			this.requestCount = 0;
			this.lastCleanupTime = now;
		}
	}

	/**
	 * Force immediate cleanup regardless of schedule.
	 */
	async forceCleanup(php: PHP): Promise<void> {
		await cleanupWordPressMemory(php);
		this.requestCount = 0;
		this.lastCleanupTime = Date.now();
	}
}
