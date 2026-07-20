/**
 * The logger hands the website plain strings of two shapes: single
 * pre-formatted `[stamp] Prefix severity: message` entries, and whole
 * PHP debug.log chunks where one string carries many records (a single
 * WordPress database error can dump hundreds of lines). Parsing splits
 * chunks into records and reads each record's severity so the UI can
 * render one row per record instead of one unbounded wall of text.
 */

export type LogTier = 'error' | 'warning' | 'info';

export type LogEntry = {
	/** The unmodified record text — what copying puts on the clipboard. */
	raw: string;
	/** Full stamp, e.g. `20-Jul-2026 14:59:46 UTC`, when the record has one. */
	timestamp: string | null;
	/** The log source: PHP, WordPress, or Playground. */
	channel: string;
	/** Badge text, e.g. `Fatal error`, `Notice`, `Database error`. */
	label: string;
	tier: LogTier;
	/** Record text without the timestamp and severity head. */
	message: string;
};

/** Both PHP's debug.log and the JS logger stamp records as `[20-Jul-2026 …]`. */
const RECORD_BOUNDARY = /\n(?=\[\d{1,2}-[A-Za-z]{3}-\d{4} )/;
const TIMESTAMP_HEAD = /^\[(\d{1,2}-[A-Za-z]{3}-\d{4} [^\]]*)\]\s?/;

/** Heads written by the JS logger's formatLogEntry. */
const FORMATTED_HEAD =
	/^(PHP|JavaScript|Wasm Crash) (fatal|error|warn|log|info|debug):\s*/;
const FORMATTED_SEVERITIES: Record<string, { label: string; tier: LogTier }> = {
	fatal: { label: 'Fatal error', tier: 'error' },
	error: { label: 'Error', tier: 'error' },
	warn: { label: 'Warning', tier: 'warning' },
	log: { label: 'Log', tier: 'info' },
	info: { label: 'Info', tier: 'info' },
	debug: { label: 'Debug', tier: 'info' },
};

/**
 * Heads PHP itself writes to debug.log. The lazy word prefix covers the
 * compound levels — `Fatal error`, `Recoverable fatal error`, `User notice`,
 * `Core warning`, and the like — without listing each one.
 */
const PHP_HEAD =
	/^PHP ((?:\w+ )*?(?:error|warning|notice|deprecated|strict standards)):\s*/i;

const DATABASE_HEAD = /^WordPress database error\s*/;

export function parseLogs(rawLogs: string[]): LogEntry[] {
	return rawLogs.flatMap((rawLog) =>
		rawLog
			.split(RECORD_BOUNDARY)
			.map((record) => record.trim())
			.filter((record) => record !== '')
			.map(parseLogRecord)
	);
}

function parseLogRecord(record: string): LogEntry {
	let message = record;
	let timestamp: string | null = null;
	const stampMatch = message.match(TIMESTAMP_HEAD);
	if (stampMatch) {
		timestamp = stampMatch[1];
		message = message.slice(stampMatch[0].length);
	}

	const formattedMatch = message.match(FORMATTED_HEAD);
	if (formattedMatch) {
		const severity = FORMATTED_SEVERITIES[formattedMatch[2]];
		const isWasmCrash = formattedMatch[1] === 'Wasm Crash';
		return {
			raw: record,
			timestamp,
			channel: formattedMatch[1] === 'PHP' ? 'PHP' : 'Playground',
			label: isWasmCrash ? 'Crash' : severity.label,
			tier: isWasmCrash ? 'error' : severity.tier,
			message: message.slice(formattedMatch[0].length),
		};
	}

	const databaseMatch = message.match(DATABASE_HEAD);
	if (databaseMatch) {
		return {
			raw: record,
			timestamp,
			channel: 'WordPress',
			label: 'Database error',
			tier: 'error',
			message: message.slice(databaseMatch[0].length),
		};
	}

	const phpMatch = message.match(PHP_HEAD);
	if (phpMatch) {
		return {
			raw: record,
			timestamp,
			channel: 'PHP',
			label: phpMatch[1],
			tier: phpTier(phpMatch[1]),
			message: message.slice(phpMatch[0].length),
		};
	}

	// error_log() lines from WordPress core or plugins carry no severity head.
	return {
		raw: record,
		timestamp,
		channel: 'WordPress',
		label: 'Log',
		tier: 'info',
		message,
	};
}

function phpTier(label: string): LogTier {
	const level = label.toLowerCase();
	if (level.endsWith('error')) {
		return 'error';
	}
	if (level.endsWith('warning') || level.endsWith('deprecated')) {
		return 'warning';
	}
	return 'info';
}
