import { describe, it, expect } from 'vitest';
import {
	BREAKPOINTS,
	isMobile,
	isTablet,
	isDesktop,
	isSmallerScreen,
	getDeviceType,
} from './breakpoints';

describe('Breakpoints', () => {
	describe('BREAKPOINTS constants', () => {
		it('should define mobile breakpoint at 600px', () => {
			expect(BREAKPOINTS.mobile).toBe(600);
		});

		it('should define tablet breakpoint at 875px', () => {
			expect(BREAKPOINTS.tablet).toBe(875);
		});

		it('should define desktop breakpoint at 1024px', () => {
			expect(BREAKPOINTS.desktop).toBe(1024);
		});
	});

	describe('isMobile()', () => {
		it('should return true when width is less than mobile breakpoint', () => {
			expect(isMobile(599)).toBe(true);
			expect(isMobile(500)).toBe(true);
			expect(isMobile(0)).toBe(true);
		});

		it('should return false when width is at or above mobile breakpoint', () => {
			expect(isMobile(600)).toBe(false);
			expect(isMobile(875)).toBe(false);
			expect(isMobile(1024)).toBe(false);
		});

		it('should use window.innerWidth when no width is provided', () => {
			// Only test in browser environment
			if (typeof window !== 'undefined') {
				expect(typeof isMobile()).toBe('boolean');
			}
		});
	});

	describe('isTablet()', () => {
		it('should return true when width is in tablet range', () => {
			expect(isTablet(600)).toBe(true);
			expect(isTablet(700)).toBe(true);
			expect(isTablet(874)).toBe(true);
		});

		it('should return false when width is outside tablet range', () => {
			expect(isTablet(599)).toBe(false);
			expect(isTablet(875)).toBe(false);
			expect(isTablet(1024)).toBe(false);
		});
	});

	describe('isSmallerScreen()', () => {
		it('should return true when width is less than tablet breakpoint', () => {
			expect(isSmallerScreen(0)).toBe(true);
			expect(isSmallerScreen(600)).toBe(true);
			expect(isSmallerScreen(874)).toBe(true);
		});

		it('should return false when width is at or above tablet breakpoint', () => {
			expect(isSmallerScreen(875)).toBe(false);
			expect(isSmallerScreen(1024)).toBe(false);
			expect(isSmallerScreen(1920)).toBe(false);
		});

		it('should include both mobile and tablet sizes', () => {
			// Mobile sizes
			expect(isSmallerScreen(300)).toBe(true);
			expect(isSmallerScreen(599)).toBe(true);
			// Tablet sizes
			expect(isSmallerScreen(600)).toBe(true);
			expect(isSmallerScreen(700)).toBe(true);
			expect(isSmallerScreen(874)).toBe(true);
		});
	});

	describe('isDesktop()', () => {
		it('should return true when width is at or above desktop breakpoint', () => {
			expect(isDesktop(1024)).toBe(true);
			expect(isDesktop(1920)).toBe(true);
		});

		it('should return false when width is below desktop breakpoint', () => {
			expect(isDesktop(599)).toBe(false);
			expect(isDesktop(874)).toBe(false);
			expect(isDesktop(1023)).toBe(false);
		});
	});

	describe('getDeviceType()', () => {
		it('should return "mobile" for widths less than 600px', () => {
			expect(getDeviceType(0)).toBe('mobile');
			expect(getDeviceType(500)).toBe('mobile');
			expect(getDeviceType(599)).toBe('mobile');
		});

		it('should return "tablet" for widths between 600px and 875px', () => {
			expect(getDeviceType(600)).toBe('tablet');
			expect(getDeviceType(700)).toBe('tablet');
			expect(getDeviceType(874)).toBe('tablet');
		});

		it('should return "desktop" for widths 875px and above', () => {
			expect(getDeviceType(875)).toBe('desktop');
			expect(getDeviceType(1024)).toBe('desktop');
			expect(getDeviceType(1920)).toBe('desktop');
		});
	});

	describe('Breakpoint boundaries', () => {
		it('should correctly handle edge cases at 600px', () => {
			expect(isMobile(599)).toBe(true);
			expect(isMobile(600)).toBe(false);
			expect(isTablet(600)).toBe(true);
		});

		it('should correctly handle edge cases at 875px', () => {
			expect(isTablet(874)).toBe(true);
			expect(isTablet(875)).toBe(false);
			expect(isDesktop(875)).toBe(false);
		});

		it('should correctly handle edge cases at 1024px', () => {
			expect(isDesktop(1023)).toBe(false);
			expect(isDesktop(1024)).toBe(true);
		});
	});
});
