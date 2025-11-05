/**
 * PHP WebAssembly SAPI module.
 *
 * This file abstracts the entire PHP API with the minimal set
 * of functions required to run PHP code from JavaScript.
 */
#include <main/php.h>
#include <main/SAPI.h>
#include <main/php_main.h>
#include <main/php_variables.h>
#include <main/php_ini.h>
#include <main/php_streams.h>
#include <zend_ini.h>
#include "ext/standard/php_standard.h"
#include <emscripten.h>
#include <stdlib.h>
#include <stdio.h>
#include <fcntl.h>
#include <unistd.h>

#include "zend_globals_macros.h"
#include "zend_exceptions.h"
#include "zend_closures.h"
#include "zend_hash.h"
#include "rfc1867.h"
#include "SAPI.h"
#include "proc_open.h"

// Created by Dockerfile:
#include "php_wasm_asyncify.h"

unsigned int wasm_sleep(unsigned int time)
{
	emscripten_sleep(time * 1000); // emscripten_sleep takes time in milliseconds
	return time;
}

/**
 * Shims usleep(3) functionallity.
 */
EMSCRIPTEN_KEEPALIVE unsigned int __wrap_usleep(unsigned int time_microseconds)
{
	// We don't have access to microsecond granularity in JavaScript so let's
	// settle for milliseconds.
	int time_milliseconds = time_microseconds / 1000;
	emscripten_sleep(time_milliseconds);
	return time_microseconds;
}

extern int *wasm_setsockopt(int sockfd, int level, int optname, intptr_t optval, size_t optlen, int dummy);

static int redirect_stream_to_file(FILE *stream, char *file_path);
static void restore_stream_handler(FILE *original_stream, int replacement_stream);

/**
 * Shims popen(3) functionallity:
 * https://man7.org/linux/man-pages/man3/popen.3.html
 *
 * Uses the same PHPWASM.spawnProcess callback as js_open_process,
 * but waits for the process to exit and returns a path to a file
 * with all the output bufferred.
 *
 * @TODO: get rid of this function and only rely on js_open_process
 * instead.
 *
 * @param {int} command Command to execute
 * @param {int} mode Mode to open the command in
 * @param {int} exitCodePtr Pointer to the exit code
 * @returns {int} File descriptor of the command output
 */
