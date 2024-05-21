/*
   +----------------------------------------------------------------------+
   | PHP Version 7                                                        |
   +----------------------------------------------------------------------+
   | Copyright (c) 1997-2018 The PHP Group                                |
   +----------------------------------------------------------------------+
   | This source file is subject to version 3.01 of the PHP license,      |
   | that is bundled with this package in the file LICENSE, and is        |
   | available through the world-wide-web at the following url:           |
   | http://www.php.net/license/3_01.txt                                  |
   | If you did not receive a copy of the PHP license and are unable to   |
   | obtain it through the world-wide-web, please send a note to          |
   | license@php.net so we can mail you a copy immediately.               |
   +----------------------------------------------------------------------+
   | Author: Wez Furlong <wez@thebrainroom.com>                           |
   +----------------------------------------------------------------------+
 */

#if 0 && (defined(__linux__) || defined(sun) || defined(__IRIX__))
# define _BSD_SOURCE 		/* linux wants this when XOPEN mode is on */
# define _BSD_COMPAT		/* irix: uint32_t */
# define _XOPEN_SOURCE 500  /* turn on Unix98 */
# define __EXTENSIONS__	1	/* Solaris: uint32_t */
#endif

#include "php.h"
#include <stdio.h>
#include <ctype.h>
#include "ext/standard/php_string.h"
#include "ext/standard/head.h"
#include "ext/standard/basic_functions.h"
#include "ext/standard/file.h"
#include "ext/standard/exec.h"
#include "php_globals.h"
#include "SAPI.h"
#include "main/php_network.h"

#if HAVE_SYS_WAIT_H
#include <sys/wait.h>
#endif
#include <signal.h>

#if HAVE_SYS_STAT_H
#include <sys/stat.h>
#endif
#if HAVE_FCNTL_H
#include <fcntl.h>
#endif

#include "proc_open.h"

static int le_proc_open;

/* {{{ _php_array_to_envp */
static php_process_env_t _php_array_to_envp(zval *environment, int is_persistent)
{
	zval *element;
	php_process_env_t env;
	zend_string *key, *str;
	char **ep;
	char *p;
	size_t cnt, l, sizeenv = 0;
	HashTable *env_hash;

	memset(&env, 0, sizeof(env));

	if (!environment) {
		return env;
	}

	cnt = zend_hash_num_elements(Z_ARRVAL_P(environment));

	if (cnt < 1) {
		env.envarray = (char **) pecalloc(1, sizeof(char *), is_persistent);
		env.envp = (char *) pecalloc(4, 1, is_persistent);
		return env;
	}

	ALLOC_HASHTABLE(env_hash);
	zend_hash_init(env_hash, cnt, NULL, NULL, 0);

	/* first, we have to get the size of all the elements in the hash */
	ZEND_HASH_FOREACH_STR_KEY_VAL(Z_ARRVAL_P(environment), key, element) {
		str = zval_get_string(element);

		if (ZSTR_LEN(str) == 0) {
#if (PHP_MAJOR_VERSION == 7 && PHP_MINOR_VERSION == 3)
			zend_string_release_ex(str, 0);
#else
			zend_string_release(str);
#endif
			continue;
		}

		sizeenv += ZSTR_LEN(str) + 1;

		if (key && ZSTR_LEN(key)) {
			sizeenv += ZSTR_LEN(key) + 1;
			zend_hash_add_ptr(env_hash, key, str);
		} else {
			zend_hash_next_index_insert_ptr(env_hash, str);
		}
	} ZEND_HASH_FOREACH_END();

	ep = env.envarray = (char **) pecalloc(cnt + 1, sizeof(char *), is_persistent);
	p = env.envp = (char *) pecalloc(sizeenv + 4, 1, is_persistent);

	ZEND_HASH_FOREACH_STR_KEY_PTR(env_hash, key, str) {
		if (key) {
			l = ZSTR_LEN(key) + ZSTR_LEN(str) + 2;
			memcpy(p, ZSTR_VAL(key), ZSTR_LEN(key));
			strncat(p, "=", 1);
			strncat(p, ZSTR_VAL(str), ZSTR_LEN(str));

			*ep = p;
			++ep;
			p += l;
		} else {
			memcpy(p, ZSTR_VAL(str), ZSTR_LEN(str));
			*ep = p;
			++ep;
			p += ZSTR_LEN(str) + 1;
		}
#if (PHP_MAJOR_VERSION == 7 && PHP_MINOR_VERSION == 3)
			zend_string_release_ex(str, 0);
#else
			zend_string_release(str);
#endif
	} ZEND_HASH_FOREACH_END();

	assert((uint32_t)(p - env.envp) <= sizeenv);

	zend_hash_destroy(env_hash);
	FREE_HASHTABLE(env_hash);

	return env;
}
/* }}} */

