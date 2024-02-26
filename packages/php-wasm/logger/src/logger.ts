import { UniversalPHP } from "@php-wasm/universal/src/lib/universal-php";
/**
 * Log severity levels.
 */
export type LogSeverity = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * A logger for Playground.
 */
export class Logger {
    private readonly LOG_PREFIX = 'Playground';

    /**
     * The length of the last PHP log.
     */
    private lastPHPLogLength = 0;

    /**
     * The path to the error log file.
     */
    private errorLogPath = '/wordpress/wp-content/debug.log';

    constructor(errorLogPath?: string) {
        if (errorLogPath) {
            this.errorLogPath = errorLogPath;
        }
        this.collectJavaScriptErrors();
    }

    /**
     * Collect errors from JavaScript window events like error and log them.
     */
    private collectJavaScriptErrors() {
         if (typeof window !== 'undefined') {
            window.addEventListener('error', (event) => {
                this.log(
                    `${event.message} in ${event.filename} on line ${event.lineno}:${event.colno}`,
                    'fatal'
                );
            });
            window.addEventListener('unhandledrejection', (event) => {
                this.log(
                    `${event.reason.stack}`,
                    'fatal'
                );
            });
            window.addEventListener('rejectionhandled', (event) => {
                this.log(
                    `${event.reason.stack}`,
                    'fatal'
                );
            });
        }
    }

    /**
     * Read the WordPress debug.log file and return its content.
     *
     * @param UniversalPHP playground instance
     * @returns string The content of the debug.log file
     */
	private async getRequestPhpErrorLog(playground: UniversalPHP) {
		if (!await playground.fileExists(this.errorLogPath)) {
			return '';
		}
		return await playground.readFileAsText(this.errorLogPath);
	}
    /**
     * Register a listener for the request.end event and log the data.
     * @param UniversalPHP playground instance
     */
    public addPlaygroundRequestEndListener(playground: UniversalPHP) {
        playground.addEventListener('request.end', async () => {
            const log = await this.getRequestPhpErrorLog(playground);
            if (log.length > this.lastPHPLogLength) {
                this.logRaw(log.substring(this.lastPHPLogLength));
                this.lastPHPLogLength = log.length;
            }
        } );
    }


    /**
     * Get UTC date in the PHP log format https://github.com/php/php-src/blob/master/main/main.c#L849
     *
     * @param date
     * @returns string
     */
    private formatLogDate(date: Date): string {
        const formattedDate = new Intl.DateTimeFormat('en-GB', {
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            timeZone: 'UTC',
        }).format(date).replace(/ /g, '-');

        const formattedTime = new Intl.DateTimeFormat('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
            timeZone: 'UTC',
            timeZoneName: 'short'
        }).format(date);
        return formattedDate + ' ' + formattedTime;
    }

    /**
     * Format log message and severity and log it.
     * @param string message
     * @param LogSeverity severity
     */
    public formatMessage(message: string, severity: LogSeverity): string {
        const now = this.formatLogDate(new Date());
        return `[${now}] ${this.LOG_PREFIX} ${severity}: ${message}`;
    }

    /**
     * Log message with severity and timestamp.
     * @param string message
     * @param LogSeverity severity
     */
    public log(message: string, severity?: LogSeverity): void {
        if (severity === undefined) {
            severity = 'info';
        }
        const log = this.formatMessage(message, severity);
        this.logRaw(log);
    }

    /**
     * Log message without severity and timestamp.
     * @param string log
     */
    public logRaw(log: string): void {
        console.debug(log);
    }
};

/**
 * The logger instance.
 */
let logger: Logger | undefined = undefined;

/**
 * Get the logger instance.
 *
 * @param errorLogPath The path to the error log file.
 * @returns Logger
 */
export function getLogger(errorLogPath?: string): Logger {
    if (!logger) {
        logger = new Logger(errorLogPath);
    }
    return logger;
}
