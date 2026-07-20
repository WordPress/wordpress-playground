/**
 * The logger hands the website plain strings of two shapes: single
 * pre-formatted `[stamp] Prefix severity: message` entries, and whole
 * PHP debug.log chunks where one string carries many records (a single
 * WordPress database error can dump hundreds of lines). Parsing splits
 * chunks into records, lifts the leading timestamp when it matches
 * debug.log's exact stamp format, and reads each record's severity head
 * — which stays in the text — to classify the record. Records from the
 * Playground host (JavaScript, Wasm crashes) are dropped: this feeds a
 * PHP error log view.
 */

export type LogTier = 'error' | 'warning' | 'info';

export type LogEntry = {
	/**
	 * The record text as logged, trimmed of surrounding whitespace —
	 * what copying puts on the clipboard.
	 */
	raw: string;
	/**
	 * The lifted stamp, e.g. `20-Jul-2026 14:59:46 UTC`, when the record
	 * starts with debug.log's exact format. Displayed above the message.
	 */
	timestamp: string | null;
	/**
	 * The record with the lifted stamp removed and nothing else — the
	 * `PHP Notice:` style severity head stays in place.
	 */
	message: string;
	/**
	 * Length of the severity head at the start of `message` (0 when the
	 * record has none). The panel tints exactly that substring.
	 */
	headLength: number;
	tier: LogTier;
};

/** Both PHP's debug.log and the JS logger stamp records as `[20-Jul-2026 …]`. */
const RECORD_BOUNDARY = /\n(?=\[\d{1,2}-[A-Za-z]{3}-\d{4} )/;
const TIMESTAMP_HEAD =
	/^\[(\d{1,2}-[A-Za-z]{3}-\d{4} \d{2}:\d{2}:\d{2} [^\]]+)\]\s?/;

/** Heads written by the JS logger's formatLogEntry. */
const FORMATTED_HEAD =
	/^(PHP|JavaScript|Wasm Crash) (fatal|error|warn|log|info|debug):\s*/;
const FORMATTED_TIERS: Record<string, LogTier> = {
	fatal: 'error',
	error: 'error',
	warn: 'warning',
	log: 'info',
	info: 'info',
	debug: 'info',
};

/**
 * Heads PHP itself writes to debug.log. The lazy word prefix covers the
 * compound levels — `Fatal error`, `Recoverable fatal error`, and the
 * like — without listing each one.
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
			.filter((entry): entry is LogEntry => entry !== null)
	);
}

function parseLogRecord(record: string): LogEntry | null {
	let message = record;
	let timestamp: string | null = null;
	const stampMatch = message.match(TIMESTAMP_HEAD);
	if (stampMatch) {
		timestamp = stampMatch[1];
		message = message.slice(stampMatch[0].length);
	}

	const formattedMatch = message.match(FORMATTED_HEAD);
	if (formattedMatch) {
		// JavaScript and Wasm Crash records come from the Playground host,
		// not from the site's PHP runtime.
		if (formattedMatch[1] !== 'PHP') {
			return null;
		}
		return {
			raw: record,
			timestamp,
			message,
			headLength: formattedMatch[0].trimEnd().length,
			tier: FORMATTED_TIERS[formattedMatch[2]],
		};
	}

	const databaseMatch = message.match(DATABASE_HEAD);
	if (databaseMatch) {
		return {
			raw: record,
			timestamp,
			message,
			headLength: databaseMatch[0].trimEnd().length,
			tier: 'error',
		};
	}

	const phpMatch = message.match(PHP_HEAD);
	if (phpMatch) {
		return {
			raw: record,
			timestamp,
			message,
			headLength: phpMatch[0].trimEnd().length,
			tier: phpTier(phpMatch[1]),
		};
	}

	// error_log() output carries no severity head, only the debug.log stamp.
	return {
		raw: record,
		timestamp,
		message,
		headLength: 0,
		tier: 'info',
	};
}

function phpTier(level: string): LogTier {
	const normalized = level.toLowerCase();
	if (normalized.endsWith('error')) {
		return 'error';
	}
	if (normalized.endsWith('warning') || normalized.endsWith('deprecated')) {
		return 'warning';
	}
	return 'info';
}