#ifdef PLAYGROUND_JSPI
EM_ASYNC_JS(char*, js_popen_to_file, (const char *command, const char *mode, uint8_t *exitCodePtr), {
	const returnCallback = (resolver) => new Promise(resolver);
#else
EM_JS(char*, js_popen_to_file, (const char *command, const char *mode, uint8_t *exitCodePtr), {
	const returnCallback = (resolver) => Asyncify.handleSleep(resolver);
#endif
	// Parse args
	if (!command)
		return 1; // shell is available

	const cmdstr = UTF8ToString(command);
	if (!cmdstr.length)
		return 0; // this is what glibc seems to do (shell works test?)

	const modestr = UTF8ToString(mode);
	if (!modestr.length)
		return 0; // this is what glibc seems to do (shell works test?)
	if (modestr === 'w')
	{
		console.error('popen($cmd, "w") is not implemented yet');
	}

	return returnCallback(async (wakeUp) => {
		let cp;
		try {
			cp = PHPWASM.spawnProcess(cmdstr, []);
			if (cp instanceof Promise) {
				cp = await cp;
			}
		} catch (e) {
			console.error(e);
			if (e.code === 'SPAWN_UNSUPPORTED') {
				return 1;
			}
			throw e;
		}

		const outByteArrays = [];
		cp.stdout.on('data', function (data) {
			outByteArrays.push(data);
		});

		const outputPath = '/tmp/popen_output';
		cp.on('exit', function (exitCode) {
			// Concat outByteArrays, an array of UInt8Arrays
			// into a single Uint8Array.
			const outBytes = new Uint8Array(
				outByteArrays.reduce((acc, curr) => acc + curr.length, 0)
			);
			let offset = 0;
			for (const byteArray of outByteArrays) {
				outBytes.set(byteArray, offset);
				offset += byteArray.length;
			}

			FS.writeFile(outputPath, outBytes);

			HEAPU8[exitCodePtr] = exitCode;
			wakeUp(allocateUTF8OnStack(outputPath)); // 2 is SIGINT
		});
	});
});


/**
 * Shims poll(2) functionallity for asynchronous websockets:
 * https://man7.org/linux/man-pages/man2/poll.2.html
 *
 * The semantics don't line up exactly with poll(2) but
 * the intent does. This function is called in php_pollfd_for()
 * to await a websocket-related event.
 *
 * @param {int} socketd The socket descriptor
 * @param {int} events  The events to wait for
 * @param {int} timeout The timeout in milliseconds
 * @returns {int} 1 if any event was triggered, 0 if the timeout expired
 */
#ifdef PLAYGROUND_JSPI
EM_ASYNC_JS(int, wasm_poll_socket, (php_socket_t socketd, int events, int timeout), {
	const returnCallback = (resolver) => new Promise(resolver);
#else
EM_JS(int, wasm_poll_socket, (php_socket_t socketd, int events, int timeout), {
	const returnCallback = (resolver) => Asyncify.handleSleep(resolver);
#endif
    const POLLIN = 0x0001; /* There is data to read */
    const POLLPRI = 0x0002; /* There is urgent data to read */
    const POLLOUT = 0x0004; /* Writing now will not block */
    const POLLERR = 0x0008; /* Error condition */
    const POLLHUP = 0x0010; /* Hung up */
    const POLLNVAL = 0x0020; /* Invalid request: fd not open */

    return returnCallback((wakeUp) => {
        const polls = [];
        /**
		 * Special semantics for polling sockets.
		 *
		 * @TODO: Remove this code branch entirely and poll sockets using the second if/else
		 *        branch below. The only reason this wasn't done yet is that the original PR
		 *        was focusing on removing child process-related special casing and did not
		 *        want to increase the risk of breaking other code, especially around listening
		 *        network sockets.
         */
		const stream = FS.getStream(socketd);
        if (FS.isSocket(stream?.node.mode)) {
            // This is, most likely, a websocket. Let's make sure.
            const sock = getSocketFromFD(socketd);
            if (!sock) {
                wakeUp(0);
                return;
            }
            const lookingFor = new Set();

            if (events & POLLIN || events & POLLPRI) {
                if (sock.server) {
                    for (const client of sock.pending) {
                        if ((client.recv_queue || []).length > 0) {
                            wakeUp(1);
                            return;
                        }
                    }
                } else if ((sock.recv_queue || []).length > 0) {
                    wakeUp(1);
                    return;
                }
            }

            const webSockets = PHPWASM.getAllWebSockets(sock);
            if (!webSockets.length) {
                wakeUp(0);
                return;
            }
            for (const ws of webSockets) {
				if (events & POLLIN || events & POLLPRI) {
					polls.push(PHPWASM.awaitData(ws));
					lookingFor.add('POLLIN');
				}
				if (events & POLLOUT) {
					polls.push(PHPWASM.awaitConnection(ws));
					lookingFor.add('POLLOUT');
				}
				// Notify the user the socket is now closed even if the only requested
				// in or out events.
				if (
					events & POLLHUP ||
					events & POLLIN ||
					events & POLLOUT ||
					events & POLLERR
				) {
					polls.push(PHPWASM.awaitClose(ws));
					lookingFor.add('POLLHUP');
				}
				if (events & POLLERR || events & POLLNVAL) {
					polls.push(PHPWASM.awaitError(ws));
					lookingFor.add('POLLERR');
				}
            }
		} else if (stream?.stream_ops?.poll) {
			// Poll the stream for data.
			// @TODO: Consider reusing the polling implementation in js_fd_read().
			let interrupted = false;
			async function poll() {
				try {
					// Inlined ___syscall_poll with added await support:
					while (true) {
						var mask = POLLNVAL;
						mask = SYSCALLS.DEFAULT_POLLMASK;
						if (FS.isClosed(stream)) {
							return ERRNO_CODES.EBADF;
						}
						if (stream.stream_ops?.poll) {
							mask = stream.stream_ops.poll(stream, -1);
						}

						mask &= events | POLLERR | POLLHUP;
						if (mask) {
							return mask;
						}
						if (interrupted) {
							return ERRNO_CODES.ETIMEDOUT;
						}
						await new Promise(resolve => setTimeout(resolve, 10));
					}
				} catch (e) {
					if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e;
					return -e.errno;
				}
			}
			polls.push([
				poll(),
				() => {
					interrupted = true;
				}
			]);
        } else {
			setTimeout(function () {
				wakeUp(1);
			}, timeout);
			return;
        }
        if (polls.length === 0) {
            console.warn(
                'Unsupported poll event ' +
                    events +
                    ', defaulting to setTimeout().'
            );
            setTimeout(function () {
                wakeUp(0);
            }, timeout);
            return;
        }

        const promises = polls.map(([promise]) => promise);
        const clearPolling = () => polls.forEach(([, clear]) => clear());
        let awaken = false;
        let timeoutId;
        Promise.race(promises).then(function (results) {
            if (!awaken) {
                awaken = true;
                wakeUp(1);
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }
                clearPolling();
            }
        });

        if (timeout !== -1) {
            timeoutId = setTimeout(function () {
                if (!awaken) {
                    awaken = true;
                    wakeUp(0);
                    clearPolling();
                }
            }, timeout);
        }
    });
});

/**
 * Shims read(2) functionallity.
 * Enables reading from blocking pipes. By default, Emscripten
 * will throw an EWOULDBLOCK error when trying to read from a
 * blocking pipe. This function overrides that behavior and
 * instead waits for the pipe to become readable.
 *
 * @see https://github.com/WordPress/wordpress-playground/issues/951
 * @see https://github.com/emscripten-core/emscripten/issues/13214
 */
EM_JS(__wasi_errno_t, js_fd_read, (__wasi_fd_t fd, const __wasi_iovec_t *iov, size_t iovcnt, __wasi_size_t *pnum), {
#ifdef PLAYGROUND_JSPI
	const returnCallback = (resolver) => new Promise(resolver);
#else
	const returnCallback = (resolver) => Asyncify.handleSleep(resolver);
#endif
	const pollAsync = arguments[4] === undefined ? true : !!arguments[4];
	if (Asyncify?.State?.Normal === undefined || Asyncify?.state === Asyncify?.State?.Normal) {
		var stream;
		try
		{
			stream = SYSCALLS.getStreamFromFD(fd);
			// How many bytes did we read?
			HEAPU32[pnum >> 2] = doReadv(stream, iov, iovcnt);
			return 0;
		}
		catch (e)
		{
			// Rethrow any unexpected non-filesystem errors.
			if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
			{
				throw e;
			}

			// Propagate all errors except ones indicating that the stream is waiting for
			// more data.
			if (e.errno !== ERRNO_CODES.EWOULDBLOCK && e.errno !== ERRNO_CODES.EAGAIN) {
				return e.errno;
			}

			// If the stream is non-blocking, we can return immediately.
			const nonBlocking = stream.flags & PHPWASM.O_NONBLOCK;
			if (nonBlocking) {
				return e.errno;
			}

			// Otherwise, fallthrough to polling.
		}
	}

	// Allow the caller to disable polling.
	// @TODO: Check if we should even poll here, or is it up to the caller to decide
	//        and call poll() on their own.
	if (false === pollAsync) {
		return ERRNO_CODES.EWOULDBLOCK;
	}

    // At this point we're certain we need to poll.
	//
    // You might wonder why we duplicate the code here instead of just reusing
    // Asyncify.handleSleep(). The reason is performance. Most of the time,
    // the read operation will work synchronously and won't require yielding
    // back to JS. In these cases we don't want to pay the Asyncify overhead,
    // save the stack, yield back to JS, restore the stack etc.
    return returnCallback(async (wakeUp) => {
        var retries = 0;
        var interval = 50;
        var timeout = 5000;
        // We poll for data and give up after a timeout.
        // We can't simply rely on PHP timeout here because we don't want
        // to, say, block the entire PHPUnit test suite without any visible
        // feedback.
        var maxRetries = timeout / interval;
        while(true) {
            var returnCode;
            var stream;
            let num;
            try {
                stream = SYSCALLS.getStreamFromFD(fd);
                num = doReadv(stream, iov, iovcnt);
                returnCode = 0;
            } catch (e) {
                if (
                    typeof FS == 'undefined' ||
                    !(e.name === 'ErrnoError')
                ) {
                    console.error(e);
                    throw e;
                }
                returnCode = e.errno;
            }

            // read succeeded!
            if (returnCode === 0) {
                HEAPU32[pnum >> 2] = num;
                return wakeUp(0);
            }

            if (
                // Too many retries? That's an error, too!
                ++retries > maxRetries ||
                // Stream closed? That's an error.
                !stream || FS.isClosed(stream) ||
                // Error different than EWOULDBLOCK – propagate it to the caller.
                returnCode !== ERRNO_CODES.EWOULDBLOCK ||
                // Broken pipe
                ('pipe' in stream.node && stream.node.pipe.refcnt < 2)
            ) {
                HEAPU32[pnum >> 2] = num;
                return wakeUp(returnCode);
            }

            // It's a blocking stream and we Blocking stream with no data available yet.
            // Let's poll up to a timeout.
            await new Promise(resolve => setTimeout(resolve, interval));
        }
    })
});
extern int __wasi_syscall_ret(__wasi_errno_t code);

// Exit code of the last exited child process call.
int wasm_pclose_ret = -1;

/**
 * Passes a message to the JavaScript module and writes the response
 * data, if any, to the response_buffer pointer.
 *
 * @param message The message to pass into JavaScript.
 * @param response_buffer The address where the response will be stored. The
 * JS module will allocate a memory block for the response buffer and write
 * its address to **response_buffer. The caller is responsible for freeing
 * that memory after use.
 *
 * @return The size of the response_buffer (it can contain null bytes).
 *
 * @note The caller should ensure that the memory allocated for response_buffer
 * is freed after its use to prevent memory leaks. It's also recommended
 * to handle exceptions and errors gracefully within the function to ensure
 * the stability of the system.
 */
EM_ASYNC_JS(size_t, js_module_onMessage, (const char *data, char **response_buffer), {
	if (Module['onMessage']) {
		const dataStr = UTF8ToString(data);

		return Module['onMessage'](dataStr)
			.then((response) => {
				const responseBytes =
					typeof response === 'string'
						? new TextEncoder().encode(response)
						: response;

				// Copy the response bytes to heap
				const responseSize = responseBytes.byteLength;
				const responsePtr = _malloc(responseSize + 1);
				HEAPU8.set(responseBytes, responsePtr);
				HEAPU8[responsePtr + responseSize] = 0;
				HEAPU8[response_buffer] = responsePtr;
				HEAPU8[response_buffer + 1] = responsePtr >> 8;
				HEAPU8[response_buffer + 2] = responsePtr >> 16;
				HEAPU8[response_buffer + 3] = responsePtr >> 24;

				return responseSize;
			})
			.catch((e) => {
				// Log the error and return NULL. Message passing
				// separates JS context from the PHP context so we
				// don't let PHP crash here.
				console.error(e);
				return -1;
			});
	}
});

// popen() shim
// -----------------------------------------------------------
// We have a custom popen handler because the original one calls
// fork() which emscripten does not support.
//
// This wasm_popen function is called by PHP_FUNCTION(popen) thanks
// to a patch applied in the Dockerfile.
//
// The `js_popen_to_file` is defined in phpwasm-emscripten-library.js.
// It runs the `cmd` command and returns the path to a file that contains the
// output. The exit code is assigned to the exit_code_ptr.

EMSCRIPTEN_KEEPALIVE FILE *wasm_popen(const char *cmd, const char *mode)
{
	FILE *fp;
	if (*mode == 'r')
	{
		uint8_t last_exit_code;
		char *file_path = js_popen_to_file(cmd, mode, &last_exit_code);
		fp = fopen(file_path, mode);
		FG(pclose_ret) = last_exit_code;
		wasm_pclose_ret = last_exit_code;
	}
	else if (*mode == 'w')
	{
		php_file_descriptor_t stdin_pipe[2];
		php_file_descriptor_t stdout_pipe[2];
		php_file_descriptor_t stderr_pipe[2];
		if (0 != pipe(stdout_pipe) || 0 != pipe(stderr_pipe) || 0 != pipe(stdin_pipe))
		{
			php_error_docref(NULL, E_WARNING, "unable to create pipe %s", strerror(errno));
			errno = EINVAL;
			return 0;
		}

		fp = fdopen(stdin_pipe[1], "w");  // or "w", depending on direction
		if (!fp) {
			php_error_docref(NULL, E_WARNING, "unable to create pipe %s", strerror(errno));
			errno = EINVAL;
			return 0;
		}

		int *stdin = safe_emalloc(sizeof(int), 3, 0);
		int *stdout = safe_emalloc(sizeof(int), 3, 0);
		int *stderr = safe_emalloc(sizeof(int), 3, 0);

		stdin[0] = 0;
		stdin[1] = stdin_pipe[0];
		stdin[2] = stdin_pipe[1];

		stdout[0] = 1;
		stdout[1] = stdout_pipe[0];
		stdout[2] = stdout_pipe[1];

		stderr[0] = 2;
		stderr[1] = stderr_pipe[0];
		stderr[2] = stderr_pipe[1];

		int **descv = safe_emalloc(sizeof(int *), 3, 0);

		descv[0] = stdin;
		descv[1] = stdout;
		descv[2] = stderr;

		// the wasm way {{{
		js_open_process(
			cmd,
			NULL,
			0,
			descv,
			3,
			"",
			0,
			0,
			0
		);
		// }}}

		efree(stdin);
		efree(stdout);
		efree(stderr);

		efree(descv);
	}
	else
	{
		printf("wasm_popen: mode '%s' not supported (cmd: %s)! \n", mode, cmd);
		errno = EINVAL;
		return 0;
	}

	return fp;
}

/**
 * Ship php_exec, the function powering the following PHP
 * functions:
 * * exec()
 * * passthru()
 * * system()
 * * shell_exec()
 *
 * The wasm_php_exec function is called thanks
 * to -Dphp_exec=wasm_php_exec in the Dockerfile and also a
 * small patch that removes php_exec and marks wasm_php_exec()
 * as external.
 *
 * {{{
 */

// These utility functions are copied from php-src/ext/standard/exec.c
static size_t strip_trailing_whitespace(char *buf, size_t bufl)
{
	size_t l = bufl;
	while (l-- > 0 && isspace(((unsigned char *)buf)[l]))
		;
	if (l != (bufl - 1))
	{
		bufl = l + 1;
		buf[bufl] = '\0';
	}
	return bufl;
}

static size_t handle_line(int type, zval *array, char *buf, size_t bufl)
{
	if (type == 1)
	{
		PHPWRITE(buf, bufl);
		if (php_output_get_level() < 1)
		{
			sapi_flush();
		}
	}
	else if (type == 2)
	{
		bufl = strip_trailing_whitespace(buf, bufl);
		add_next_index_stringl(array, buf, bufl);
	}
	return bufl;
}

/**
 * Shims read(2) functionallity.
 * Enables reading from blocking pipes. By default, Emscripten
 * will throw an EWOULDBLOCK error when trying to read from a
 * blocking pipe. This function overrides that behavior and
 * instead waits for the pipe to become readable.
 *
 * @see https://github.com/WordPress/wordpress-playground/issues/951
 * @see https://github.com/emscripten-core/emscripten/issues/13214
 */
EMSCRIPTEN_KEEPALIVE ssize_t wasm_read(int fd, void *buf, size_t count)
{
	struct __wasi_iovec_t iov = {
		.buf = buf,
		.buf_len = count};
	size_t num;
	if (__wasi_syscall_ret(js_fd_read(fd, &iov, 1, &num)))
	{
		return -1;
	}
	return num;
}

/*
 * If type==0, only last line of output is returned (exec)
 * If type==1, all lines will be printed and last lined returned (system)
 * If type==2, all lines will be saved to given array (exec with &$array)
 * If type==3, output will be printed binary, no lines will be saved or returned (passthru)
 */
EMSCRIPTEN_KEEPALIVE int wasm_php_exec(int type, const char *cmd, zval *array, zval *return_value)
{
	FILE *fp;
	char *buf;
	int pclose_return;
	char *b, *d = NULL;
	php_stream *stream;
	size_t buflen, bufl = 0;
#if PHP_SIGCHILD
	void (*sig_handler)() = NULL;
#endif

#if PHP_SIGCHILD
	sig_handler = signal(SIGCHLD, SIG_DFL);
#endif

	// Reuse the process-opening logic
	fp = wasm_popen(cmd, "r");
	if (!fp)
	{
		php_error_docref(NULL, E_WARNING, "Unable to fork [%s]", cmd);
		goto err;
	}

	stream = php_stream_fopen_from_pipe(fp, "rb");

	buf = (char *)emalloc(EXEC_INPUT_BUF);
	buflen = EXEC_INPUT_BUF;

	if (type != 3)
	{
		b = buf;

		while (php_stream_get_line(stream, b, EXEC_INPUT_BUF, &bufl))
		{
			/* no new line found, let's read some more */
			if (b[bufl - 1] != '\n' && !php_stream_eof(stream))
			{
				if (buflen < (bufl + (b - buf) + EXEC_INPUT_BUF))
				{
					bufl += b - buf;
					buflen = bufl + EXEC_INPUT_BUF;
					buf = erealloc(buf, buflen);
					b = buf + bufl;
				}
				else
				{
					b += bufl;
				}
				continue;
			}
			else if (b != buf)
			{
				bufl += b - buf;
			}

			bufl = handle_line(type, array, buf, bufl);
			b = buf;
		}
		if (bufl)
		{
			if (buf != b)
			{
				/* Process remaining output */
				bufl = handle_line(type, array, buf, bufl);
			}

			/* Return last line from the shell command */
			bufl = strip_trailing_whitespace(buf, bufl);
			RETVAL_STRINGL(buf, bufl);
		}
		else
		{ /* should return NULL, but for BC we return "" */
			RETVAL_EMPTY_STRING();
		}
	}
	else
	{
		ssize_t read;
		while ((read = php_stream_read(stream, buf, EXEC_INPUT_BUF)) > 0)
		{
			PHPWRITE(buf, read);
		}
	}

	pclose_return = php_stream_close(stream);
	if (pclose_return == -1)
	{
		pclose_return = wasm_pclose_ret;
	}
	efree(buf);

done:
#if PHP_SIGCHILD
	if (sig_handler)
	{
		signal(SIGCHLD, sig_handler);
	}
#endif
	if (d)
	{
		efree(d);
	}
	return pclose_return;
err:
	pclose_return = -1;
	RETVAL_FALSE;
	goto done;
}

// }}}

// -----------------------------------------------------------

int wasm_socket_has_data(php_socket_t fd);

/* hybrid select(2)/poll(2) for a single descriptor.
 * timeouttv follows same rules as select(2), but is reduced to millisecond accuracy.
 * Returns 0 on timeout, -1 on error, or the event mask (ala poll(2)).
 */
EMSCRIPTEN_KEEPALIVE inline int php_pollfd_for(php_socket_t fd, int events, struct timeval *timeouttv)
{
	php_pollfd p;
	int n;

	p.fd = fd;
	p.events = events;
	p.revents = 0;

	// must yield back to JS event loop to get the network response:
	wasm_poll_socket(fd, events, php_tvtoto(timeouttv));

	n = php_poll2(&p, 1, php_tvtoto(timeouttv));

	if (n > 0)
	{
		return p.revents;
	}

	return n;
}

ZEND_BEGIN_ARG_INFO(arginfo_dl, 0)
ZEND_ARG_INFO(0, extension_filename)
ZEND_END_ARG_INFO()

/**
 * select(2).
 */
EMSCRIPTEN_KEEPALIVE int __wrap_select(int max_fd, fd_set *read_fds, fd_set *write_fds, fd_set *except_fds, struct timeval *timeouttv)
{
	emscripten_sleep(0); // always yield to JS event loop
	int timeoutms = php_tvtoto(timeouttv);
	int n = 0;
	for (int i = 0; i < max_fd; i++)
	{
		if (FD_ISSET(i, read_fds))
		{
			n += wasm_poll_socket(i, POLLIN | POLLOUT, timeoutms);
		}
		if (FD_ISSET(i, write_fds))
		{
			n += wasm_poll_socket(i, POLLOUT, timeoutms);
		}
		if (FD_ISSET(i, except_fds))
		{
			n += wasm_poll_socket(i, POLLERR, timeoutms);
			FD_CLR(i, except_fds);
		}
	}
	return n;
}

#if !defined(TSRMLS_DC)
#define TSRMLS_DC
#endif
#if !defined(TSRMLS_D)
#define TSRMLS_D
#endif
#if !defined(TSRMLS_CC)
#define TSRMLS_CC
#endif
#if !defined(TSRMLS_C)
#define TSRMLS_C
#endif
#if !defined(TSRMLS_FETCH)
#define TSRMLS_FETCH()
#endif

typedef struct wasm_array_entry
{
	char *key;
	char *value;
	struct wasm_array_entry *next;
} wasm_array_entry_t;

typedef struct wasm_uploaded_file
{
	char *key,
		*name,
		*type,
		*tmp_name;
	int error, size;
	struct wasm_uploaded_file *next;
} wasm_uploaded_file_t;

typedef struct
{
	char *document_root,
		*query_string,
		*path_translated,
		*request_uri,
		*request_method,
		*request_host,
		*content_type,
		*request_body,
		*cookies;

	struct wasm_array_entry *server_array_entries;
	struct wasm_array_entry *env_array_entries;

	int content_length,
		request_port,
		skip_shebang;
} wasm_server_context_t;

static wasm_server_context_t *wasm_server_context;

int wasm_sapi_module_startup(sapi_module_struct *sapi_module);
int wasm_sapi_shutdown_wrapper(sapi_module_struct *sapi_globals);
void wasm_sapi_module_shutdown();
static int wasm_sapi_deactivate(TSRMLS_D);
static size_t wasm_sapi_ub_write(const char *str, size_t str_length TSRMLS_DC);
static size_t wasm_sapi_read_post_body(char *buffer, size_t count_bytes);
#if PHP_MAJOR_VERSION >= 8
static void wasm_sapi_log_message(const char *message TSRMLS_DC, int syslog_type_int);
#else
#if (PHP_MAJOR_VERSION == 7 && PHP_MINOR_VERSION >= 1)
static void wasm_sapi_log_message(char *message TSRMLS_DC, int syslog_type_int);
#else
static void wasm_sapi_log_message(char *message TSRMLS_DC);
#endif
#endif
static void wasm_sapi_flush(void *server_context);
static int wasm_sapi_send_headers(sapi_headers_struct *sapi_headers TSRMLS_DC);
static void wasm_sapi_send_header(sapi_header_struct *sapi_header, void *server_context TSRMLS_DC);
static char *wasm_sapi_read_cookies(TSRMLS_D);
static void wasm_sapi_register_server_variables(zval *track_vars_array TSRMLS_DC);
void wasm_init_server_context();
static char *int_to_string(int i);


#if (PHP_MAJOR_VERSION >= 8)
static char *wasm_sapi_getenv(const char *name, size_t name_len)
#else
#if (PHP_MAJOR_VERSION == 7 && PHP_MINOR_VERSION >= 4)
static char *wasm_sapi_getenv(char *name, size_t name_len)
#else
static char *wasm_sapi_getenv(char *name, unsigned long name_len)
#endif
#endif
{
	wasm_array_entry_t *current_entry = wasm_server_context->env_array_entries;
	while (current_entry != NULL)
	{
		if (strncmp(current_entry->key, name, name_len) == 0)
		{
			return current_entry->value;
		}
		current_entry = current_entry->next;
	}
	return NULL;
}


SAPI_API sapi_module_struct php_wasm_sapi_module = {
	"wasm",			 /* name */
#ifdef PLAYGROUND_JSPI
	"PHP WASM SAPI (JSPI)", /* pretty name */
#else
	"PHP WASM SAPI (Asyncify)", /* pretty name */
#endif

	wasm_sapi_module_startup,	/* startup */
	wasm_sapi_shutdown_wrapper, /* shutdown */

	NULL,				  /* activate */
	wasm_sapi_deactivate, /* deactivate */

	wasm_sapi_ub_write, /* unbuffered write */
	wasm_sapi_flush,	/* flush */
	NULL,				/* get uid */
	wasm_sapi_getenv,	/* getenv */

	php_error, /* error handler */

	NULL,					/* header handler */
	wasm_sapi_send_headers, /* send headers handler */
	wasm_sapi_send_header,	/* send header handler */

	wasm_sapi_read_post_body, /* read POST data */
	wasm_sapi_read_cookies,	  /* read Cookies */

	wasm_sapi_register_server_variables, /* register server variables */

	wasm_sapi_log_message, /* Log message */
	NULL,				   /* Get request time */
	NULL,				   /* Child terminate */

	STANDARD_SAPI_MODULE_PROPERTIES};

int php_sapi_started = 0;
int wasm_set_sapi_name(char *name)
{
	if(php_sapi_started == 1) {
		return 1;
	}
	php_wasm_sapi_module.name = strdup(name);
	return 0;
}

char *phpini_path_override = NULL;
void wasm_set_phpini_path(char *path)
{
	free(phpini_path_override);
	phpini_path_override = strdup(path);
}

int stdout_replacement;
int stderr_replacement;

#if WITH_CLI_SAPI == 1
#include "sapi/cli/php_cli_process_title.h"
#if PHP_MAJOR_VERSION >= 8
#include "sapi/cli/php_cli_process_title_arginfo.h"
#endif

extern int wasm_shutdown(int sockfd, int how);
extern int wasm_close(int sockfd);

static const zend_function_entry additional_functions[] = {
ZEND_FE(dl, arginfo_dl)
PHP_FE(cli_set_process_title, arginfo_cli_set_process_title)
PHP_FE(cli_get_process_title, arginfo_cli_get_process_title)
{NULL, NULL, NULL}
};



typedef struct wasm_cli_arg
{
	char *value;
	struct wasm_cli_arg *next;
} wasm_cli_arg_t;

int cli_argc = 0;
wasm_cli_arg_t *cli_argv;
void wasm_add_cli_arg(char *arg)
{
	++cli_argc;
	wasm_cli_arg_t *ll_entry = (wasm_cli_arg_t *)malloc(sizeof(wasm_cli_arg_t));
	ll_entry->value = strdup(arg);
	ll_entry->next = cli_argv;
	cli_argv = ll_entry;
}

/**
 * The main() function comes from PHP CLI SAPI in sapi/cli/php_cli.c
 * The file is provided by the linker and the main() function is not
 * exported from the final .wasm file at the moment.
 */
int main(int argc, char *argv[]);
int run_cli()
{
	// See wasm_sapi_request_init() for details on why we need to redirect stdout and stderr.
	stdout_replacement = redirect_stream_to_file(stdout, "/request/stdout");
	stderr_replacement = redirect_stream_to_file(stderr, "/request/stderr");
	if (stdout_replacement == -1 || stderr_replacement == -1)
	{
		return -1;
	}

	// Set the environment variables
	wasm_array_entry_t *current_env_entry = wasm_server_context->env_array_entries;
	while (current_env_entry != NULL) {
		char *env_string = malloc(strlen(current_env_entry->key) + strlen(current_env_entry->value) + 2);
		sprintf(env_string, "%s=%s", current_env_entry->key, current_env_entry->value);
		putenv(env_string);
		current_env_entry = current_env_entry->next;
	}

	// Convert the argv linkedlist to an array:
	char **cli_argv_array = malloc(sizeof(char *) * (cli_argc));
	wasm_cli_arg_t *current_arg = cli_argv;
	int i = 0;
	while (current_arg != NULL)
	{
		cli_argv_array[cli_argc - i - 1] = current_arg->value;
		++i;
		current_arg = current_arg->next;
	}

	int result = main(cli_argc, cli_argv_array);

	// Clear the environment variables
	while (current_env_entry != NULL) {
		char *env_string = malloc(strlen(current_env_entry->key) + strlen(current_env_entry->value) + 2);
		sprintf(env_string, "%s=", current_env_entry->key);
		putenv(env_string);
		current_env_entry = current_env_entry->next;
	}

	restore_stream_handler(stdout, stdout_replacement);
	restore_stream_handler(stderr, stderr_replacement);

	free(cli_argv_array);

	return result;
}

#else
static const zend_function_entry additional_functions[] = {
	ZEND_FE(dl, arginfo_dl)
};
#endif

void wasm_init_server_context()
{
	wasm_server_context->document_root = NULL;
	wasm_server_context->query_string = NULL;
	wasm_server_context->path_translated = NULL;
	wasm_server_context->request_uri = NULL;
	wasm_server_context->request_method = NULL;
	wasm_server_context->request_host = NULL;
	wasm_server_context->content_type = NULL;
	wasm_server_context->content_length = -1;
	wasm_server_context->request_port = -1;
	wasm_server_context->request_body = NULL;
	wasm_server_context->cookies = NULL;
	wasm_server_context->skip_shebang = 0;
	wasm_server_context->server_array_entries = NULL;
	wasm_server_context->env_array_entries = NULL;
}

void wasm_destroy_server_context()
{
	if (wasm_server_context->document_root != NULL)
	{
		free(wasm_server_context->document_root);
	}
	if (wasm_server_context->query_string != NULL)
	{
		free(wasm_server_context->query_string);
	}
	if (wasm_server_context->path_translated != NULL)
	{
		free(wasm_server_context->path_translated);
	}
	if (wasm_server_context->request_uri != NULL)
	{
		free(wasm_server_context->request_uri);
	}
	if (wasm_server_context->request_method != NULL)
	{
		free(wasm_server_context->request_method);
	}
	if (wasm_server_context->request_host != NULL)
	{
		free(wasm_server_context->request_host);
	}
	if (wasm_server_context->content_type != NULL)
	{
		free(wasm_server_context->content_type);
	}
	if (wasm_server_context->cookies != NULL)
	{
		free(wasm_server_context->cookies);
	}

	// Free wasm_server_context->server_array_entries
	wasm_array_entry_t *current_entry = wasm_server_context->server_array_entries;
	while (current_entry != NULL)
	{
		wasm_array_entry_t *next_entry = current_entry->next;
		free(current_entry->key);
		free(current_entry->value);
		free(current_entry);
		current_entry = next_entry;
	}

	// Free wasm_server_context->env_array_entries
	wasm_array_entry_t *current_env_entry = wasm_server_context->env_array_entries;
	while (current_env_entry != NULL)
	{
		wasm_array_entry_t *next_entry = current_env_entry->next;
		free(current_env_entry->key);
		free(current_env_entry->value);
		free(current_env_entry);
		current_env_entry = next_entry;
	}
}

/**
 * Function: wasm_add_SERVER_entry
 * ----------------------------
 *   Adds a new entry to $_SERVER array.
 *
 *   key: the key of the entry
 *   value: the value of the entry
 */
void wasm_add_SERVER_entry(char *key, char *value)
{
	wasm_array_entry_t *entry = (wasm_array_entry_t *)malloc(sizeof(wasm_array_entry_t));
	entry->key = strdup(key);
	entry->value = strdup(value);
	entry->next = wasm_server_context->server_array_entries;
	wasm_server_context->server_array_entries = entry;

	/**
	 * Keep track of the document root separately so it can be reused
	 * later to compute PHP_SELF.
	 */
	if (strcmp(key, "DOCUMENT_ROOT") == 0)
	{
		wasm_server_context->document_root = strdup(value);
	}
}

/**
 * Function: wasm_add_ENV_entry
 * ----------------------------
 *   Exposes a new entry to the getenv() function.
 *
 *   key: the key of the entry
 *   value: the value of the entry
 */
void wasm_add_ENV_entry(char *key, char *value)
{
	wasm_array_entry_t *entry = (wasm_array_entry_t *)malloc(sizeof(wasm_array_entry_t));
	entry->key = strdup(key);
	entry->value = strdup(value);
	entry->next = wasm_server_context->env_array_entries;
	wasm_server_context->env_array_entries = entry;
}

/**
 * Function: wasm_set_query_string
 * ----------------------------
 *  Sets the query string for the next request.
 *
 *  query_string: the query string, e.g. "name=John&age=30"
 */
void wasm_set_query_string(char *query_string)
{
	wasm_server_context->query_string = strdup(query_string);
}

/**
 * Function: wasm_set_path_translated
 * ----------------------------
 *  Sets the filesystem path of the PHP script to run during the next request.
 *
 *  path_translated: the script path, e.g. "/var/www/myapp/index.php"
 */
void wasm_set_path_translated(char *path_translated)
{
	wasm_server_context->path_translated = strdup(path_translated);
}

/**
 * Function: wasm_set_skip_shebang
 * ----------------------------
 */
void wasm_set_skip_shebang(int should_skip_shebang)
{
	wasm_server_context->skip_shebang = should_skip_shebang;
}

/**
 * Function: wasm_set_request_uri
 * ----------------------------
 *  Sets the request path (without the query string) for the next request.
 *
 *  path_translated: the request path, e.g. "/index.php"
 */
void wasm_set_request_uri(char *request_uri)
{
	wasm_server_context->request_uri = strdup(request_uri);
}

/**
 * Function: wasm_set_request_method
 * ----------------------------
 *  Sets the request method for the next request.
 *
 *  request_method: the request method, e.g. "GET" or "POST"
 */
void wasm_set_request_method(char *request_method)
{
	wasm_server_context->request_method = strdup(request_method);
}

/**
 * Function: wasm_set_request_host
 * ----------------------------
 *  Sets the request host for the next request.
 *
 *  request_host: the request host, e.g. "localhost:8080"
 */
void wasm_set_request_host(char *request_host)
{
	wasm_server_context->request_host = strdup(request_host);
}

/**
 * Function: wasm_set_content_type
 * ----------------------------
 *  Sets the content type associated with the next request.
 *
 *  content_type: the content type, e.g. "application/x-www-form-urlencoded"
 */
void wasm_set_content_type(char *content_type)
{
	wasm_server_context->content_type = strdup(content_type);
}

/**
 * Function: wasm_set_request_body
 * ----------------------------
 *  Sets the request body for the next request.
 *
 *  request_body: the Heap pointer to the request body, e.g. "name=John&age=30"
 */
void wasm_set_request_body(char *request_body)
{
	wasm_server_context->request_body = request_body;
}

/**
 * Function: wasm_set_content_length
 * ----------------------------
 *  Sets the content length associated with the next request.
 *
 *  content_length: the content length, e.g. 20
 */
void wasm_set_content_length(int content_length)
{
	wasm_server_context->content_length = content_length;
}

/**
 * Function: wasm_set_cookies
 * ----------------------------
 *  Sets the cookies associated with the next request.
 *
 *  cookies: the cookies, e.g. "name=John; age=30"
 */
void wasm_set_cookies(char *cookies)
{
	wasm_server_context->cookies = strdup(cookies);
}

/**
 * Function: wasm_set_request_port
 * ----------------------------
 *  Sets the request port for the next request.
 *
 *  port: the request port, e.g. 8080
 */
void wasm_set_request_port(int port)
{
	wasm_server_context->request_port = port;
}

/*
 * Function: redirect_stream_to_file
 * ----------------------------
 *   Redirects writes from a given stream to a file with a specified path.
 *   Think of it as a the ">" operator in "echo foo > bar.txt" bash command.
 *
 *   This is useful to pass streams of bytes containing null bytes to JavaScript
 *   handlers. You can't do that via stdout and stderr because Emscripten truncates
 *   null bytes from these streams.
 *
 *   stream: The stream to redirect, e.g. stdout or stderr.
 *
 *   path: The path to the file to redirect to, e.g. "/request/stdout".
 *
 *   returns: The exit code: 0 on success, -1 on failure.
 */
static int redirect_stream_to_file(FILE *stream, char *file_path)
{
	int out = open(file_path, O_WRONLY);
	if (-1 == out)
	{
		return -1;
	}

	int replacement_stream = dup(fileno(stream));
	if (-1 == dup2(out, fileno(stream)))
	{
		perror("cannot redirect stdout");
		return -1;
	}

	return replacement_stream;
}

/*
 * Function: restore_stream_handler
 * ----------------------------
 *   Restores a stream handler to its original state from before the redirect_stream_to_file
 *   function was called.
 *
 *   stream: The stream to restore, e.g. stdout or stderr.
 *
 *   replacement_stream: The replacement stream returned by the redirect_stream_to_file function.
 */
static void restore_stream_handler(FILE *original_stream, int replacement_stream)
{
	dup2(replacement_stream, fileno(original_stream));
	close(replacement_stream);
}

/*
 * Function: wasm_sapi_read_cookies
 * ----------------------------
 *   Called by PHP to retrieve the cookies associated with the currently
 *   processed request.
 */
static char *wasm_sapi_read_cookies(TSRMLS_D)
{
	return wasm_server_context->cookies;
}

/**
 * Function: wasm_sapi_read_post_body
 * ----------------------------
 *   Called by PHP to retrieve the request body associated with the currently
 *   processed request.
 *
 *   buffer: the buffer to read the request body into
 *   count_bytes: the number of bytes to read
 */
static size_t wasm_sapi_read_post_body(char *buffer, size_t count_bytes)
{
	if (wasm_server_context == NULL || wasm_server_context->request_body == NULL)
	{
		return 0;
	}

	count_bytes = MIN(count_bytes, SG(request_info).content_length - SG(read_post_bytes));
	if (count_bytes > 0)
	{
		memcpy(buffer, wasm_server_context->request_body + SG(read_post_bytes), count_bytes);
	}
	return count_bytes;
}

// === FILE UPLOADS SUPPORT ===

/**
 * Function: wasm_sapi_module_startup
 * ----------------------------
 *   Called by PHP to initialize the SAPI module.
 *
 *   sapi_module: the WASM SAPI module struct.
 */
int wasm_sapi_module_startup(sapi_module_struct *sapi_module)
{
	// php_module_startup signature changed in:
	// https://github.com/php/php-src/commit/b5db594fd277464104fce814d22f0b2207d6502d
#if PHP_MAJOR_VERSION > 8 || (PHP_MAJOR_VERSION == 8 && PHP_MINOR_VERSION >= 2)
	int startup_result = php_module_startup(sapi_module, NULL);
#else
	int startup_result = php_module_startup(sapi_module, NULL, 0);
#endif
	if (startup_result == FAILURE)
	{
		return FAILURE;
	}
	return SUCCESS;
}

/**
 * Function: wasm_sapi_register_server_variables
 * ----------------------------
 *   Called by PHP to register the $_SERVER variables.
 *
 *   track_vars_array: the array where the $_SERVER keys and values are stored.
 */
static void wasm_sapi_register_server_variables(zval *track_vars_array TSRMLS_DC)
{
	php_import_environment_variables(track_vars_array TSRMLS_CC);

	char *value;
	/* PHP_SELF and REQUEST_URI */
	value = SG(request_info).request_uri;
	if (value != NULL)
	{
		/**
		 * REQUEST_URI represents the requested path relative to the site root.
		 * This is **before** any URL rewriting rules (e.g. apache .htaccess) have been
		 * applied.
		 */
		php_register_variable("REQUEST_URI", value, track_vars_array TSRMLS_CC);
	}

	int php_self_set = 0;
	if (wasm_server_context->document_root != NULL && wasm_server_context->path_translated != NULL)
	{
		// Confirm path translated starts with the document root
		/**
		 * PHP_SELF represents the requested script path resolved to a filesystem path relative to the document
		 * root. This is after any URL rewriting rules (e.g. apache .htaccess)
		 * have been applied.
		 *
		 * For example:
		 *
		 * If the document root is /var/www/html and the requested path is /dir/index.php,
		 * PHP_SELF will be /dir/index.php.
		 *
		 * If the document root is /var/www/html and the requested path /nice/urls is
		 * served from /var/www/html/another/directory/script.php, PHP_SELF will be
		 * /another/directory/script.php
		 *
		 * @see https://www.php.net/manual/en/reserved.variables.server.php#:~:text=PHP_SELF
		 */
		if (strncmp(wasm_server_context->document_root, wasm_server_context->path_translated, strlen(wasm_server_context->document_root)) == 0)
		{
			// Substring of path translated starting after document root
			char *script_name = wasm_server_context->path_translated + strlen(wasm_server_context->document_root);
			char *script_filename = wasm_server_context->path_translated;
			char *php_self = wasm_server_context->path_translated + strlen(wasm_server_context->document_root);
			/**
			 * SCRIPT_NAME represents the path to the PHP script being executed after
			 * any URL rewriting rules (e.g. apache .htaccess) have been applied.
			 */
			php_register_variable("SCRIPT_NAME", estrdup(script_name), track_vars_array TSRMLS_CC);
			php_register_variable("SCRIPT_FILENAME", estrdup(script_filename), track_vars_array TSRMLS_CC);
			php_register_variable("PHP_SELF", estrdup(php_self), track_vars_array TSRMLS_CC);
			php_self_set = 1;
		}
	}

	if (php_self_set == 0 && value != NULL)
	{
		// Default to REQUEST_URI
		php_register_variable("SCRIPT_NAME", value, track_vars_array TSRMLS_CC);
		php_register_variable("SCRIPT_FILENAME", value, track_vars_array TSRMLS_CC);
		php_register_variable("PHP_SELF", value, track_vars_array TSRMLS_CC);
	}

	/* argv */
	value = SG(request_info).query_string;
	if (value != NULL)
		php_register_variable("argv", value, track_vars_array TSRMLS_CC);

	/* SERVER_SOFTWARE */
	php_register_variable("SERVER_SOFTWARE", "PHP.wasm", track_vars_array TSRMLS_CC);

	/* SERVER_PROTOCOL */
	if (SG(request_info).proto_num != -1)
	{
		char *port_str = int_to_string(wasm_server_context->request_port);
		php_register_variable("SERVER_PORT", port_str, track_vars_array TSRMLS_CC);
		free(port_str);
	}

	/* SERVER_NAME */
	value = wasm_server_context->request_host;
	if (value != NULL)
	{
		php_register_variable("SERVER_NAME", value, track_vars_array TSRMLS_CC);
		php_register_variable("HTTP_HOST", value, track_vars_array TSRMLS_CC);
	}

	/* REQUEST_METHOD */
	value = (char *)SG(request_info).request_method;
	if (value != NULL)
	{
		php_register_variable("REQUEST_METHOD", value, track_vars_array TSRMLS_CC);
		if (!strcmp(value, "HEAD"))
		{
			SG(request_info).headers_only = 1;
		}
		else
		{
			SG(request_info).headers_only = 0;
		}
	}

	/* QUERY_STRING */
	value = SG(request_info).query_string;
	if (value != NULL)
		php_register_variable("QUERY_STRING", value, track_vars_array TSRMLS_CC);

	// Register entries from wasm_server_context->server_array_entries linked list
	wasm_array_entry_t *entry = wasm_server_context->server_array_entries;
	while (entry != NULL)
	{
		php_register_variable(entry->key, entry->value, track_vars_array TSRMLS_CC);
		entry = entry->next;
	}
}

/**
 * Function: wasm_sapi_request_init
 * ----------------------------
 *   Initializes the PHP request. This is the first step
 *   required to run the PHP code.
 */
int wasm_sapi_request_init()
{
	putenv("USE_ZEND_ALLOC=0");

	// Write to files instead of stdout and stderr because Emscripten truncates null
	// bytes from stdout and stderr, and null bytes are a valid output when streaming
	// binary data.
	// We use our custom Emscripten-defined /request/std* devices and handle the output in JavaScript.
	// These /internal devices are not thread-safe and should always stay in per-process MEMFS space.
	// Sharing them between PHP instances may cause intertwined output.
	stdout_replacement = redirect_stream_to_file(stdout, "/request/stdout");
	stderr_replacement = redirect_stream_to_file(stderr, "/request/stderr");
	if (stdout_replacement == -1 || stderr_replacement == -1)
	{
		return -1;
	}

	zend_llist global_vars;
	zend_llist_init(&global_vars, sizeof(char *), NULL, 0);

	/* Set some Embedded PHP defaults */
	SG(options) |= SAPI_OPTION_NO_CHDIR;

	SG(server_context) = wasm_server_context;

	SG(request_info).query_string = wasm_server_context->query_string;
	SG(request_info).path_translated = wasm_server_context->path_translated;
	SG(request_info).request_uri = wasm_server_context->request_uri;
	SG(request_info).request_method = wasm_server_context->request_method;
	SG(request_info).content_type = wasm_server_context->content_type;
	SG(request_info).content_length = wasm_server_context->content_length;
	SG(request_info).proto_num = 1000; // For HTTP 1.0
	SG(sapi_headers).http_response_code = 200;

	if (php_request_startup(TSRMLS_C) == FAILURE)
	{
		wasm_sapi_module_shutdown();
		return FAILURE;
	}

#if (PHP_MAJOR_VERSION == 7 && PHP_MINOR_VERSION >= 4) || PHP_MAJOR_VERSION >= 8
	if (wasm_server_context->skip_shebang == 1)
	{
		CG(skip_shebang) = 1;
	}
	else
	{
		CG(skip_shebang) = 0;
	}
#endif

	php_register_variable("PHP_SELF", "-", NULL TSRMLS_CC);
	return SUCCESS;
}

extern void js_release_file_locks();

/**
 * Function: wasm_sapi_request_shutdown
 * ----------------------------
 *   Cleans up after the PHP request. This is the last step
 *   required to run the PHP code.
 */
void wasm_sapi_request_shutdown()
{
	TSRMLS_FETCH();
	// Destroy the old server context and shutdown the request
	wasm_destroy_server_context();
	php_request_shutdown(NULL);
	SG(server_context) = NULL;

	// Let's flush the output buffers. It must happen here because
	// ob_start() buffers are not flushed until the shutdown handler
	// runs.
	fflush(stdout);
	fflush(stderr);

	// Restore the regular stdout and stderr stream handlers
	restore_stream_handler(stdout, stdout_replacement);
	restore_stream_handler(stderr, stderr_replacement);

#ifdef PHP_WASM_FILE_LOCKING_SUPPORT
	// Release any locks still held by this process
	js_release_file_locks();
#endif

	// Prepare a fresh request context
	wasm_init_server_context();
}

/**
 * Function: wasm_sapi_handle_request
 * ----------------------------
 *   Executes the PHP file set up with wasm_set_path_translated.
 */
int EMSCRIPTEN_KEEPALIVE wasm_sapi_handle_request()
{
	int result;
	if (wasm_sapi_request_init() == FAILURE)
	{
		result = -1;
		goto wasm_request_done;
	}

	EG(exit_status) = 0;

	TSRMLS_FETCH();
	zend_file_handle file_handle;

	file_handle.type = ZEND_HANDLE_FILENAME;
#if PHP_MAJOR_VERSION >= 8
	zend_string *filename = zend_string_init(
		SG(request_info).path_translated,
		strlen(SG(request_info).path_translated),
		1);
	file_handle.filename = filename;
#else
	file_handle.filename = SG(request_info).path_translated;
#endif
#if PHP_MAJOR_VERSION < 8
	file_handle.free_filename = 0;
	file_handle.opened_path = NULL;
#endif

	// https://bugs.php.net/bug.php?id=77561
	// https://github.com/php/php-src/commit/c5f1b384b591009310370f0b06b10868d2d62741
	// https://www.mail-archive.com/internals@lists.php.net/msg43642.html
	// http://git.php.net/?p=php-src.git;a=commit;h=896dad4c794f7826812bcfdbaaa9f0b3518d9385
	if (php_fopen_primary_script(&file_handle TSRMLS_CC) == FAILURE)
	{
		zend_try
		{
			if (errno == EACCES)
			{
				SG(sapi_headers).http_response_code = 403;
				PUTS("Access denied.\n");
			}
			else
			{
				SG(sapi_headers).http_response_code = 404;
				PUTS("No input file specified.\n");
			}
		}
		zend_catch
		{
		}
		zend_end_try();
		goto wasm_request_done;
	}

	php_execute_script(&file_handle TSRMLS_CC);

	result = EG(exit_status);
wasm_request_done:
	wasm_sapi_request_shutdown();
	return result;
}

void wasm_sapi_module_shutdown()
{
	php_module_shutdown(TSRMLS_C);
	sapi_shutdown();
#ifdef ZTS
	tsrm_shutdown();
#endif
	if (php_wasm_sapi_module.ini_entries)
	{
		free(php_wasm_sapi_module.ini_entries);
		php_wasm_sapi_module.ini_entries = NULL;
	}
}

/**
 * Function: wasm_sapi_shutdown_wrapper
 * ----------------------------
 *  Cleans up after the WASM SAPI module. Call once you will not want
 *  to execute any more PHP code.
 */
int wasm_sapi_shutdown_wrapper(sapi_module_struct *sapi_globals)
{
	TSRMLS_FETCH();
	wasm_sapi_module_shutdown();
	return SUCCESS;
}

static int wasm_sapi_deactivate(TSRMLS_D)
{
	fflush(stdout);
	return SUCCESS;
}

static inline size_t wasm_sapi_single_write(const char *str, uint str_length)
{
#ifdef PHP_WRITE_STDOUT
	long ret;

	ret = write(STDOUT_FILENO, str, str_length);
	if (ret <= 0)
		return 0;
	return ret;
#else
	size_t ret;

	ret = fwrite(str, 1, MIN(str_length, 16384), stdout);
	return ret;
#endif
}

/**
 * Function: wasm_sapi_ub_write
 * ----------------------------
 *   Called by PHP to write to stdout.
 *
 *   str: the string to write.
 *   str_length: the length of the string.
 */
static size_t wasm_sapi_ub_write(const char *str, size_t str_length TSRMLS_DC)
{
	const char *ptr = str;
	uint remaining = str_length;
	size_t ret;

	while (remaining > 0)
	{
		ret = wasm_sapi_single_write(ptr, remaining);
		if (!ret)
		{
			php_handle_aborted_connection();
		}
		ptr += ret;
		remaining -= ret;
	}

	return str_length;
}

static void wasm_sapi_flush(void *server_context)
{
	if (fflush(stdout) == EOF)
	{
		php_handle_aborted_connection();
	}
	sapi_send_headers(TSRMLS_C);
}

static int _fwrite(FILE *file, char *str)
{
	return fwrite(str, sizeof(char), strlen(str), file);
}

static char *int_to_string(int i)
{
	int length = snprintf(NULL, 0, "%d", i);
	char *port_str = malloc(length + 1);
	snprintf(port_str, length + 1, "%d", i);
	return port_str;
}

FILE *headers_file;
/*
 * Function: wasm_sapi_send_headers
 * ----------------------------
 *   Saves the response HTTP status code and the response headers
 *   to a JSON file located at /tmp/headers.json.
 *
 *   Called by PHP in the request shutdown handler.
 */
static int wasm_sapi_send_headers(sapi_headers_struct *sapi_headers TSRMLS_DC)
{
	headers_file = fopen("/request/headers", "w");
	if (headers_file == NULL)
	{
		return FAILURE;
	}

	_fwrite(headers_file, "{ \"status\": ");
	char *response_code = int_to_string(SG(sapi_headers).http_response_code);
	_fwrite(headers_file, response_code);
	free(response_code);
	_fwrite(headers_file, ", \"headers\": [");

	zend_llist_apply_with_argument(&SG(sapi_headers).headers, (llist_apply_with_arg_func_t)sapi_module.send_header, SG(server_context) TSRMLS_CC);
	if (SG(sapi_headers).send_default_content_type)
	{
		sapi_header_struct default_header;

		sapi_get_default_content_type_header(&default_header TSRMLS_CC);
		sapi_module.send_header(&default_header, SG(server_context) TSRMLS_CC);
		sapi_free_header(&default_header);
	}
	sapi_module.send_header(NULL, SG(server_context) TSRMLS_CC);

	_fwrite(headers_file, "]}");
	fclose(headers_file);
	headers_file = NULL;

	return SAPI_HEADER_SENT_SUCCESSFULLY;
}

/*
 * Function: wasm_sapi_send_header
 * ----------------------------
 *   Appends a single header line to the headers JSON file.
 */
static void wasm_sapi_send_header(sapi_header_struct *sapi_header, void *server_context TSRMLS_DC)
{
	if (sapi_header == NULL)
	{
		fwrite(&"\"__terminator__\"", sizeof(char), 16, headers_file);
		return;
	}
	_fwrite(headers_file, "\"");
	for (int i = 0, max = sapi_header->header_len; i < max; i++)
	{
		if (sapi_header->header[i] == '"' || sapi_header->header[i] == '\\')
		{
			fwrite(&"\\", sizeof(char), 1, headers_file);
		}

		fwrite(&sapi_header->header[i], sizeof(char), 1, headers_file);
	}
	_fwrite(headers_file, "\",\n");
}

#if PHP_MAJOR_VERSION >= 8
static void wasm_sapi_log_message(const char *message TSRMLS_DC, int syslog_type_int)
#else
#if (PHP_MAJOR_VERSION == 7 && PHP_MINOR_VERSION >= 1)
static void wasm_sapi_log_message(char *message TSRMLS_DC, int syslog_type_int)
#else
static void wasm_sapi_log_message(char *message TSRMLS_DC)
#endif
#endif
{
	fprintf(stderr, "%s\n", message);
}

/*
 * Function: php_wasm_init
 * ----------------------------
 *   Initiates the PHP wasm SAPI. Call this before calling any
 *   other function.
 */
int php_wasm_init()
{
	wasm_server_context = malloc(sizeof(wasm_server_context_t));
	wasm_init_server_context();

#ifdef ZTS
	void ***tsrm_ls = NULL;
	tsrm_startup(1, 1, 0, NULL);
	tsrm_ls = ts_resource(0);
	*ptsrm_ls = tsrm_ls;
#endif
	sapi_startup(&php_wasm_sapi_module);
	if (phpini_path_override != NULL)
	{
		free(php_wasm_sapi_module.php_ini_path_override);
		php_wasm_sapi_module.php_ini_path_override = phpini_path_override;
	}

	php_sapi_started = 1;
	php_wasm_sapi_module.additional_functions = additional_functions;
	if (php_wasm_sapi_module.startup(&php_wasm_sapi_module) == FAILURE)
	{
		return FAILURE;
	}
	return SUCCESS;
}

/*
 * Function: wasm_free
 * ----------------------------
 *   Frees a pointer. Emscripten does not export the `free` function when using
 *   JSPI, so we need to define our own.
 *
 *   @see https://man7.org/linux/man-pages/man3/free.3.html
 */
void wasm_free(void *_Nullable ptr) {
	free(ptr);
}

#ifdef PHP_WASM_FILE_LOCKING_SUPPORT
/*
 * Function: wasm_get_end_offset
 * ----------------------------
 *   Returns the end offset of the file descriptor.
 *
 *   Useful to determine the base address when file locking
 *   with flock.l_whence == SEEK_END.
 */
EMSCRIPTEN_KEEPALIVE off_t wasm_get_end_offset(int fd) {
	struct stat s;
	int result = fstat(fd, &s);
	if (result == -1) {
		return -1;
	}
	off_t eof_offset = (off_t)s.st_size;
	if (eof_offset < 0) {
		// Guard against overflow, which we do not expect
		return -1;
	}
	return eof_offset;
}

extern pid_t js_getpid();

/**
 * Function: getpid
 * ----------------------------
 *   Returns the process ID of the current process.
 *
 *   As of 2025-06-19, Emscripten's built-in getpid() always returns 42.
 *   We provide our own getpid() implementation to return a distinct ID
 *   for the purpose of file locking.
 */
EMSCRIPTEN_KEEPALIVE pid_t __wrap_getpid() {
	// The process ID is provided in JS as a PHPLoader option,
	// so we ask JS for it here.
	return js_getpid();
}

extern int js_flock(int fd, int op);
/**
 * Function: flock
 * ----------------------------
 *   Emscripten's built-in flock() function is a no-op that pretends to succeed.
 *
 *   We provide a real flock() implementation that performs whole-file locking
 *   amongst php-wasm processes and the host platform.
 */
EMSCRIPTEN_KEEPALIVE int flock(int fd, int op) {
	return js_flock(fd, op);
}
#endif

extern void js_wasm_trace(const char *msg);

/**
 * Function: wasm_trace
 * ----------------------------
 *   This is a printf()-style function that forwards trace messages to JS.
 *   It is provided as a utility that can be used while debugging native code.
 */
EMSCRIPTEN_KEEPALIVE void wasm_trace(const char *fmt, ...) {
	va_list args;
	va_start(args, fmt);
	char buf[1024];
	// NOTE: It would be better and more efficient to just pass varargs to JS,
	// but AFAIK, this is not a good way to do that directly.
	// Perhaps we could devise something later, but this is good enough for now.
	vsnprintf(buf, sizeof(buf), fmt, args);
	va_end(args);

	char traceBuf[1024];
	js_wasm_trace(traceBuf);
}

/**
 * Function: initgroups
 * ----------------------------
 *   Dummy implementation of initgroups() since it's not needed in WASM environment.
 *   Used by ZendAccelerator.
 *   Always returns success (0).
 */
EMSCRIPTEN_KEEPALIVE int initgroups(const char *user, gid_t group) {
	return 0;
}
