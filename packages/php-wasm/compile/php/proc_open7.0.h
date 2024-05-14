/*
   +----------------------------------------------------------------------+
   | PHP Version 7                                                        |
   +----------------------------------------------------------------------+
   | Copyright (c) 1997-2017 The PHP Group                                |
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
/* $Id$ */

typedef int php_file_descriptor_t;
typedef pid_t php_process_id_t;

/* Environment block under win32 is a NUL terminated sequence of NUL terminated
 * name=value strings.
 * Under unix, it is an argv style array.
 * */
typedef struct _php_process_env {
	char *envp;
	char **envarray;
} php_process_env_t;

struct php_process_handle {
	php_process_id_t child;
	int npipes;
	zend_resource **pipes;
	char *command;
	int is_persistent;
	php_process_env_t env;
};

extern int js_waitpid(int pid, int *exitcode);
extern int js_process_status(int pid, int *exitcode);
extern int js_open_process(const char *command, char **args, int args_length, int **descv, int descv_length, char *cwd, int cwd_length, char **env, int env_length);
extern char *js_create_input_device(int procopen_call_nb);

static int procopen_call_id = 0;
