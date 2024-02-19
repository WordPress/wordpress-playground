export enum LogSeverity {
    // A debugging event.
    Debug,
    // An informational event. Indicates that an event happenedate.
    Info,
    // A warning event. Not an error but is likely more important than an informational event.
    Warn,
    // An error event. Something went wrong.
    Error,
    // A fatal error such as application or system crash.
    Fatal,
}

export class Logger {
    private readonly LOG_PREFIX = 'Playground';

    constructor() {
        this.collectPlaygroundLogs();
    }

    /**
     * Collect errors from Playground and log them.
     */
    private collectPlaygroundLogs() {
         if (typeof window !== 'undefined') {
            window.addEventListener('error', (event) => {
                this.log(
                    `${event.message} in ${event.filename} on line ${event.lineno}:${event.colno}`,
                    LogSeverity.Fatal
                );
            });
            window.addEventListener('unhandledrejection', (event) => {
                this.log(
                    `${event.reason.stack}`,
                    LogSeverity.Fatal
                );
            });
        }
    }

    /**
     * Get UTC date in the PHP log format https://github.com/php/php-src/blob/master/main/main.c#L849
     *
     * @param date
     * @returns string
     */
    private formatLogDate(date: Date): string {
        const day = String(date.getUTCDate()).padStart(2, '0');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = monthNames[date.getUTCMonth()];
        const year = date.getUTCFullYear();
        const hours = String(date.getUTCHours()).padStart(2, '0');
        const minutes = String(date.getUTCMinutes()).padStart(2, '0');
        const seconds = String(date.getUTCSeconds()).padStart(2, '0');

        return `${day}-${month}-${year} ${hours}:${minutes}:${seconds} UTC`;
    }

    /**
     * Format log message and severity and log it.
     * @param string message
     * @param LogSeverity severity
     */
    public formatLog(message: string, severity: LogSeverity): string {
        const now = this.formatLogDate(new Date());
        return `[${now}] ${this.LOG_PREFIX} ${LogSeverity[severity]}: ${message}`;
    }

    /**
     * Log message with severity and timestamp.
     * @param string message
     * @param LogSeverity severity
     */
    public log(message: string, severity?: LogSeverity): void {
        if (severity === undefined) {
            severity = LogSeverity.Info;
        }
        const log = this.formatLog(message, severity);
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
 * @returns Logger
 */
export function get_logger(): Logger {
    if (!logger) {
        logger = new Logger();
    }
    return logger;
}