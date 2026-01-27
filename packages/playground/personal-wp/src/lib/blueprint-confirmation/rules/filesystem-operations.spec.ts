import { describe, it, expect } from 'vitest';
import { filesystemOperationsRule } from './filesystem-operations';
import type { RuleContext } from '../types';

const createContext = (steps: unknown[]): RuleContext => ({
	blueprint: { steps },
	source: { type: 'remote-url', url: 'https://example.com/bp.json' },
});

describe('filesystemOperationsRule', () => {
	describe('writeFile', () => {
		it('returns info severity for normal paths without dangerous content', () => {
			const context = createContext([
				{
					step: 'writeFile',
					path: '/wp-content/test.txt',
					data: 'content',
				},
			]);

			const warnings = filesystemOperationsRule.analyze(context);

			expect(warnings).toHaveLength(1);
			expect(warnings[0].severity).toBe('info');
			expect(warnings[0].title).toBe('Write file');
		});

		it('returns danger severity for wp-config.php', () => {
			const context = createContext([
				{ step: 'writeFile', path: '/wp-config.php', data: 'content' },
			]);

			const warnings = filesystemOperationsRule.analyze(context);

			expect(warnings[0].severity).toBe('danger');
			expect(warnings[0].title).toBe('Write to sensitive location');
		});

		it('returns danger severity for wp-includes paths', () => {
			const context = createContext([
				{
					step: 'writeFile',
					path: '/wp-includes/malicious.php',
					data: 'content',
				},
			]);

			const warnings = filesystemOperationsRule.analyze(context);

			expect(warnings[0].severity).toBe('danger');
		});

		it('returns danger severity for wp-admin paths', () => {
			const context = createContext([
				{
					step: 'writeFile',
					path: '/wp-admin/custom.php',
					data: 'content',
				},
			]);

			const warnings = filesystemOperationsRule.analyze(context);

			expect(warnings[0].severity).toBe('danger');
		});

		it('returns danger severity for .htaccess', () => {
			const context = createContext([
				{ step: 'writeFile', path: '/.htaccess', data: 'content' },
			]);

			const warnings = filesystemOperationsRule.analyze(context);

			expect(warnings[0].severity).toBe('danger');
		});

		it('returns danger severity for db.php drop-in', () => {
			const context = createContext([
				{
					step: 'writeFile',
					path: '/wp-content/db.php',
					data: 'content',
				},
			]);

			const warnings = filesystemOperationsRule.analyze(context);

			expect(warnings[0].severity).toBe('danger');
		});
	});

	describe('rm (delete file)', () => {
		it('returns warning severity for normal paths', () => {
			const context = createContext([
				{ step: 'rm', path: '/wp-content/uploads/image.jpg' },
			]);

			const warnings = filesystemOperationsRule.analyze(context);

			expect(warnings).toHaveLength(1);
			expect(warnings[0].severity).toBe('warning');
			expect(warnings[0].title).toBe('Delete file');
		});

		it('returns danger severity for sensitive paths', () => {
			const context = createContext([
				{ step: 'rm', path: '/wp-config.php' },
			]);

			const warnings = filesystemOperationsRule.analyze(context);

			expect(warnings[0].severity).toBe('danger');
			expect(warnings[0].title).toBe('Delete sensitive file');
		});
	});

	describe('rmdir (delete directory)', () => {
		it('returns warning severity for normal paths', () => {
			const context = createContext([
				{ step: 'rmdir', path: '/wp-content/uploads/2024' },
			]);

			const warnings = filesystemOperationsRule.analyze(context);

			expect(warnings[0].severity).toBe('warning');
			expect(warnings[0].title).toBe('Delete directory');
		});

		it('returns danger severity for wp-includes', () => {
			const context = createContext([
				{ step: 'rmdir', path: '/wp-includes/' },
			]);

			const warnings = filesystemOperationsRule.analyze(context);

			expect(warnings[0].severity).toBe('danger');
			expect(warnings[0].title).toBe('Delete sensitive directory');
		});
	});

	describe('mkdir', () => {
		it('returns info severity for mkdir (always safe)', () => {
			const context = createContext([
				{ step: 'mkdir', path: '/wp-content/custom-folder' },
			]);

			const warnings = filesystemOperationsRule.analyze(context);

			expect(warnings[0].severity).toBe('info');
			expect(warnings[0].title).toBe('Create directory');
		});
	});

	describe('mv (move)', () => {
		it('returns warning severity for normal paths', () => {
			const context = createContext([
				{
					step: 'mv',
					fromPath: '/wp-content/old.txt',
					toPath: '/wp-content/new.txt',
				},
			]);

			const warnings = filesystemOperationsRule.analyze(context);

			expect(warnings[0].severity).toBe('warning');
			expect(warnings[0].title).toBe('Move file');
		});

		it('returns danger severity when moving to sensitive path', () => {
			const context = createContext([
				{
					step: 'mv',
					fromPath: '/tmp/malicious.php',
					toPath: '/wp-includes/hack.php',
				},
			]);

			const warnings = filesystemOperationsRule.analyze(context);

			expect(warnings[0].severity).toBe('danger');
			expect(warnings[0].title).toBe('Move sensitive file');
		});

		it('returns danger severity when moving from sensitive path', () => {
			const context = createContext([
				{
					step: 'mv',
					fromPath: '/wp-config.php',
					toPath: '/tmp/backup.php',
				},
			]);

			const warnings = filesystemOperationsRule.analyze(context);

			expect(warnings[0].severity).toBe('danger');
		});
	});

	describe('cp (copy)', () => {
		it('returns info severity for normal paths', () => {
			const context = createContext([
				{
					step: 'cp',
					fromPath: '/wp-content/file.txt',
					toPath: '/wp-content/backup.txt',
				},
			]);

			const warnings = filesystemOperationsRule.analyze(context);

			expect(warnings[0].severity).toBe('info');
			expect(warnings[0].title).toBe('Copy file');
		});

		it('returns danger severity when copying to sensitive path', () => {
			const context = createContext([
				{
					step: 'cp',
					fromPath: '/tmp/evil.php',
					toPath: '/wp-includes/evil.php',
				},
			]);

			const warnings = filesystemOperationsRule.analyze(context);

			expect(warnings[0].severity).toBe('danger');
			expect(warnings[0].title).toBe('Copy to sensitive location');
		});
	});

	describe('path normalization', () => {
		it('handles paths without leading slash', () => {
			const context = createContext([
				{ step: 'writeFile', path: 'wp-config.php', data: 'content' },
			]);

			const warnings = filesystemOperationsRule.analyze(context);

			expect(warnings[0].severity).toBe('danger');
		});
	});

	describe('multiple operations', () => {
		it('returns warnings for all filesystem steps', () => {
			const context = createContext([
				{ step: 'writeFile', path: '/test.txt', data: 'x' },
				{ step: 'rm', path: '/old.txt' },
				{ step: 'mkdir', path: '/new-folder' },
			]);

			const warnings = filesystemOperationsRule.analyze(context);

			expect(warnings).toHaveLength(3);
		});
	});

	describe('edge cases', () => {
		it('ignores non-filesystem steps', () => {
			const context = createContext([
				{ step: 'login' },
				{ step: 'runPHP', code: '<?php echo 1;' },
			]);

			const warnings = filesystemOperationsRule.analyze(context);

			expect(warnings).toHaveLength(0);
		});

		it('handles missing path property', () => {
			const context = createContext([
				{ step: 'writeFile', data: 'content' },
			]);

			const warnings = filesystemOperationsRule.analyze(context);

			expect(warnings).toHaveLength(1);
			expect(warnings[0].description).toContain('Writes to:');
		});

		it('handles null steps', () => {
			const context = createContext([
				null,
				{ step: 'writeFile', path: '/test.txt', data: 'x' },
			]);

			const warnings = filesystemOperationsRule.analyze(context);

			expect(warnings).toHaveLength(1);
		});

		it('handles empty steps array', () => {
			const context = createContext([]);

			const warnings = filesystemOperationsRule.analyze(context);

			expect(warnings).toHaveLength(0);
		});
	});
});
