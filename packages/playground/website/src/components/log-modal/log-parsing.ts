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

/**
 * The complete stamp shape — `d-M-Y H:i:s timezone` in PHP date terms.
 * The record boundary above needs only the date part, but lifting a
 * stamp out of a record demands the full format, so that a line which
 * merely opens with something date-like keeps its brackets.
 */
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

/** $wpdb writes database errors with this head and no PHP severity marker. */
const DATABASE_HEAD = /^WordPress database error\s*/;

/**
 * Parses the logger's raw strings into PHP error log entries.
 *
 * The logger's memory buffer can be viewed as a stream of records, but
 * it arrives as an array of strings of two shapes:
 *
 *  - a single pre-formatted entry written by the JS logger, e.g.
 *    `[20-Jul-2026 14:59:46 UTC] PHP fatal: request aborted`;
 *  - a whole PHP debug.log chunk, where one string carries many
 *    records — a single WordPress database error can dump hundreds
 *    of lines.
 *
 * Each string is split into records at every newline followed by a
 * `[20-Jul-2026 …]` stamp. Lines that do not open a new record — the
 * continuation lines of a multi-line message — stay attached to the
 * record they belong to.
 *
 * Parsing preserves the record text. Beyond the whitespace separating
 * records inside a chunk, nothing is removed or rewritten: the
 * severity head (`PHP Warning:`, `WordPress database error`, …) is
 * read in place to classify the record and remains part of the
 * message. See parseLogRecord for the classification rules.
 *
 * Records produced by the Playground host itself — JavaScript errors
 * and Wasm crashes — are dropped. This module feeds a view of the
 * site's PHP error log, not a combined console.
 *
 * @param rawLogs The strings accumulated by the logger, oldest first.
 * @returns One entry per site record, in the order they were logged.
 */
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

/**
 * Parses one record into a log entry, or drops it.
 *
 * A record is classified by the head it opens with, tried in order:
 *
 *  - `PHP fatal:` style heads written by the JS logger. `PHP` records
 *    describe the site's runtime (e.g. a crashed request) and are
 *    kept; `JavaScript` and `Wasm Crash` records describe the
 *    Playground host and are dropped by returning `null`.
 *  - `WordPress database error`, written by $wpdb. Always an error.
 *  - `PHP Warning:` style heads PHP itself writes to debug.log,
 *    including the compound levels (`Fatal error`, `Recoverable
 *    fatal error`, …).
 *  - Anything else — typically bare error_log() output — is kept
 *    verbatim as an info-tier entry with no severity head.
 *
 * When the record opens with debug.log's exact stamp format, the
 * stamp is lifted into `timestamp` and removed from `message`; a
 * leading bracket of any other shape is record text and stays put.
 * That is the only edit `message` ever receives. The severity head
 * is measured into `headLength` so the UI can tint it, but it is
 * never moved or rewritten.
 *
 * @param record One record, as split out of a logger string.
 * @returns The parsed entry, or `null` for Playground-host records.
 */
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

/**
 * Maps a PHP severity level to the tier driving the filter chips and
 * the head tint.
 *
 * The level is the head text between `PHP ` and the colon, so
 * compound levels classify by their last word: `Fatal error`,
 * `Parse error`, and `Recoverable fatal error` all end in `error`,
 * and `User warning` ends in `warning`. Notices and strict-standards
 * messages fall through to `info`.
 */
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
