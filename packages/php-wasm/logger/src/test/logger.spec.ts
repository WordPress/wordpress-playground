import { type Log, logger, LogSeverity } from '../lib/logger';
import { clearMemoryLogs, type LogHandler } from '../lib/log-handlers';

describe('Logger', () => {
	let output: string[];
	let handlers: LogHandler[];

	function logToVariable(log: Log, arg?: string) {
		output.push(`${log.message}${arg ? arg : ''}`);
	}

	beforeAll(() => {
		// @ts-ignore
		handlers = logger.handlers;
	});

	beforeEach(() => {
		output = [];
		// @ts-ignore
		logger.handlers = [...handlers, logToVariable];

		clearMemoryLogs();
	});

	it('adds message in logs', () => {
		logger.warn('test');
		const logs = logger.getLogs();
		expect(logs.length).toBe(1);
		expect(logs[0]).toMatch(
			/\[\d{2}-[A-Za-z]{3,4}-\d{4} \d{2}:\d{2}:\d{2} UTC\] JavaScript warn: test/
		);
	});

	it('dispatches log event', () => {
		const eventListener = vitest.fn();
		logger.addEventListener('playground-log', eventListener);
		logger.warn('test');
		expect(eventListener).toHaveBeenCalled();
	});

	it('outputs main logs by default', () => {
		logger.log('log');
		logger.info('info');
		logger.warn('warn');
		logger.error('error');
		logger.debug('debug');
		const logs = logger.getLogs();
		expect(logs.length).toBe(4);
		expect(output).toEqual(['log', 'info', 'warn', 'error']);
	});

	it('outputs main logs when verbosity is set to normal', () => {
		logger.setSeverityFilterLevel(LogSeverity.Info);
		logger.log('log');
		logger.info('info');
		logger.warn('warn');
		logger.error('error');
		logger.debug('debug');
		const logs = logger.getLogs();
		expect(logs.length).toBe(4);
		expect(output).toEqual(['log', 'info', 'warn', 'error']);
	});

	it('outputs main and debug logs when verbosity is set to debug', () => {
		logger.setSeverityFilterLevel(LogSeverity.Debug);
		logger.log('log');
		logger.info('info');
		logger.warn('warn');
		logger.error('error');
		logger.debug('debug');
		const logs = logger.getLogs();
		expect(logs.length).toBe(5);
		expect(output).toEqual(['log', 'info', 'warn', 'error', 'debug']);
	});

	it('does not output logs when verbosity is set to quiet', () => {
		logger.setSeverityFilterLevel(LogSeverity.Fatal);
		logger.log('log');
		logger.info('info');
		logger.warn('warn');
		logger.error('error');
		logger.debug('debug');
		const logs = logger.getLogs();
		expect(logs.length).toBe(0);
		expect(output).toEqual([]);
	});

	it('supports logMessage() without explicit severity', () => {
		logger.setSeverityFilterLevel(LogSeverity.Info);
		logger.logMessage({ message: 'test' });
		const logs = logger.getLogs();
		expect(logs.length).toBe(1);
		expect(logs[0]).toMatch(
			/\[\d{2}-[A-Za-z]{3,4}-\d{4} \d{2}:\d{2}:\d{2} UTC\] JavaScript log: test/
		);
	});
});