/* {{{ _php_free_envp */
static void _php_free_envp(php_process_env_t env, int is_persistent)
{
	if (env.envarray) {
		pefree(env.envarray, is_persistent);
	}

	if (env.envp) {
		pefree(env.envp, is_persistent);
	}
}
/* }}} */

/* {{{ proc_open_rsrc_dtor */
static void proc_open_rsrc_dtor(zend_resource *rsrc)
{
	struct php_process_handle *proc = (struct php_process_handle*)rsrc->ptr;
	int i;
	int wstatus;
	int waitpid_options = 0;
	pid_t wait_pid;

	/* Close all handles to avoid a deadlock */
	for (i = 0; i < proc->npipes; i++) {
		if (proc->pipes[i] != 0) {
#if (PHP_MAJOR_VERSION == 7 && PHP_MINOR_VERSION == 3)
			GC_DELREF(proc->pipes[i]);
#else
			GC_REFCOUNT(proc->pipes[i])--;
#endif
			zend_list_close(proc->pipes[i]);
			proc->pipes[i] = 0;
		}
	}


	if (!FG(pclose_wait)) {
		waitpid_options = WNOHANG;
	}
	do {
		wait_pid = js_waitpid(proc->child, &wstatus);
	} while (wait_pid == -1 && errno == EINTR);

	if (wait_pid <= 0) {
		FG(pclose_ret) = -1;
	} else {
		if (WIFEXITED(wstatus))
			wstatus = WEXITSTATUS(wstatus);
		FG(pclose_ret) = wstatus;
	}

	_php_free_envp(proc->env, proc->is_persistent);
	pefree(proc->pipes, proc->is_persistent);
	pefree(proc->command, proc->is_persistent);
	pefree(proc, proc->is_persistent);

}
/* }}} */

/* {{{ PHP_MINIT_FUNCTION(proc_open) */
PHP_MINIT_FUNCTION(proc_open)
{
	le_proc_open = zend_register_list_destructors_ex(proc_open_rsrc_dtor, NULL, "process", module_number);
	return SUCCESS;
}
/* }}} */

/* {{{ proto bool proc_terminate(resource process [, int signal])
   kill a process opened by proc_open */
PHP_FUNCTION(proc_terminate)
{
	zval *zproc;
	struct php_process_handle *proc;
	zend_long sig_no = SIGTERM;

	ZEND_PARSE_PARAMETERS_START(1, 2)
		Z_PARAM_RESOURCE(zproc)
		Z_PARAM_OPTIONAL
		Z_PARAM_LONG(sig_no)
	ZEND_PARSE_PARAMETERS_END_EX(RETURN_FALSE);

	if ((proc = (struct php_process_handle *)zend_fetch_resource(Z_RES_P(zproc), "process", le_proc_open)) == NULL) {
		RETURN_FALSE;
	}

	if (kill(proc->child, sig_no) == 0) {
		RETURN_TRUE;
	} else {
		RETURN_FALSE;
	}
}
/* }}} */

/* {{{ proto int proc_close(resource process)
   close a process opened by proc_open */
PHP_FUNCTION(proc_close)
{
	zval *zproc;
	struct php_process_handle *proc;

	ZEND_PARSE_PARAMETERS_START(1, 1)
		Z_PARAM_RESOURCE(zproc)
	ZEND_PARSE_PARAMETERS_END_EX(RETURN_FALSE);

	if ((proc = (struct php_process_handle *)zend_fetch_resource(Z_RES_P(zproc), "process", le_proc_open)) == NULL) {
		RETURN_FALSE;
	}

	FG(pclose_wait) = 1;
	zend_list_close(Z_RES_P(zproc));
	FG(pclose_wait) = 0;
	RETURN_LONG(FG(pclose_ret));
}
/* }}} */

/* {{{ proto array proc_get_status(resource process)
   get information about a process opened by proc_open */
PHP_FUNCTION(proc_get_status)
{
	zval *zproc;
	struct php_process_handle *proc;

	int running = 1, signaled = 0, stopped = 0;
	int exitcode = -1, termsig = 0, stopsig = 0;

	ZEND_PARSE_PARAMETERS_START(1, 1)
		Z_PARAM_RESOURCE(zproc)
	ZEND_PARSE_PARAMETERS_END_EX(RETURN_FALSE);

	if ((proc = (struct php_process_handle *)zend_fetch_resource(Z_RES_P(zproc), "process", le_proc_open)) == NULL) {
		RETURN_FALSE;
	}

	array_init(return_value);

	add_assoc_string(return_value, "command", proc->command);
	add_assoc_long(return_value, "pid", (zend_long) proc->child);

	errno = 0;
	int proc_status = js_process_status(proc->child, &exitcode);
	if (proc_status == 1) {
		running = 0;
		stopped = 1;
	} else if (proc_status == 0) {
		running = 1;
		stopped = 0;
	} else if (proc_status == -1) {
		php_error_docref(NULL, E_WARNING, "Failed to get process status");
	}

	add_assoc_bool(return_value, "running", running);
	add_assoc_bool(return_value, "signaled", signaled);
	add_assoc_bool(return_value, "stopped", stopped);
	add_assoc_long(return_value, "exitcode", exitcode);
	add_assoc_long(return_value, "termsig", termsig);
	add_assoc_long(return_value, "stopsig", stopsig);
}
/* }}} */

/* {{{ handy definitions for portability/readability */
# define close_descriptor(fd)	close(fd)

#define DESC_PIPE		1
#define DESC_FILE		2
#define DESC_PARENT_MODE_WRITE	8

struct php_proc_open_descriptor_item {
	int index; 							/* desired fd number in child process */
	php_file_descriptor_t parentend, childend;	/* fds for pipes in parent/child */
	int mode;							/* mode for proc_open code */
	int mode_flags;						/* mode flags for opening fds */
};
/* }}} */

/* {{{ proto resource proc_open(string command, array descriptorspec, array &pipes [, string cwd [, array env [, array other_options]]])
   Run a process with more control over it's file descriptors */
PHP_FUNCTION(proc_open)
{
	char *command, *cwd=NULL;
	size_t command_len, cwd_len = 0;
	zval *descriptorspec;
	zval *pipes;
	zval *environment = NULL;
	zval *other_options = NULL;
	php_process_env_t env;
	int ndesc = 0;
	int i;
	int current_procopen_call_id = ++procopen_call_id;
	zval *descitem = NULL;
	zend_string *str_index;
	zend_ulong nindex;
	struct php_proc_open_descriptor_item *descriptors = NULL;
	int ndescriptors_array;
	int **descv = NULL;
	int num_descv = 0;
	php_process_id_t child;
	struct php_process_handle *proc;
	int is_persistent = 0; /* TODO: ensure that persistent procs will work */

	ZEND_PARSE_PARAMETERS_START(3, 6)
		Z_PARAM_STRING(command, command_len)
		Z_PARAM_ARRAY(descriptorspec)
		Z_PARAM_ZVAL_DEREF(pipes)
		Z_PARAM_OPTIONAL
		Z_PARAM_STRING_EX(cwd, cwd_len, 1, 0)
		Z_PARAM_ARRAY_EX(environment, 1, 0)
		Z_PARAM_ARRAY_EX(other_options, 1, 0)
	ZEND_PARSE_PARAMETERS_END_EX(RETURN_FALSE);

	command = pestrdup(command, is_persistent);

	command_len = strlen(command);

	int num_env = 0;
	if (environment) {
		num_env = zend_hash_num_elements(Z_ARRVAL_P(environment));
		env = _php_array_to_envp(environment, is_persistent);
	} else {
		memset(&env, 0, sizeof(env));
	}

	ndescriptors_array = zend_hash_num_elements(Z_ARRVAL_P(descriptorspec));

	num_descv = ndescriptors_array;

	descv = safe_emalloc(sizeof(int *), num_descv, 0);

	descriptors = safe_emalloc(sizeof(struct php_proc_open_descriptor_item), ndescriptors_array, 0);

	memset(descriptors, 0, sizeof(struct php_proc_open_descriptor_item) * ndescriptors_array);

	/* walk the descriptor spec and set up files/pipes */
	ZEND_HASH_FOREACH_KEY_VAL(Z_ARRVAL_P(descriptorspec), nindex, str_index, descitem) {
		zval *ztype;

		if (str_index) {
			php_error_docref(NULL, E_WARNING, "descriptor spec must be an integer indexed array");
			goto exit_fail;
		}

		descriptors[ndesc].index = (int)nindex;

		if (Z_TYPE_P(descitem) == IS_RESOURCE) {
			/* should be a stream - try and dup the descriptor */
			php_stream *stream;
			php_socket_t fd;

			php_stream_from_zval(stream, descitem);

			if (FAILURE == php_stream_cast(stream, PHP_STREAM_AS_FD, (void **)&fd, REPORT_ERRORS)) {
				goto exit_fail;
			}

			descriptors[ndesc].childend = dup(fd);
			if (descriptors[ndesc].childend < 0) {
				php_error_docref(NULL, E_WARNING, "unable to dup File-Handle for descriptor " ZEND_ULONG_FMT " - %s", nindex, strerror(errno));
				goto exit_fail;
			}

			descriptors[ndesc].mode = DESC_FILE;

		} else if (Z_TYPE_P(descitem) != IS_ARRAY) {
			php_error_docref(NULL, E_WARNING, "Descriptor item must be either an array or a File-Handle");
			goto exit_fail;
		} else {

			if ((ztype = zend_hash_index_find(Z_ARRVAL_P(descitem), 0)) != NULL) {
				convert_to_string_ex(ztype);
			} else {
				php_error_docref(NULL, E_WARNING, "Missing handle qualifier in array");
				goto exit_fail;
			}

			if (strcmp(Z_STRVAL_P(ztype), "pipe") == 0) {
				php_file_descriptor_t newpipe[2];
				zval *zmode;

				if ((zmode = zend_hash_index_find(Z_ARRVAL_P(descitem), 1)) != NULL) {
					convert_to_string_ex(zmode);
				} else {
					php_error_docref(NULL, E_WARNING, "Missing mode parameter for 'pipe'");
					goto exit_fail;
				}

				descriptors[ndesc].mode = DESC_PIPE;

				if (0 != pipe(newpipe)) {
					php_error_docref(NULL, E_WARNING, "unable to create pipe %s", strerror(errno));
					goto exit_fail;
				}

				// stdin is a special case – we need an Emscripten device
				// to provide a callback that will feed the data back into
				// the process.
				if (descriptors[ndesc].index == 0) {
					char *device_path = js_create_input_device(current_procopen_call_id);
					// printf("ndesc: %d, index: %d, nindex: %u, device_path: %s\n", ndesc, descriptors[ndesc].index, nindex, device_path);
					descriptors[ndesc].childend = current_procopen_call_id;
					descriptors[ndesc].parentend = open(device_path, O_WRONLY);
				} else {
					if (strncmp(Z_STRVAL_P(zmode), "w", 1) != 0) {
						descriptors[ndesc].parentend = newpipe[1];
						descriptors[ndesc].childend = newpipe[0];
						descriptors[ndesc].mode |= DESC_PARENT_MODE_WRITE;
					} else {
						descriptors[ndesc].parentend = newpipe[0];
						descriptors[ndesc].childend = newpipe[1];
					}
				}
				descriptors[ndesc].mode_flags = descriptors[ndesc].mode & DESC_PARENT_MODE_WRITE ? O_WRONLY : O_RDONLY;

			} else if (strcmp(Z_STRVAL_P(ztype), "file") == 0) {
				zval *zfile, *zmode;
				php_socket_t fd;
				php_stream *stream;

				descriptors[ndesc].mode = DESC_FILE;

				if ((zfile = zend_hash_index_find(Z_ARRVAL_P(descitem), 1)) != NULL) {
					convert_to_string_ex(zfile);
				} else {
					php_error_docref(NULL, E_WARNING, "Missing file name parameter for 'file'");
					goto exit_fail;
				}

				if ((zmode = zend_hash_index_find(Z_ARRVAL_P(descitem), 2)) != NULL) {
					convert_to_string_ex(zmode);
				} else {
					php_error_docref(NULL, E_WARNING, "Missing mode parameter for 'file'");
					goto exit_fail;
				}

				/* try a wrapper */
				stream = php_stream_open_wrapper(Z_STRVAL_P(zfile), Z_STRVAL_P(zmode),
						REPORT_ERRORS|STREAM_WILL_CAST, NULL);

				/* force into an fd */
				if (stream == NULL || FAILURE == php_stream_cast(stream,
							PHP_STREAM_CAST_RELEASE|PHP_STREAM_AS_FD,
							(void **)&fd, REPORT_ERRORS)) {
					goto exit_fail;
				}

				descriptors[ndesc].childend = fd;

			} else if (strcmp(Z_STRVAL_P(ztype), "pty") == 0) {
				php_error_docref(NULL, E_WARNING, "pty pseudo terminal not supported on this system");
				goto exit_fail;
			} else {
				php_error_docref(NULL, E_WARNING, "%s is not a valid descriptor spec/mode", Z_STRVAL_P(ztype));
				goto exit_fail;
			}
		}

		int *desc = safe_emalloc(sizeof(int), 3, 0);

		desc[0] = descriptors[ndesc].index;
		desc[1] = descriptors[ndesc].childend;
		desc[2] = descriptors[ndesc].parentend;

		descv[ndesc] = desc;

		ndesc++;
	} ZEND_HASH_FOREACH_END();

	// the wasm way {{{
	child = js_open_process(
		command,
		NULL,
		0,
		descv,
		num_descv,
		cwd,
		cwd_len,
		env.envarray,
		num_env
	);
	// }}}

	/* we forked/spawned and this is the parent */

	zval_ptr_dtor(pipes);
	array_init(pipes);

	if (!pipes) {
		goto exit_fail;
	}

	proc = (struct php_process_handle*)pemalloc(sizeof(struct php_process_handle), is_persistent);
	proc->is_persistent = is_persistent;
	proc->command = command;
	proc->pipes = pemalloc(sizeof(zend_resource *) * ndesc, is_persistent);
	proc->npipes = ndesc;
	proc->child = child;
	proc->env = env;

	/* open streams on the parent ends, where appropriate */
	for (i = 0; i < ndesc; i++) {
		char *mode_string=NULL;
		php_stream *stream = NULL;

		switch (descriptors[i].mode & ~DESC_PARENT_MODE_WRITE) {
			case DESC_PIPE:
				switch(descriptors[i].mode_flags) {
					case O_WRONLY:
						mode_string = "w";
						break;
					case O_RDONLY:
						mode_string = "r";
						break;
					case O_RDWR:
						mode_string = "r+";
						break;
				}
				stream = php_stream_fopen_from_fd(descriptors[i].parentend, mode_string, NULL);
				if (stream) {
					zval retfp;

					/* nasty hack; don't copy it */
					stream->flags |= PHP_STREAM_FLAG_NO_SEEK;

					php_stream_to_zval(stream, &retfp);
					add_index_zval(pipes, descriptors[i].index, &retfp);

					proc->pipes[i] = Z_RES(retfp);
					Z_ADDREF(retfp);
				}
				break;
			default:
				proc->pipes[i] = NULL;
		}
	}

	if (descv) {
		for(int i = 0; i < num_descv; i++)
		{
			efree(descv[i]);
		}
		efree(descv);
	}

	efree(descriptors);
	ZVAL_RES(return_value, zend_register_resource(proc, le_proc_open));
	return;

exit_fail:
	if (descriptors) {
		efree(descriptors);
	}
	_php_free_envp(env, is_persistent);
	if (command) {
		pefree(command, is_persistent);
	}

	if (descv) {
		for(int i = 0; i < num_descv; i++)
		{
			efree(descv[i]);
		}
		efree(descv);
	}

	RETURN_FALSE;

}
/* }}} */
