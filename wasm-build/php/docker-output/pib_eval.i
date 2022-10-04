# 1 "/root/pib_eval.c"
# 1 "<built-in>" 1
# 1 "<built-in>" 3
# 325 "<built-in>" 3
# 1 "<command line>" 1
# 1 "<built-in>" 2
# 1 "/root/pib_eval.c" 2
# 1 "/emsdk_portable/fastcomp/emscripten/system/include/emscripten.h" 1 3
# 1 "/emsdk_portable/fastcomp/emscripten/system/include/emscripten/emscripten.h" 1 3
# 23 "/emsdk_portable/fastcomp/emscripten/system/include/emscripten/emscripten.h" 3
# 1 "/emsdk_portable/fastcomp/emscripten/system/include/emscripten/em_asm.h" 1 3
# 183 "/emsdk_portable/fastcomp/emscripten/system/include/emscripten/em_asm.h" 3
int emscripten_asm_const_int(const char* code, ...);
double emscripten_asm_const_double(const char* code, ...);

int emscripten_asm_const_int_sync_on_main_thread(const char* code, ...);
double emscripten_asm_const_double_sync_on_main_thread(const char* code, ...);

void emscripten_asm_const_async_on_main_thread(const char* code, ...);
# 24 "/emsdk_portable/fastcomp/emscripten/system/include/emscripten/emscripten.h" 2 3
# 1 "/emsdk_portable/fastcomp/emscripten/system/include/emscripten/em_macros.h" 1 3
# 25 "/emsdk_portable/fastcomp/emscripten/system/include/emscripten/emscripten.h" 2 3
# 1 "/emsdk_portable/fastcomp/emscripten/system/include/emscripten/em_js.h" 1 3
# 26 "/emsdk_portable/fastcomp/emscripten/system/include/emscripten/emscripten.h" 2 3
# 42 "/emsdk_portable/fastcomp/emscripten/system/include/emscripten/emscripten.h" 3
typedef short __attribute__((aligned(1))) emscripten_align1_short;

typedef long long __attribute__((aligned(4))) emscripten_align4_int64;
typedef long long __attribute__((aligned(2))) emscripten_align2_int64;
typedef long long __attribute__((aligned(1))) emscripten_align1_int64;

typedef int __attribute__((aligned(2))) emscripten_align2_int;
typedef int __attribute__((aligned(1))) emscripten_align1_int;

typedef float __attribute__((aligned(2))) emscripten_align2_float;
typedef float __attribute__((aligned(1))) emscripten_align1_float;

typedef double __attribute__((aligned(4))) emscripten_align4_double;
typedef double __attribute__((aligned(2))) emscripten_align2_double;
typedef double __attribute__((aligned(1))) emscripten_align1_double;

typedef void (*em_callback_func)(void);
typedef void (*em_arg_callback_func)(void*);
typedef void (*em_str_callback_func)(const char *);

extern void emscripten_run_script(const char *script);
extern int emscripten_run_script_int(const char *script);
extern char *emscripten_run_script_string(const char *script);
extern void emscripten_async_run_script(const char *script, int millis);
extern void emscripten_async_load_script(const char *script, em_callback_func onload, em_callback_func onerror);


extern void emscripten_set_main_loop(em_callback_func func, int fps, int simulate_infinite_loop);





extern int emscripten_set_main_loop_timing(int mode, int value);
extern void emscripten_get_main_loop_timing(int *mode, int *value);
extern void emscripten_set_main_loop_arg(em_arg_callback_func func, void *arg, int fps, int simulate_infinite_loop);
extern void emscripten_pause_main_loop(void);
extern void emscripten_resume_main_loop(void);
extern void emscripten_cancel_main_loop(void);







typedef void (*em_socket_callback)(int fd, void *userData);
typedef void (*em_socket_error_callback)(int fd, int err, const char* msg, void *userData);

extern void emscripten_set_socket_error_callback(void *userData, em_socket_error_callback callback);
extern void emscripten_set_socket_open_callback(void *userData, em_socket_callback callback);
extern void emscripten_set_socket_listen_callback(void *userData, em_socket_callback callback);
extern void emscripten_set_socket_connection_callback(void *userData, em_socket_callback callback);
extern void emscripten_set_socket_message_callback(void *userData, em_socket_callback callback);
extern void emscripten_set_socket_close_callback(void *userData, em_socket_callback callback);



extern void _emscripten_push_main_loop_blocker(em_arg_callback_func func, void *arg, const char *name);
extern void _emscripten_push_uncounted_main_loop_blocker(em_arg_callback_func func, void *arg, const char *name);
# 116 "/emsdk_portable/fastcomp/emscripten/system/include/emscripten/emscripten.h" 3
extern void emscripten_set_main_loop_expected_blockers(int num);






extern void emscripten_async_call(em_arg_callback_func func, void *arg, int millis);
# 132 "/emsdk_portable/fastcomp/emscripten/system/include/emscripten/emscripten.h" 3
extern void emscripten_exit_with_live_runtime(void);
extern void emscripten_force_exit(int status);

double emscripten_get_device_pixel_ratio(void);

void emscripten_hide_mouse(void);
void emscripten_set_canvas_size(int width, int height) __attribute__((deprecated("This variant does not allow specifying the target canvas", "Use emscripten_set_canvas_element_size() instead")));
void emscripten_get_canvas_size(int *width, int *height, int *isFullscreen) __attribute__((deprecated("This variant does not allow specifying the target canvas", "Use emscripten_get_canvas_element_size() and emscripten_get_fullscreen_status() instead")));


double emscripten_get_now(void);







float emscripten_random(void);



void emscripten_async_wget(const char* url, const char* file, em_str_callback_func onload, em_str_callback_func onerror);

typedef void (*em_async_wget_onload_func)(void*, void*, int);
void emscripten_async_wget_data(const char* url, void *arg, em_async_wget_onload_func onload, em_arg_callback_func onerror);

typedef void (*em_async_wget2_onload_func)(unsigned, void*, const char*);
typedef void (*em_async_wget2_onstatus_func)(unsigned, void*, int);

int emscripten_async_wget2(const char* url, const char* file, const char* requesttype, const char* param, void *arg, em_async_wget2_onload_func onload, em_async_wget2_onstatus_func onerror, em_async_wget2_onstatus_func onprogress);

typedef void (*em_async_wget2_data_onload_func)(unsigned, void*, void*, unsigned);
typedef void (*em_async_wget2_data_onerror_func)(unsigned, void*, int, const char*);
typedef void (*em_async_wget2_data_onprogress_func)(unsigned, void*, int, int);

int emscripten_async_wget2_data(const char* url, const char* requesttype, const char* param, void *arg, int free, em_async_wget2_data_onload_func onload, em_async_wget2_data_onerror_func onerror, em_async_wget2_data_onprogress_func onprogress);

void emscripten_async_wget2_abort(int handle);



void emscripten_wget(const char* url, const char* file);
void emscripten_wget_data(const char* url, void** pbuffer, int* pnum, int *perror);



void emscripten_idb_async_load(const char *db_name, const char *file_id, void* arg, em_async_wget_onload_func onload, em_arg_callback_func onerror);
void emscripten_idb_async_store(const char *db_name, const char *file_id, void* ptr, int num, void* arg, em_arg_callback_func onstore, em_arg_callback_func onerror);
void emscripten_idb_async_delete(const char *db_name, const char *file_id, void* arg, em_arg_callback_func ondelete, em_arg_callback_func onerror);
typedef void (*em_idb_exists_func)(void*, int);
void emscripten_idb_async_exists(const char *db_name, const char *file_id, void* arg, em_idb_exists_func oncheck, em_arg_callback_func onerror);



void emscripten_idb_load(const char *db_name, const char *file_id, void** pbuffer, int* pnum, int *perror);
void emscripten_idb_store(const char *db_name, const char *file_id, void* buffer, int num, int *perror);
void emscripten_idb_delete(const char *db_name, const char *file_id, int *perror);
void emscripten_idb_exists(const char *db_name, const char *file_id, int* pexists, int *perror);

void emscripten_idb_load_blob(const char *db_name, const char *file_id, int* pblob, int *perror);
void emscripten_idb_store_blob(const char *db_name, const char *file_id, void* buffer, int num, int *perror);
void emscripten_idb_read_from_blob(int blob, int start, int num, void* buffer);
void emscripten_idb_free_blob(int blob);



int emscripten_run_preload_plugins(const char* file, em_str_callback_func onload, em_str_callback_func onerror);

typedef void (*em_run_preload_plugins_data_onload_func)(void*, const char*);
void emscripten_run_preload_plugins_data(char* data, int size, const char *suffix, void *arg, em_run_preload_plugins_data_onload_func onload, em_arg_callback_func onerror);

void emscripten_lazy_load_code(void);







typedef int worker_handle;

worker_handle emscripten_create_worker(const char *url);
void emscripten_destroy_worker(worker_handle worker);

typedef void (*em_worker_callback_func)(char*, int, void*);
void emscripten_call_worker(worker_handle worker, const char *funcname, char *data, int size, em_worker_callback_func callback, void *arg);
void emscripten_worker_respond(char *data, int size);
void emscripten_worker_respond_provisionally(char *data, int size);

int emscripten_get_worker_queue_size(worker_handle worker);



int emscripten_get_compiler_setting(const char *name);
int emscripten_has_asyncify(void);

void emscripten_debugger(void);


struct _IO_FILE;
typedef struct _IO_FILE FILE;

char *emscripten_get_preloaded_image_data(const char *path, int *w, int *h);
char *emscripten_get_preloaded_image_data_from_FILE(FILE *file, int *w, int *h);
# 249 "/emsdk_portable/fastcomp/emscripten/system/include/emscripten/emscripten.h" 3
void emscripten_log(int flags, const char* format, ...);

int emscripten_get_callstack(int flags, char *out, int maxbytes);

int emscripten_print_double(double x, char *to, signed max);

typedef void (*em_scan_func)(void*, void*);
void emscripten_scan_registers(em_scan_func func);
void emscripten_scan_stack(em_scan_func func);




typedef void * emscripten_coroutine;
emscripten_coroutine emscripten_coroutine_create(em_arg_callback_func func, void *arg, int stack_size);
int emscripten_coroutine_next(emscripten_coroutine);
void emscripten_yield(void);






void emscripten_sleep(unsigned int ms);
void emscripten_sleep_with_yield(unsigned int ms);
# 2 "/emsdk_portable/fastcomp/emscripten/system/include/emscripten.h" 2 3
# 2 "/root/pib_eval.c" 2
# 1 "/emsdk_portable/fastcomp/emscripten/system/include/compat/stdlib.h" 1 3







int getloadavg(double loadavg[], int nelem);






# 1 "/emsdk_portable/fastcomp/emscripten/system/include/libc/stdlib.h" 1 3







# 1 "/emsdk_portable/fastcomp/emscripten/system/include/libc/features.h" 1 3
# 9 "/emsdk_portable/fastcomp/emscripten/system/include/libc/stdlib.h" 2 3
# 19 "/emsdk_portable/fastcomp/emscripten/system/include/libc/stdlib.h" 3
# 1 "/emsdk_portable/fastcomp/emscripten/system/lib/libc/musl/arch/emscripten/bits/alltypes.h" 1 3
# 32 "/emsdk_portable/fastcomp/emscripten/system/lib/libc/musl/arch/emscripten/bits/alltypes.h" 3
typedef int wchar_t;
# 120 "/emsdk_portable/fastcomp/emscripten/system/lib/libc/musl/arch/emscripten/bits/alltypes.h" 3
typedef unsigned long int size_t;
# 20 "/emsdk_portable/fastcomp/emscripten/system/include/libc/stdlib.h" 2 3

int atoi (const char *);
long atol (const char *);
long long atoll (const char *);
double atof (const char *);

float strtof (const char *restrict, char **restrict);
double strtod (const char *restrict, char **restrict);
long double strtold (const char *restrict, char **restrict);

long strtol (const char *restrict, char **restrict, int);
unsigned long strtoul (const char *restrict, char **restrict, int);
long long strtoll (const char *restrict, char **restrict, int);
unsigned long long strtoull (const char *restrict, char **restrict, int);

int rand (void);
void srand (unsigned);

void *malloc (size_t);
void *calloc (size_t, size_t);
void *realloc (void *, size_t);
void free (void *);
void *aligned_alloc(size_t alignment, size_t size);

_Noreturn void abort (void);
int atexit (void (*) (void));
_Noreturn void exit (int);
_Noreturn void _Exit (int);
int at_quick_exit (void (*) (void));
_Noreturn void quick_exit (int);

char *getenv (const char *);

int system (const char *);

void *bsearch (const void *, const void *, size_t, size_t, int (*)(const void *, const void *));
void qsort (void *, size_t, size_t, int (*)(const void *, const void *));

int abs (int);
long labs (long);
long long llabs (long long);

typedef struct { int quot, rem; } div_t;
typedef struct { long quot, rem; } ldiv_t;
typedef struct { long long quot, rem; } lldiv_t;

div_t div (int, int);
ldiv_t ldiv (long, long);
lldiv_t lldiv (long long, long long);

int mblen (const char *, size_t);
int mbtowc (wchar_t *restrict, const char *restrict, size_t);
int wctomb (char *, wchar_t);
size_t mbstowcs (wchar_t *restrict, const char *restrict, size_t);
size_t wcstombs (char *restrict, const wchar_t *restrict, size_t);




size_t __ctype_get_mb_cur_max(void);
# 99 "/emsdk_portable/fastcomp/emscripten/system/include/libc/stdlib.h" 3
int posix_memalign (void **, size_t, size_t);
int setenv (const char *, const char *, int);
int unsetenv (const char *);
int mkstemp (char *);
int mkostemp (char *, int);
char *mkdtemp (char *);
int getsubopt (char **, char *const *, char **);
int rand_r (unsigned *);






char *realpath (const char *restrict, char *restrict);
long int random (void);
void srandom (unsigned int);
char *initstate (unsigned int, char *, size_t);
char *setstate (char *);
int putenv (char *);
int posix_openpt (int);
int grantpt (int);
int unlockpt (int);
char *ptsname (int);
char *l64a (long);
long a64l (const char *);
void setkey (const char *);
double drand48 (void);
double erand48 (unsigned short [3]);
long int lrand48 (void);
long int nrand48 (unsigned short [3]);
long mrand48 (void);
long jrand48 (unsigned short [3]);
void srand48 (long);
unsigned short *seed48 (unsigned short [3]);
void lcong48 (unsigned short [7]);




# 1 "/emsdk_portable/fastcomp/emscripten/system/include/libc/alloca.h" 1 3








# 1 "/emsdk_portable/fastcomp/emscripten/system/lib/libc/musl/arch/emscripten/bits/alltypes.h" 1 3
# 10 "/emsdk_portable/fastcomp/emscripten/system/include/libc/alloca.h" 2 3

void *alloca(size_t);
# 139 "/emsdk_portable/fastcomp/emscripten/system/include/libc/stdlib.h" 2 3
char *mktemp (char *);
int mkstemps (char *, int);
int mkostemps (char *, int, int);
void *valloc (size_t);
void *memalign(size_t, size_t);
int getloadavg(double *, int);
int clearenv(void);
# 15 "/emsdk_portable/fastcomp/emscripten/system/include/compat/stdlib.h" 2 3
# 3 "/root/pib_eval.c" 2

# 1 "/emsdk_portable/fastcomp/emscripten/system/include/libc/stdio.h" 1 3




# 1 "/emsdk_portable/fastcomp/emscripten/system/include/wasi/api.h" 1 3
# 29 "/emsdk_portable/fastcomp/emscripten/system/include/wasi/api.h" 3
# 1 "/emsdk_portable/fastcomp/emscripten/system/include/libc/stddef.h" 1 3
# 17 "/emsdk_portable/fastcomp/emscripten/system/include/libc/stddef.h" 3
# 1 "/emsdk_portable/fastcomp/emscripten/system/lib/libc/musl/arch/emscripten/bits/alltypes.h" 1 3
# 130 "/emsdk_portable/fastcomp/emscripten/system/lib/libc/musl/arch/emscripten/bits/alltypes.h" 3
typedef long int ptrdiff_t;
# 283 "/emsdk_portable/fastcomp/emscripten/system/lib/libc/musl/arch/emscripten/bits/alltypes.h" 3
typedef struct { long long __ll; long double __ld; } max_align_t;
# 18 "/emsdk_portable/fastcomp/emscripten/system/include/libc/stddef.h" 2 3
# 30 "/emsdk_portable/fastcomp/emscripten/system/include/wasi/api.h" 2 3
# 1 "/emsdk_portable/fastcomp/emscripten/system/include/libc/stdint.h" 1 3
# 20 "/emsdk_portable/fastcomp/emscripten/system/include/libc/stdint.h" 3
# 1 "/emsdk_portable/fastcomp/emscripten/system/lib/libc/musl/arch/emscripten/bits/alltypes.h" 1 3
# 125 "/emsdk_portable/fastcomp/emscripten/system/lib/libc/musl/arch/emscripten/bits/alltypes.h" 3
typedef unsigned long int uintptr_t;
# 140 "/emsdk_portable/fastcomp/emscripten/system/lib/libc/musl/arch/emscripten/bits/alltypes.h" 3
typedef long int intptr_t;
# 156 "/emsdk_portable/fastcomp/emscripten/system/lib/libc/musl/arch/emscripten/bits/alltypes.h" 3
typedef signed char int8_t;




typedef short int16_t;




typedef int int32_t;




typedef long long int int64_t;




typedef long long int intmax_t;




typedef unsigned char uint8_t;




typedef unsigned short uint16_t;




typedef unsigned int uint32_t;




typedef unsigned long long int uint64_t;
# 206 "/emsdk_portable/fastcomp/emscripten/system/lib/libc/musl/arch/emscripten/bits/alltypes.h" 3
typedef unsigned long long int uintmax_t;
# 21 "/emsdk_portable/fastcomp/emscripten/system/include/libc/stdint.h" 2 3

typedef int8_t int_fast8_t;
typedef int64_t int_fast64_t;

typedef int8_t int_least8_t;
typedef int16_t int_least16_t;
typedef int32_t int_least32_t;
typedef int64_t int_least64_t;

typedef uint8_t uint_fast8_t;
typedef uint64_t uint_fast64_t;

typedef uint8_t uint_least8_t;
typedef uint16_t uint_least16_t;
typedef uint32_t uint_least32_t;
typedef uint64_t uint_least64_t;
# 95 "/emsdk_portable/fastcomp/emscripten/system/include/libc/stdint.h" 3
# 1 "/emsdk_portable/fastcomp/emscripten/system/lib/libc/musl/arch/emscripten/bits/stdint.h" 1 3
typedef int32_t int_fast16_t;
typedef int32_t int_fast32_t;
typedef uint32_t uint_fast16_t;
typedef uint32_t uint_fast32_t;
# 96 "/emsdk_portable/fastcomp/emscripten/system/include/libc/stdint.h" 2 3
# 31 "/emsdk_portable/fastcomp/emscripten/system/include/wasi/api.h" 2 3

_Static_assert(_Alignof(int8_t) == 1, "non-wasi data layout");
_Static_assert(_Alignof(uint8_t) == 1, "non-wasi data layout");
_Static_assert(_Alignof(int16_t) == 2, "non-wasi data layout");
_Static_assert(_Alignof(uint16_t) == 2, "non-wasi data layout");
_Static_assert(_Alignof(int32_t) == 4, "non-wasi data layout");
_Static_assert(_Alignof(uint32_t) == 4, "non-wasi data layout");
_Static_assert(_Alignof(int64_t) == 8, "non-wasi data layout");
_Static_assert(_Alignof(uint64_t) == 8, "non-wasi data layout");
_Static_assert(_Alignof(void*) == 4, "non-wasi data layout");







typedef long unsigned int __wasi_size_t;

_Static_assert(sizeof(__wasi_size_t) == 4, "witx calculated size");
_Static_assert(_Alignof(__wasi_size_t) == 4, "witx calculated align");




typedef uint64_t __wasi_filesize_t;

_Static_assert(sizeof(__wasi_filesize_t) == 8, "witx calculated size");
_Static_assert(_Alignof(__wasi_filesize_t) == 8, "witx calculated align");




typedef uint64_t __wasi_timestamp_t;

_Static_assert(sizeof(__wasi_timestamp_t) == 8, "witx calculated size");
_Static_assert(_Alignof(__wasi_timestamp_t) == 8, "witx calculated align");




typedef uint32_t __wasi_clockid_t;
# 98 "/emsdk_portable/fastcomp/emscripten/system/include/wasi/api.h" 3
_Static_assert(sizeof(__wasi_clockid_t) == 4, "witx calculated size");
_Static_assert(_Alignof(__wasi_clockid_t) == 4, "witx calculated align");







typedef uint16_t __wasi_errno_t;
# 494 "/emsdk_portable/fastcomp/emscripten/system/include/wasi/api.h" 3
_Static_assert(sizeof(__wasi_errno_t) == 2, "witx calculated size");
_Static_assert(_Alignof(__wasi_errno_t) == 2, "witx calculated align");




typedef uint64_t __wasi_rights_t;
# 659 "/emsdk_portable/fastcomp/emscripten/system/include/wasi/api.h" 3
_Static_assert(sizeof(__wasi_rights_t) == 8, "witx calculated size");
_Static_assert(_Alignof(__wasi_rights_t) == 8, "witx calculated align");




typedef uint32_t __wasi_fd_t;

_Static_assert(sizeof(__wasi_fd_t) == 4, "witx calculated size");
_Static_assert(_Alignof(__wasi_fd_t) == 4, "witx calculated align");




typedef struct __wasi_iovec_t {



    uint8_t * buf;




    __wasi_size_t buf_len;

} __wasi_iovec_t;

_Static_assert(sizeof(__wasi_iovec_t) == 8, "witx calculated size");
_Static_assert(_Alignof(__wasi_iovec_t) == 4, "witx calculated align");
_Static_assert(__builtin_offsetof(__wasi_iovec_t, buf) == 0, "witx calculated offset");
_Static_assert(__builtin_offsetof(__wasi_iovec_t, buf_len) == 4, "witx calculated offset");




typedef struct __wasi_ciovec_t {



    const uint8_t * buf;




    __wasi_size_t buf_len;

} __wasi_ciovec_t;

_Static_assert(sizeof(__wasi_ciovec_t) == 8, "witx calculated size");
_Static_assert(_Alignof(__wasi_ciovec_t) == 4, "witx calculated align");
_Static_assert(__builtin_offsetof(__wasi_ciovec_t, buf) == 0, "witx calculated offset");
_Static_assert(__builtin_offsetof(__wasi_ciovec_t, buf_len) == 4, "witx calculated offset");




typedef int64_t __wasi_filedelta_t;

_Static_assert(sizeof(__wasi_filedelta_t) == 8, "witx calculated size");
_Static_assert(_Alignof(__wasi_filedelta_t) == 8, "witx calculated align");




typedef uint8_t __wasi_whence_t;
# 740 "/emsdk_portable/fastcomp/emscripten/system/include/wasi/api.h" 3
_Static_assert(sizeof(__wasi_whence_t) == 1, "witx calculated size");
_Static_assert(_Alignof(__wasi_whence_t) == 1, "witx calculated align");






typedef uint64_t __wasi_dircookie_t;

_Static_assert(sizeof(__wasi_dircookie_t) == 8, "witx calculated size");
_Static_assert(_Alignof(__wasi_dircookie_t) == 8, "witx calculated align");




typedef uint32_t __wasi_dirnamlen_t;

_Static_assert(sizeof(__wasi_dirnamlen_t) == 4, "witx calculated size");
_Static_assert(_Alignof(__wasi_dirnamlen_t) == 4, "witx calculated align");




typedef uint64_t __wasi_inode_t;

_Static_assert(sizeof(__wasi_inode_t) == 8, "witx calculated size");
_Static_assert(_Alignof(__wasi_inode_t) == 8, "witx calculated align");




typedef uint8_t __wasi_filetype_t;
# 814 "/emsdk_portable/fastcomp/emscripten/system/include/wasi/api.h" 3
_Static_assert(sizeof(__wasi_filetype_t) == 1, "witx calculated size");
_Static_assert(_Alignof(__wasi_filetype_t) == 1, "witx calculated align");




typedef struct __wasi_dirent_t {



    __wasi_dircookie_t d_next;




    __wasi_inode_t d_ino;




    __wasi_dirnamlen_t d_namlen;




    __wasi_filetype_t d_type;

} __wasi_dirent_t;

_Static_assert(sizeof(__wasi_dirent_t) == 24, "witx calculated size");
_Static_assert(_Alignof(__wasi_dirent_t) == 8, "witx calculated align");
_Static_assert(__builtin_offsetof(__wasi_dirent_t, d_next) == 0, "witx calculated offset");
_Static_assert(__builtin_offsetof(__wasi_dirent_t, d_ino) == 8, "witx calculated offset");
_Static_assert(__builtin_offsetof(__wasi_dirent_t, d_namlen) == 16, "witx calculated offset");
_Static_assert(__builtin_offsetof(__wasi_dirent_t, d_type) == 20, "witx calculated offset");




typedef uint8_t __wasi_advice_t;
# 885 "/emsdk_portable/fastcomp/emscripten/system/include/wasi/api.h" 3
_Static_assert(sizeof(__wasi_advice_t) == 1, "witx calculated size");
_Static_assert(_Alignof(__wasi_advice_t) == 1, "witx calculated align");




typedef uint16_t __wasi_fdflags_t;
# 920 "/emsdk_portable/fastcomp/emscripten/system/include/wasi/api.h" 3
_Static_assert(sizeof(__wasi_fdflags_t) == 2, "witx calculated size");
_Static_assert(_Alignof(__wasi_fdflags_t) == 2, "witx calculated align");




typedef struct __wasi_fdstat_t {



    __wasi_filetype_t fs_filetype;




    __wasi_fdflags_t fs_flags;




    __wasi_rights_t fs_rights_base;





    __wasi_rights_t fs_rights_inheriting;

} __wasi_fdstat_t;

_Static_assert(sizeof(__wasi_fdstat_t) == 24, "witx calculated size");
_Static_assert(_Alignof(__wasi_fdstat_t) == 8, "witx calculated align");
_Static_assert(__builtin_offsetof(__wasi_fdstat_t, fs_filetype) == 0, "witx calculated offset");
_Static_assert(__builtin_offsetof(__wasi_fdstat_t, fs_flags) == 2, "witx calculated offset");
_Static_assert(__builtin_offsetof(__wasi_fdstat_t, fs_rights_base) == 8, "witx calculated offset");
_Static_assert(__builtin_offsetof(__wasi_fdstat_t, fs_rights_inheriting) == 16, "witx calculated offset");





typedef uint64_t __wasi_device_t;

_Static_assert(sizeof(__wasi_device_t) == 8, "witx calculated size");
_Static_assert(_Alignof(__wasi_device_t) == 8, "witx calculated align");




typedef uint16_t __wasi_fstflags_t;
# 991 "/emsdk_portable/fastcomp/emscripten/system/include/wasi/api.h" 3
_Static_assert(sizeof(__wasi_fstflags_t) == 2, "witx calculated size");
_Static_assert(_Alignof(__wasi_fstflags_t) == 2, "witx calculated align");




typedef uint32_t __wasi_lookupflags_t;






_Static_assert(sizeof(__wasi_lookupflags_t) == 4, "witx calculated size");
_Static_assert(_Alignof(__wasi_lookupflags_t) == 4, "witx calculated align");




typedef uint16_t __wasi_oflags_t;
# 1032 "/emsdk_portable/fastcomp/emscripten/system/include/wasi/api.h" 3
_Static_assert(sizeof(__wasi_oflags_t) == 2, "witx calculated size");
_Static_assert(_Alignof(__wasi_oflags_t) == 2, "witx calculated align");




typedef uint64_t __wasi_linkcount_t;

_Static_assert(sizeof(__wasi_linkcount_t) == 8, "witx calculated size");
_Static_assert(_Alignof(__wasi_linkcount_t) == 8, "witx calculated align");




typedef struct __wasi_filestat_t {



    __wasi_device_t dev;




    __wasi_inode_t ino;




    __wasi_filetype_t filetype;




    __wasi_linkcount_t nlink;




    __wasi_filesize_t size;




    __wasi_timestamp_t atim;




    __wasi_timestamp_t mtim;




    __wasi_timestamp_t ctim;

} __wasi_filestat_t;

_Static_assert(sizeof(__wasi_filestat_t) == 64, "witx calculated size");
_Static_assert(_Alignof(__wasi_filestat_t) == 8, "witx calculated align");
_Static_assert(__builtin_offsetof(__wasi_filestat_t, dev) == 0, "witx calculated offset");
_Static_assert(__builtin_offsetof(__wasi_filestat_t, ino) == 8, "witx calculated offset");
_Static_assert(__builtin_offsetof(__wasi_filestat_t, filetype) == 16, "witx calculated offset");
_Static_assert(__builtin_offsetof(__wasi_filestat_t, nlink) == 24, "witx calculated offset");
_Static_assert(__builtin_offsetof(__wasi_filestat_t, size) == 32, "witx calculated offset");
_Static_assert(__builtin_offsetof(__wasi_filestat_t, atim) == 40, "witx calculated offset");
_Static_assert(__builtin_offsetof(__wasi_filestat_t, mtim) == 48, "witx calculated offset");
_Static_assert(__builtin_offsetof(__wasi_filestat_t, ctim) == 56, "witx calculated offset");





typedef uint64_t __wasi_userdata_t;

_Static_assert(sizeof(__wasi_userdata_t) == 8, "witx calculated size");
_Static_assert(_Alignof(__wasi_userdata_t) == 8, "witx calculated align");




typedef uint8_t __wasi_eventtype_t;
# 1132 "/emsdk_portable/fastcomp/emscripten/system/include/wasi/api.h" 3
_Static_assert(sizeof(__wasi_eventtype_t) == 1, "witx calculated size");
_Static_assert(_Alignof(__wasi_eventtype_t) == 1, "witx calculated align");





typedef uint16_t __wasi_eventrwflags_t;






_Static_assert(sizeof(__wasi_eventrwflags_t) == 2, "witx calculated size");
_Static_assert(_Alignof(__wasi_eventrwflags_t) == 2, "witx calculated align");





typedef struct __wasi_event_fd_readwrite_t {



    __wasi_filesize_t nbytes;




    __wasi_eventrwflags_t flags;

} __wasi_event_fd_readwrite_t;

_Static_assert(sizeof(__wasi_event_fd_readwrite_t) == 16, "witx calculated size");
_Static_assert(_Alignof(__wasi_event_fd_readwrite_t) == 8, "witx calculated align");
_Static_assert(__builtin_offsetof(__wasi_event_fd_readwrite_t, nbytes) == 0, "witx calculated offset");
_Static_assert(__builtin_offsetof(__wasi_event_fd_readwrite_t, flags) == 8, "witx calculated offset");




typedef union __wasi_event_u_t {



    __wasi_event_fd_readwrite_t fd_readwrite;

} __wasi_event_u_t;

_Static_assert(sizeof(__wasi_event_u_t) == 16, "witx calculated size");
_Static_assert(_Alignof(__wasi_event_u_t) == 8, "witx calculated align");




typedef struct __wasi_event_t {



    __wasi_userdata_t userdata;




    __wasi_errno_t error;




    __wasi_eventtype_t type;




    __wasi_event_u_t u;

} __wasi_event_t;

_Static_assert(sizeof(__wasi_event_t) == 32, "witx calculated size");
_Static_assert(_Alignof(__wasi_event_t) == 8, "witx calculated align");
_Static_assert(__builtin_offsetof(__wasi_event_t, userdata) == 0, "witx calculated offset");
_Static_assert(__builtin_offsetof(__wasi_event_t, error) == 8, "witx calculated offset");
_Static_assert(__builtin_offsetof(__wasi_event_t, type) == 10, "witx calculated offset");
_Static_assert(__builtin_offsetof(__wasi_event_t, u) == 16, "witx calculated offset");





typedef uint16_t __wasi_subclockflags_t;
# 1233 "/emsdk_portable/fastcomp/emscripten/system/include/wasi/api.h" 3
_Static_assert(sizeof(__wasi_subclockflags_t) == 2, "witx calculated size");
_Static_assert(_Alignof(__wasi_subclockflags_t) == 2, "witx calculated align");




typedef struct __wasi_subscription_clock_t {



    __wasi_clockid_t id;




    __wasi_timestamp_t timeout;





    __wasi_timestamp_t precision;




    __wasi_subclockflags_t flags;

} __wasi_subscription_clock_t;

_Static_assert(sizeof(__wasi_subscription_clock_t) == 32, "witx calculated size");
_Static_assert(_Alignof(__wasi_subscription_clock_t) == 8, "witx calculated align");
_Static_assert(__builtin_offsetof(__wasi_subscription_clock_t, id) == 0, "witx calculated offset");
_Static_assert(__builtin_offsetof(__wasi_subscription_clock_t, timeout) == 8, "witx calculated offset");
_Static_assert(__builtin_offsetof(__wasi_subscription_clock_t, precision) == 16, "witx calculated offset");
_Static_assert(__builtin_offsetof(__wasi_subscription_clock_t, flags) == 24, "witx calculated offset");





typedef struct __wasi_subscription_fd_readwrite_t {



    __wasi_fd_t file_descriptor;

} __wasi_subscription_fd_readwrite_t;

_Static_assert(sizeof(__wasi_subscription_fd_readwrite_t) == 4, "witx calculated size");
_Static_assert(_Alignof(__wasi_subscription_fd_readwrite_t) == 4, "witx calculated align");
_Static_assert(__builtin_offsetof(__wasi_subscription_fd_readwrite_t, file_descriptor) == 0, "witx calculated offset");




typedef union __wasi_subscription_u_t {



    __wasi_subscription_clock_t clock;




    __wasi_subscription_fd_readwrite_t fd_readwrite;

} __wasi_subscription_u_t;

_Static_assert(sizeof(__wasi_subscription_u_t) == 32, "witx calculated size");
_Static_assert(_Alignof(__wasi_subscription_u_t) == 8, "witx calculated align");




typedef struct __wasi_subscription_t {




    __wasi_userdata_t userdata;




    __wasi_eventtype_t type;




    __wasi_subscription_u_t u;

} __wasi_subscription_t;

_Static_assert(sizeof(__wasi_subscription_t) == 48, "witx calculated size");
_Static_assert(_Alignof(__wasi_subscription_t) == 8, "witx calculated align");
_Static_assert(__builtin_offsetof(__wasi_subscription_t, userdata) == 0, "witx calculated offset");
_Static_assert(__builtin_offsetof(__wasi_subscription_t, type) == 8, "witx calculated offset");
_Static_assert(__builtin_offsetof(__wasi_subscription_t, u) == 16, "witx calculated offset");




typedef uint32_t __wasi_exitcode_t;

_Static_assert(sizeof(__wasi_exitcode_t) == 4, "witx calculated size");
_Static_assert(_Alignof(__wasi_exitcode_t) == 4, "witx calculated align");




typedef uint8_t __wasi_signal_t;
# 1532 "/emsdk_portable/fastcomp/emscripten/system/include/wasi/api.h" 3
_Static_assert(sizeof(__wasi_signal_t) == 1, "witx calculated size");
_Static_assert(_Alignof(__wasi_signal_t) == 1, "witx calculated align");




typedef uint16_t __wasi_riflags_t;
# 1550 "/emsdk_portable/fastcomp/emscripten/system/include/wasi/api.h" 3
_Static_assert(sizeof(__wasi_riflags_t) == 2, "witx calculated size");
_Static_assert(_Alignof(__wasi_riflags_t) == 2, "witx calculated align");




typedef uint16_t __wasi_roflags_t;






_Static_assert(sizeof(__wasi_roflags_t) == 2, "witx calculated size");
_Static_assert(_Alignof(__wasi_roflags_t) == 2, "witx calculated align");





typedef uint16_t __wasi_siflags_t;

_Static_assert(sizeof(__wasi_siflags_t) == 2, "witx calculated size");
_Static_assert(_Alignof(__wasi_siflags_t) == 2, "witx calculated align");




typedef uint8_t __wasi_sdflags_t;
# 1590 "/emsdk_portable/fastcomp/emscripten/system/include/wasi/api.h" 3
_Static_assert(sizeof(__wasi_sdflags_t) == 1, "witx calculated size");
_Static_assert(_Alignof(__wasi_sdflags_t) == 1, "witx calculated align");




typedef uint8_t __wasi_preopentype_t;






_Static_assert(sizeof(__wasi_preopentype_t) == 1, "witx calculated size");
_Static_assert(_Alignof(__wasi_preopentype_t) == 1, "witx calculated align");




typedef struct __wasi_prestat_dir_t {



    __wasi_size_t pr_name_len;

} __wasi_prestat_dir_t;

_Static_assert(sizeof(__wasi_prestat_dir_t) == 4, "witx calculated size");
_Static_assert(_Alignof(__wasi_prestat_dir_t) == 4, "witx calculated align");
_Static_assert(__builtin_offsetof(__wasi_prestat_dir_t, pr_name_len) == 0, "witx calculated offset");




typedef union __wasi_prestat_u_t {



    __wasi_prestat_dir_t dir;

} __wasi_prestat_u_t;

_Static_assert(sizeof(__wasi_prestat_u_t) == 4, "witx calculated size");
_Static_assert(_Alignof(__wasi_prestat_u_t) == 4, "witx calculated align");




typedef struct __wasi_prestat_t {



    __wasi_preopentype_t pr_type;




    __wasi_prestat_u_t u;

} __wasi_prestat_t;

_Static_assert(sizeof(__wasi_prestat_t) == 8, "witx calculated size");
_Static_assert(_Alignof(__wasi_prestat_t) == 4, "witx calculated align");
_Static_assert(__builtin_offsetof(__wasi_prestat_t, pr_type) == 0, "witx calculated offset");
_Static_assert(__builtin_offsetof(__wasi_prestat_t, u) == 4, "witx calculated offset");
# 1665 "/emsdk_portable/fastcomp/emscripten/system/include/wasi/api.h" 3
__wasi_errno_t __wasi_args_get(
    uint8_t * * argv,

    uint8_t * argv_buf
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("args_get"),
    __warn_unused_result__
));




__wasi_errno_t __wasi_args_sizes_get(



    __wasi_size_t *argc,



    __wasi_size_t *argv_buf_size
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("args_sizes_get"),
    __warn_unused_result__
));





__wasi_errno_t __wasi_environ_get(
    uint8_t * * environ,

    uint8_t * environ_buf
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("environ_get"),
    __warn_unused_result__
));




__wasi_errno_t __wasi_environ_sizes_get(



    __wasi_size_t *argc,



    __wasi_size_t *argv_buf_size
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("environ_sizes_get"),
    __warn_unused_result__
));







__wasi_errno_t __wasi_clock_res_get(



    __wasi_clockid_t id,




    __wasi_timestamp_t *resolution
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("clock_res_get"),
    __warn_unused_result__
));





__wasi_errno_t __wasi_clock_time_get(



    __wasi_clockid_t id,




    __wasi_timestamp_t precision,




    __wasi_timestamp_t *time
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("clock_time_get"),
    __warn_unused_result__
));





__wasi_errno_t __wasi_fd_advise(
    __wasi_fd_t fd,




    __wasi_filesize_t offset,




    __wasi_filesize_t len,




    __wasi_advice_t advice
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("fd_advise"),
    __warn_unused_result__
));





__wasi_errno_t __wasi_fd_allocate(
    __wasi_fd_t fd,




    __wasi_filesize_t offset,




    __wasi_filesize_t len
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("fd_allocate"),
    __warn_unused_result__
));





__wasi_errno_t __wasi_fd_close(
    __wasi_fd_t fd
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("fd_close"),
    __warn_unused_result__
));





__wasi_errno_t __wasi_fd_datasync(
    __wasi_fd_t fd
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("fd_datasync"),
    __warn_unused_result__
));





__wasi_errno_t __wasi_fd_fdstat_get(
    __wasi_fd_t fd,




    __wasi_fdstat_t *stat
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("fd_fdstat_get"),
    __warn_unused_result__
));





__wasi_errno_t __wasi_fd_fdstat_set_flags(
    __wasi_fd_t fd,




    __wasi_fdflags_t flags
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("fd_fdstat_set_flags"),
    __warn_unused_result__
));





__wasi_errno_t __wasi_fd_fdstat_set_rights(
    __wasi_fd_t fd,




    __wasi_rights_t fs_rights_base,

    __wasi_rights_t fs_rights_inheriting
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("fd_fdstat_set_rights"),
    __warn_unused_result__
));




__wasi_errno_t __wasi_fd_filestat_get(
    __wasi_fd_t fd,




    __wasi_filestat_t *buf
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("fd_filestat_get"),
    __warn_unused_result__
));





__wasi_errno_t __wasi_fd_filestat_set_size(
    __wasi_fd_t fd,




    __wasi_filesize_t size
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("fd_filestat_set_size"),
    __warn_unused_result__
));





__wasi_errno_t __wasi_fd_filestat_set_times(
    __wasi_fd_t fd,




    __wasi_timestamp_t atim,




    __wasi_timestamp_t mtim,




    __wasi_fstflags_t fst_flags
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("fd_filestat_set_times"),
    __warn_unused_result__
));





__wasi_errno_t __wasi_fd_pread(
    __wasi_fd_t fd,




    const __wasi_iovec_t *iovs,




    size_t iovs_len,




    __wasi_filesize_t offset,




    __wasi_size_t *nread
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("fd_pread"),
    __warn_unused_result__
));




__wasi_errno_t __wasi_fd_prestat_get(
    __wasi_fd_t fd,




    __wasi_prestat_t *buf
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("fd_prestat_get"),
    __warn_unused_result__
));




__wasi_errno_t __wasi_fd_prestat_dir_name(
    __wasi_fd_t fd,




    uint8_t * path,

    __wasi_size_t path_len
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("fd_prestat_dir_name"),
    __warn_unused_result__
));





__wasi_errno_t __wasi_fd_pwrite(
    __wasi_fd_t fd,




    const __wasi_ciovec_t *iovs,




    size_t iovs_len,




    __wasi_filesize_t offset,




    __wasi_size_t *nwritten
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("fd_pwrite"),
    __warn_unused_result__
));





__wasi_errno_t __wasi_fd_read(
    __wasi_fd_t fd,




    const __wasi_iovec_t *iovs,




    size_t iovs_len,




    __wasi_size_t *nread
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("fd_read"),
    __warn_unused_result__
));
# 2094 "/emsdk_portable/fastcomp/emscripten/system/include/wasi/api.h" 3
__wasi_errno_t __wasi_fd_readdir(
    __wasi_fd_t fd,




    uint8_t * buf,

    __wasi_size_t buf_len,




    __wasi_dircookie_t cookie,




    __wasi_size_t *bufused
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("fd_readdir"),
    __warn_unused_result__
));
# 2129 "/emsdk_portable/fastcomp/emscripten/system/include/wasi/api.h" 3
__wasi_errno_t __wasi_fd_renumber(
    __wasi_fd_t fd,




    __wasi_fd_t to
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("fd_renumber"),
    __warn_unused_result__
));





__wasi_errno_t __wasi_fd_seek(
    __wasi_fd_t fd,




    __wasi_filedelta_t offset,




    __wasi_whence_t whence,




    __wasi_filesize_t *newoffset
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("fd_seek"),
    __warn_unused_result__
));





__wasi_errno_t __wasi_fd_sync(
    __wasi_fd_t fd
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("fd_sync"),
    __warn_unused_result__
));





__wasi_errno_t __wasi_fd_tell(
    __wasi_fd_t fd,




    __wasi_filesize_t *offset
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("fd_tell"),
    __warn_unused_result__
));





__wasi_errno_t __wasi_fd_write(
    __wasi_fd_t fd,




    const __wasi_ciovec_t *iovs,




    size_t iovs_len,




    __wasi_size_t *nwritten
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("fd_write"),
    __warn_unused_result__
));





__wasi_errno_t __wasi_path_create_directory(
    __wasi_fd_t fd,




    const char *path,




    size_t path_len
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("path_create_directory"),
    __warn_unused_result__
));





__wasi_errno_t __wasi_path_filestat_get(
    __wasi_fd_t fd,




    __wasi_lookupflags_t flags,




    const char *path,




    size_t path_len,




    __wasi_filestat_t *buf
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("path_filestat_get"),
    __warn_unused_result__
));





__wasi_errno_t __wasi_path_filestat_set_times(
    __wasi_fd_t fd,




    __wasi_lookupflags_t flags,




    const char *path,




    size_t path_len,




    __wasi_timestamp_t atim,




    __wasi_timestamp_t mtim,




    __wasi_fstflags_t fst_flags
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("path_filestat_set_times"),
    __warn_unused_result__
));





__wasi_errno_t __wasi_path_link(
    __wasi_fd_t old_fd,




    __wasi_lookupflags_t old_flags,




    const char *old_path,




    size_t old_path_len,




    __wasi_fd_t new_fd,




    const char *new_path,




    size_t new_path_len
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("path_link"),
    __warn_unused_result__
));
# 2372 "/emsdk_portable/fastcomp/emscripten/system/include/wasi/api.h" 3
__wasi_errno_t __wasi_path_open(
    __wasi_fd_t fd,




    __wasi_lookupflags_t dirflags,





    const char *path,




    size_t path_len,




    __wasi_oflags_t oflags,
# 2405 "/emsdk_portable/fastcomp/emscripten/system/include/wasi/api.h" 3
    __wasi_rights_t fs_rights_base,

    __wasi_rights_t fs_rights_inherting,

    __wasi_fdflags_t fdflags,




    __wasi_fd_t *opened_fd
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("path_open"),
    __warn_unused_result__
));





__wasi_errno_t __wasi_path_readlink(
    __wasi_fd_t fd,




    const char *path,




    size_t path_len,




    uint8_t * buf,

    __wasi_size_t buf_len,




    __wasi_size_t *bufused
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("path_readlink"),
    __warn_unused_result__
));






__wasi_errno_t __wasi_path_remove_directory(
    __wasi_fd_t fd,




    const char *path,




    size_t path_len
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("path_remove_directory"),
    __warn_unused_result__
));





__wasi_errno_t __wasi_path_rename(
    __wasi_fd_t fd,




    const char *old_path,




    size_t old_path_len,




    __wasi_fd_t new_fd,




    const char *new_path,




    size_t new_path_len
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("path_rename"),
    __warn_unused_result__
));





__wasi_errno_t __wasi_path_symlink(



    const char *old_path,




    size_t old_path_len,

    __wasi_fd_t fd,




    const char *new_path,




    size_t new_path_len
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("path_symlink"),
    __warn_unused_result__
));






__wasi_errno_t __wasi_path_unlink_file(
    __wasi_fd_t fd,




    const char *path,




    size_t path_len
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("path_unlink_file"),
    __warn_unused_result__
));




__wasi_errno_t __wasi_poll_oneoff(



    const __wasi_subscription_t * in,




    __wasi_event_t * out,




    __wasi_size_t nsubscriptions,




    __wasi_size_t *nevents
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("poll_oneoff"),
    __warn_unused_result__
));






_Noreturn void __wasi_proc_exit(



    __wasi_exitcode_t rval
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("proc_exit")));





__wasi_errno_t __wasi_proc_raise(



    __wasi_signal_t sig
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("proc_raise"),
    __warn_unused_result__
));





__wasi_errno_t __wasi_sched_yield(
    void
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("sched_yield"),
    __warn_unused_result__
));
# 2648 "/emsdk_portable/fastcomp/emscripten/system/include/wasi/api.h" 3
__wasi_errno_t __wasi_random_get(



    uint8_t * buf,

    __wasi_size_t buf_len
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("random_get"),
    __warn_unused_result__
));






__wasi_errno_t __wasi_sock_recv(
    __wasi_fd_t fd,




    const __wasi_iovec_t *ri_data,




    size_t ri_data_len,




    __wasi_riflags_t ri_flags,




    __wasi_size_t *ro_datalen,



    __wasi_roflags_t *ro_flags
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("sock_recv"),
    __warn_unused_result__
));






__wasi_errno_t __wasi_sock_send(
    __wasi_fd_t fd,




    const __wasi_ciovec_t *si_data,




    size_t si_data_len,




    __wasi_siflags_t si_flags,




    __wasi_size_t *so_datalen
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("sock_send"),
    __warn_unused_result__
));





__wasi_errno_t __wasi_sock_shutdown(
    __wasi_fd_t fd,




    __wasi_sdflags_t how
) __attribute__((
    __import_module__("wasi_snapshot_preview1"),
    __import_name__("sock_shutdown"),
    __warn_unused_result__
));
# 6 "/emsdk_portable/fastcomp/emscripten/system/include/libc/stdio.h" 2 3
# 26 "/emsdk_portable/fastcomp/emscripten/system/include/libc/stdio.h" 3
# 1 "/emsdk_portable/fastcomp/emscripten/system/lib/libc/musl/arch/emscripten/bits/alltypes.h" 1 3






typedef __builtin_va_list va_list;




typedef __builtin_va_list __isoc_va_list;
# 135 "/emsdk_portable/fastcomp/emscripten/system/lib/libc/musl/arch/emscripten/bits/alltypes.h" 3
typedef long int ssize_t;
# 222 "/emsdk_portable/fastcomp/emscripten/system/lib/libc/musl/arch/emscripten/bits/alltypes.h" 3
typedef long long int off_t;
# 379 "/emsdk_portable/fastcomp/emscripten/system/lib/libc/musl/arch/emscripten/bits/alltypes.h" 3
typedef struct _IO_FILE FILE;
# 27 "/emsdk_portable/fastcomp/emscripten/system/include/libc/stdio.h" 2 3
# 60 "/emsdk_portable/fastcomp/emscripten/system/include/libc/stdio.h" 3
typedef union _G_fpos64_t {
 char __opaque[16];
 double __align;
} fpos_t;

extern FILE *const stdin;
extern FILE *const stdout;
extern FILE *const stderr;





FILE *fopen(const char *restrict, const char *restrict);
FILE *freopen(const char *restrict, const char *restrict, FILE *restrict);
int fclose(FILE *);

int remove(const char *);
int rename(const char *, const char *);

int feof(FILE *);
int ferror(FILE *);
int fflush(FILE *);
void clearerr(FILE *);

int fseek(FILE *, long, int);
long ftell(FILE *);
void rewind(FILE *);

int fgetpos(FILE *restrict, fpos_t *restrict);
int fsetpos(FILE *, const fpos_t *);

size_t fread(void *restrict, size_t, size_t, FILE *restrict);
size_t fwrite(const void *restrict, size_t, size_t, FILE *restrict);

int fgetc(FILE *);
int getc(FILE *);
int getchar(void);
int ungetc(int, FILE *);

int fputc(int, FILE *);
int putc(int, FILE *);
int putchar(int);

char *fgets(char *restrict, int, FILE *restrict);




int fputs(const char *restrict, FILE *restrict);
int puts(const char *);

int printf(const char *restrict, ...);
int fprintf(FILE *restrict, const char *restrict, ...);
int sprintf(char *restrict, const char *restrict, ...);
int snprintf(char *restrict, size_t, const char *restrict, ...);

int vprintf(const char *restrict, __isoc_va_list);
int vfprintf(FILE *restrict, const char *restrict, __isoc_va_list);
int vsprintf(char *restrict, const char *restrict, __isoc_va_list);
int vsnprintf(char *restrict, size_t, const char *restrict, __isoc_va_list);

int scanf(const char *restrict, ...);
int fscanf(FILE *restrict, const char *restrict, ...);
int sscanf(const char *restrict, const char *restrict, ...);
int vscanf(const char *restrict, __isoc_va_list);
int vfscanf(FILE *restrict, const char *restrict, __isoc_va_list);
int vsscanf(const char *restrict, const char *restrict, __isoc_va_list);

void perror(const char *);

int setvbuf(FILE *restrict, char *restrict, int, size_t);
void setbuf(FILE *restrict, char *restrict);

char *tmpnam(char *);
FILE *tmpfile(void);




FILE *fmemopen(void *restrict, size_t, const char *restrict);
FILE *open_memstream(char **, size_t *);
FILE *fdopen(int, const char *);
FILE *popen(const char *, const char *);
int pclose(FILE *);
int fileno(FILE *);
int fseeko(FILE *, off_t, int);
off_t ftello(FILE *);
int dprintf(int, const char *restrict, ...);
int vdprintf(int, const char *restrict, __isoc_va_list);
void flockfile(FILE *);
int ftrylockfile(FILE *);
void funlockfile(FILE *);
int getc_unlocked(FILE *);
int getchar_unlocked(void);
int putc_unlocked(int, FILE *);
int putchar_unlocked(int);
ssize_t getdelim(char **restrict, size_t *restrict, int, FILE *restrict);
ssize_t getline(char **restrict, size_t *restrict, FILE *restrict);
int renameat(int, const char *, int, const char *);
char *ctermid(char *);







char *tempnam(const char *, const char *);




char *cuserid(char *);
void setlinebuf(FILE *);
void setbuffer(FILE *, char *, size_t);
int fgetc_unlocked(FILE *);
int fputc_unlocked(int, FILE *);
int fflush_unlocked(FILE *);
size_t fread_unlocked(void *, size_t, size_t, FILE *);
size_t fwrite_unlocked(const void *, size_t, size_t, FILE *);
void clearerr_unlocked(FILE *);
int feof_unlocked(FILE *);
int ferror_unlocked(FILE *);
int fileno_unlocked(FILE *);
int getw(FILE *);
int putw(int, FILE *);
char *fgetln(FILE *, size_t *);
int asprintf(char **, const char *, ...);
int vasprintf(char **, const char *, __isoc_va_list);
# 5 "/root/pib_eval.c" 2
# 1 "/emsdk_portable/fastcomp/emscripten/system/include/libc/signal.h" 1 3
# 28 "/emsdk_portable/fastcomp/emscripten/system/include/libc/signal.h" 3
# 1 "/emsdk_portable/fastcomp/emscripten/system/lib/libc/musl/arch/emscripten/bits/alltypes.h" 1 3
# 75 "/emsdk_portable/fastcomp/emscripten/system/lib/libc/musl/arch/emscripten/bits/alltypes.h" 3
typedef long time_t;
# 89 "/emsdk_portable/fastcomp/emscripten/system/lib/libc/musl/arch/emscripten/bits/alltypes.h" 3
typedef struct { union { int __i[11]; volatile int __vi[11]; unsigned __s[11]; } __u; } pthread_attr_t;
# 278 "/emsdk_portable/fastcomp/emscripten/system/lib/libc/musl/arch/emscripten/bits/alltypes.h" 3
typedef long clock_t;
# 293 "/emsdk_portable/fastcomp/emscripten/system/lib/libc/musl/arch/emscripten/bits/alltypes.h" 3
struct timespec { time_t tv_sec; long tv_nsec; };





typedef int pid_t;
# 309 "/emsdk_portable/fastcomp/emscripten/system/lib/libc/musl/arch/emscripten/bits/alltypes.h" 3
typedef unsigned uid_t;
# 337 "/emsdk_portable/fastcomp/emscripten/system/lib/libc/musl/arch/emscripten/bits/alltypes.h" 3
typedef struct __pthread * pthread_t;
# 397 "/emsdk_portable/fastcomp/emscripten/system/lib/libc/musl/arch/emscripten/bits/alltypes.h" 3
typedef struct __sigset_t { unsigned long __bits[128/sizeof(long)]; } sigset_t;
# 29 "/emsdk_portable/fastcomp/emscripten/system/include/libc/signal.h" 2 3
# 44 "/emsdk_portable/fastcomp/emscripten/system/include/libc/signal.h" 3
typedef struct sigaltstack stack_t;




# 1 "/emsdk_portable/fastcomp/emscripten/system/lib/libc/musl/arch/emscripten/bits/signal.h" 1 3
# 31 "/emsdk_portable/fastcomp/emscripten/system/lib/libc/musl/arch/emscripten/bits/signal.h" 3
struct sigaltstack {
 void *ss_sp;
 int ss_flags;
 size_t ss_size;
};


typedef int greg_t, gregset_t[19];
typedef struct _fpstate {
 unsigned long cw, sw, tag, ipoff, cssel, dataoff, datasel;
 struct {
  unsigned short significand[4], exponent;
 } _st[8];
 unsigned long status;
} *fpregset_t;
struct sigcontext {
 unsigned short gs, __gsh, fs, __fsh, es, __esh, ds, __dsh;
 unsigned long edi, esi, ebp, esp, ebx, edx, ecx, eax;
 unsigned long trapno, err, eip;
 unsigned short cs, __csh;
 unsigned long eflags, esp_at_signal;
 unsigned short ss, __ssh;
 struct _fpstate *fpstate;
 unsigned long oldmask, cr2;
};
typedef struct {
 gregset_t gregs;
 fpregset_t fpregs;
 unsigned long oldmask, cr2;
} mcontext_t;






typedef struct __ucontext {
 unsigned long uc_flags;
 struct __ucontext *uc_link;
 stack_t uc_stack;
 mcontext_t uc_mcontext;
 sigset_t uc_sigmask;
 unsigned long __fpregs_mem[28];
} ucontext_t;
# 49 "/emsdk_portable/fastcomp/emscripten/system/include/libc/signal.h" 2 3
# 92 "/emsdk_portable/fastcomp/emscripten/system/include/libc/signal.h" 3
union sigval {
 int sival_int;
 void *sival_ptr;
};

typedef struct {



 int si_signo, si_errno, si_code;

 union {
  char __pad[128 - 2*sizeof(int) - sizeof(long)];
  struct {
   union {
    struct {
     pid_t si_pid;
     uid_t si_uid;
    } __piduid;
    struct {
     int si_timerid;
     int si_overrun;
    } __timer;
   } __first;
   union {
    union sigval si_value;
    struct {
     int si_status;
     clock_t si_utime, si_stime;
    } __sigchld;
   } __second;
  } __si_common;
  struct {
   void *si_addr;
   short si_addr_lsb;
   union {
    struct {
     void *si_lower;
     void *si_upper;
    } __addr_bnd;
    unsigned si_pkey;
   } __first;
  } __sigfault;
  struct {
   long si_band;
   int si_fd;
  } __sigpoll;
  struct {
   void *si_call_addr;
   int si_syscall;
   unsigned si_arch;
  } __sigsys;
 } __si_fields;
} siginfo_t;
# 167 "/emsdk_portable/fastcomp/emscripten/system/include/libc/signal.h" 3
struct sigaction {
 union {
  void (*sa_handler)(int);
  void (*sa_sigaction)(int, siginfo_t *, void *);
 } __sa_handler;
 sigset_t sa_mask;
 int sa_flags;
 void (*sa_restorer)(void);
};



struct sigevent {
 union sigval sigev_value;
 int sigev_signo;
 int sigev_notify;
 void (*sigev_notify_function)(union sigval);
 pthread_attr_t *sigev_notify_attributes;
 char __pad[56-3*sizeof(long)];
};





int __libc_current_sigrtmin(void);
int __libc_current_sigrtmax(void);




int kill(pid_t, int);

int sigemptyset(sigset_t *);
int sigfillset(sigset_t *);
int sigaddset(sigset_t *, int);
int sigdelset(sigset_t *, int);
int sigismember(const sigset_t *, int);

int sigprocmask(int, const sigset_t *restrict, sigset_t *restrict);
int sigsuspend(const sigset_t *);
int sigaction(int, const struct sigaction *restrict, struct sigaction *restrict);
int sigpending(sigset_t *);
int sigwait(const sigset_t *restrict, int *restrict);
int sigwaitinfo(const sigset_t *restrict, siginfo_t *restrict);
int sigtimedwait(const sigset_t *restrict, siginfo_t *restrict, const struct timespec *restrict);
int sigqueue(pid_t, int, const union sigval);

int pthread_sigmask(int, const sigset_t *restrict, sigset_t *restrict);
int pthread_kill(pthread_t, int);

void psiginfo(const siginfo_t *, const char *);
void psignal(int, const char *);




int killpg(pid_t, int);
int sigaltstack(const stack_t *restrict, stack_t *restrict);
int sighold(int);
int sigignore(int);
int siginterrupt(int, int);
int sigpause(int);
int sigrelse(int);
void (*sigset(int, void (*)(int)))(int);
# 246 "/emsdk_portable/fastcomp/emscripten/system/include/libc/signal.h" 3
typedef void (*sig_t)(int);
# 264 "/emsdk_portable/fastcomp/emscripten/system/include/libc/signal.h" 3
typedef int sig_atomic_t;

void (*signal(int, void (*)(int)))(int);
int raise(int);
# 6 "/root/pib_eval.c" 2


# 1 "Zend/zend.h" 1
# 27 "Zend/zend.h"
# 1 "Zend/zend_types.h" 1
# 25 "Zend/zend_types.h"
# 1 "Zend/zend_portability.h" 1
# 43 "Zend/zend_portability.h"
# 1 "Zend/zend_config.h" 1
# 1 "Zend/../main/php_config.h" 1
# 2106 "Zend/../main/php_config.h"
# 1 "/emsdk_portable/fastcomp/emscripten/system/include/libc/sys/types.h" 1 3
# 57 "/emsdk_portable/fastcomp/emscripten/system/include/libc/sys/types.h" 3
# 1 "/emsdk_portable/fastcomp/emscripten/system/lib/libc/musl/arch/emscripten/bits/alltypes.h" 1 3
# 80 "/emsdk_portable/fastcomp/emscripten/system/lib/libc/musl/arch/emscripten/bits/alltypes.h" 3
typedef long suseconds_t;
# 97 "/emsdk_portable/fastcomp/emscripten/system/lib/libc/musl/arch/emscripten/bits/alltypes.h" 3
typedef struct { union { int __i[7]; volatile int __vi[7]; volatile void *__p[7]; } __u; } pthread_mutex_t;
typedef pthread_mutex_t mtx_t;




typedef struct { union { int __i[12]; volatile int __vi[12]; void *__p[12]; } __u; } pthread_cond_t;
typedef pthread_cond_t cnd_t;




typedef struct { union { int __i[8]; volatile int __vi[8]; void *__p[8]; } __u; } pthread_rwlock_t;




typedef struct { union { int __i[5]; volatile int __vi[5]; void *__p[5]; } __u; } pthread_barrier_t;
# 150 "/emsdk_portable/fastcomp/emscripten/system/lib/libc/musl/arch/emscripten/bits/alltypes.h" 3
typedef long int register_t;
# 201 "/emsdk_portable/fastcomp/emscripten/system/lib/libc/musl/arch/emscripten/bits/alltypes.h" 3
typedef unsigned long long int u_int64_t;
# 212 "/emsdk_portable/fastcomp/emscripten/system/lib/libc/musl/arch/emscripten/bits/alltypes.h" 3
typedef unsigned mode_t;




typedef unsigned long int nlink_t;
# 227 "/emsdk_portable/fastcomp/emscripten/system/lib/libc/musl/arch/emscripten/bits/alltypes.h" 3
typedef unsigned long long int ino_t;




typedef unsigned int dev_t;




typedef long blksize_t;




typedef int blkcnt_t;




typedef unsigned int fsblkcnt_t;




typedef unsigned int fsfilcnt_t;
# 268 "/emsdk_portable/fastcomp/emscripten/system/lib/libc/musl/arch/emscripten/bits/alltypes.h" 3
typedef void * timer_t;




typedef int clockid_t;
# 304 "/emsdk_portable/fastcomp/emscripten/system/lib/libc/musl/arch/emscripten/bits/alltypes.h" 3
typedef unsigned id_t;
# 314 "/emsdk_portable/fastcomp/emscripten/system/lib/libc/musl/arch/emscripten/bits/alltypes.h" 3
typedef unsigned gid_t;




typedef int key_t;




typedef unsigned useconds_t;
# 343 "/emsdk_portable/fastcomp/emscripten/system/lib/libc/musl/arch/emscripten/bits/alltypes.h" 3
typedef int pthread_once_t;




typedef unsigned pthread_key_t;




typedef int pthread_spinlock_t;




typedef struct { unsigned __attr; } pthread_mutexattr_t;




typedef struct { unsigned __attr; } pthread_condattr_t;




typedef struct { unsigned __attr; } pthread_barrierattr_t;




typedef struct { unsigned __attr[2]; } pthread_rwlockattr_t;
# 58 "/emsdk_portable/fastcomp/emscripten/system/include/libc/sys/types.h" 2 3


typedef unsigned char u_int8_t;
typedef unsigned short u_int16_t;
typedef unsigned u_int32_t;
typedef char *caddr_t;
typedef unsigned char u_char;
typedef unsigned short u_short, ushort;
typedef unsigned u_int, uint;
typedef unsigned long u_long, ulong;
typedef long long quad_t;
typedef unsigned long long u_quad_t;

# 1 "/emsdk_portable/fastcomp/emscripten/system/include/libc/endian.h" 1 3
# 25 "/emsdk_portable/fastcomp/emscripten/system/include/libc/endian.h" 3
static inline uint16_t __bswap16(uint16_t __x)
{
 return __x<<8 | __x>>8;
}

static inline uint32_t __bswap32(uint32_t __x)
{
 return __x>>24 | __x>>8&0xff00 | __x<<8&0xff0000 | __x<<24;
}

static inline uint64_t __bswap64(uint64_t __x)
{
 return __bswap32(__x)+0ULL<<32 | __bswap32(__x>>32);
}
# 71 "/emsdk_portable/fastcomp/emscripten/system/include/libc/sys/types.h" 2 3
# 1 "/emsdk_portable/fastcomp/emscripten/system/include/libc/sys/select.h" 1 3
# 16 "/emsdk_portable/fastcomp/emscripten/system/include/libc/sys/select.h" 3
# 1 "/emsdk_portable/fastcomp/emscripten/system/lib/libc/musl/arch/emscripten/bits/alltypes.h" 1 3
# 288 "/emsdk_portable/fastcomp/emscripten/system/lib/libc/musl/arch/emscripten/bits/alltypes.h" 3
struct timeval { time_t tv_sec; suseconds_t tv_usec; };
# 17 "/emsdk_portable/fastcomp/emscripten/system/include/libc/sys/select.h" 2 3



typedef unsigned long fd_mask;

typedef struct {
 unsigned long fds_bits[1024 / 8 / sizeof(long)];
} fd_set;






int select (int, fd_set *restrict, fd_set *restrict, fd_set *restrict, struct timeval *restrict);
int pselect (int, fd_set *restrict, fd_set *restrict, fd_set *restrict, const struct timespec *restrict, const sigset_t *restrict);
# 72 "/emsdk_portable/fastcomp/emscripten/system/include/libc/sys/types.h" 2 3
# 2107 "Zend/../main/php_config.h" 2






# 1 "/emsdk_portable/fastcomp/emscripten/system/include/compat/string.h" 1 3







extern char* strlwr(char *);
extern char* strupr(char *);






# 1 "/emsdk_portable/fastcomp/emscripten/system/include/libc/string.h" 1 3
# 23 "/emsdk_portable/fastcomp/emscripten/system/include/libc/string.h" 3
# 1 "/emsdk_portable/fastcomp/emscripten/system/lib/libc/musl/arch/emscripten/bits/alltypes.h" 1 3
# 391 "/emsdk_portable/fastcomp/emscripten/system/lib/libc/musl/arch/emscripten/bits/alltypes.h" 3
typedef struct __locale_struct * locale_t;
# 24 "/emsdk_portable/fastcomp/emscripten/system/include/libc/string.h" 2 3

void *memcpy (void *restrict, const void *restrict, size_t);
void *memmove (void *, const void *, size_t);
void *memset (void *, int, size_t);
int memcmp (const void *, const void *, size_t);
void *memchr (const void *, int, size_t);

char *strcpy (char *restrict, const char *restrict);
char *strncpy (char *restrict, const char *restrict, size_t);

char *strcat (char *restrict, const char *restrict);
char *strncat (char *restrict, const char *restrict, size_t);

int strcmp (const char *, const char *);
int strncmp (const char *, const char *, size_t);

int strcoll (const char *, const char *);
size_t strxfrm (char *restrict, const char *restrict, size_t);

char *strchr (const char *, int);
char *strrchr (const char *, int);

size_t strcspn (const char *, const char *);
size_t strspn (const char *, const char *);
char *strpbrk (const char *, const char *);
char *strstr (const char *, const char *);
char *strtok (char *restrict, const char *restrict);

size_t strlen (const char *);

char *strerror (int);



# 1 "/emsdk_portable/fastcomp/emscripten/system/include/libc/strings.h" 1 3
# 11 "/emsdk_portable/fastcomp/emscripten/system/include/libc/strings.h" 3
# 1 "/emsdk_portable/fastcomp/emscripten/system/lib/libc/musl/arch/emscripten/bits/alltypes.h" 1 3
# 12 "/emsdk_portable/fastcomp/emscripten/system/include/libc/strings.h" 2 3




int bcmp (const void *, const void *, size_t);
void bcopy (const void *, void *, size_t);
void bzero (void *, size_t);
char *index (const char *, int);
char *rindex (const char *, int);



int ffs (int);
int ffsl (long);
int ffsll (long long);


int strcasecmp (const char *, const char *);
int strncasecmp (const char *, const char *, size_t);

int strcasecmp_l (const char *, const char *, locale_t);
int strncasecmp_l (const char *, const char *, size_t, locale_t);
# 58 "/emsdk_portable/fastcomp/emscripten/system/include/libc/string.h" 2 3





char *strtok_r (char *restrict, const char *restrict, char **restrict);
int strerror_r (int, char *, size_t);
char *stpcpy(char *restrict, const char *restrict);
char *stpncpy(char *restrict, const char *restrict, size_t);
size_t strnlen (const char *, size_t);
char *strdup (const char *);
char *strndup (const char *, size_t);
char *strsignal(int);
char *strerror_l (int, locale_t);
int strcoll_l (const char *, const char *, locale_t);
size_t strxfrm_l (char *restrict, const char *restrict, size_t, locale_t);




void *memccpy (void *restrict, const void *restrict, int, size_t);



char *strsep(char **, const char *);
size_t strlcat (char *, const char *, size_t);
size_t strlcpy (char *, const char *, size_t);




int strverscmp (const char *, const char *);
int strcasecmp_l (const char *, const char *, locale_t);
int strncasecmp_l (const char *, const char *, size_t, locale_t);
char *strchrnul(const char *, int);
char *strcasestr(const char *, const char *);
void *memmem(const void *, size_t, const void *, size_t);
void *memrchr(const void *, int, size_t);
void *mempcpy(void *, const void *, size_t);

char *basename();
# 16 "/emsdk_portable/fastcomp/emscripten/system/include/compat/string.h" 2 3
# 2114 "Zend/../main/php_config.h" 2
# 2 "Zend/zend_config.h" 2
# 44 "Zend/zend_portability.h" 2



# 1 "Zend/../TSRM/TSRM.h" 1
# 23 "Zend/../TSRM/TSRM.h"
# 1 "./main/php_stdint.h" 1
# 42 "./main/php_stdint.h"
# 1 "/emsdk_portable/fastcomp/emscripten/system/include/libc/inttypes.h" 1 3
# 12 "/emsdk_portable/fastcomp/emscripten/system/include/libc/inttypes.h" 3
# 1 "/emsdk_portable/fastcomp/emscripten/system/lib/libc/musl/arch/emscripten/bits/alltypes.h" 1 3
# 13 "/emsdk_portable/fastcomp/emscripten/system/include/libc/inttypes.h" 2 3

typedef struct { intmax_t quot, rem; } imaxdiv_t;

intmax_t imaxabs(intmax_t);
imaxdiv_t imaxdiv(intmax_t, intmax_t);

intmax_t strtoimax(const char *restrict, char **restrict, int);
uintmax_t strtoumax(const char *restrict, char **restrict, int);

intmax_t wcstoimax(const wchar_t *restrict, wchar_t **restrict, int);
uintmax_t wcstoumax(const wchar_t *restrict, wchar_t **restrict, int);
# 43 "./main/php_stdint.h" 2
# 24 "Zend/../TSRM/TSRM.h" 2
# 37 "Zend/../TSRM/TSRM.h"
typedef intptr_t tsrm_intptr_t;
typedef uintptr_t tsrm_uintptr_t;
# 48 "Zend/zend_portability.h" 2


# 1 "/emsdk_portable/fastcomp/emscripten/system/include/libc/assert.h" 1 3
# 20 "/emsdk_portable/fastcomp/emscripten/system/include/libc/assert.h" 3
_Noreturn

void __assert_fail (const char *, const char *, int, const char *);
# 51 "Zend/zend_portability.h" 2
# 1 "/emsdk_portable/fastcomp/emscripten/system/include/compat/math.h" 1 3
# 12 "/emsdk_portable/fastcomp/emscripten/system/include/compat/math.h" 3
# 1 "/emsdk_portable/fastcomp/emscripten/system/include/libc/math.h" 1 3
# 12 "/emsdk_portable/fastcomp/emscripten/system/include/libc/math.h" 3
# 1 "/emsdk_portable/fastcomp/emscripten/system/lib/libc/musl/arch/emscripten/bits/alltypes.h" 1 3
# 52 "/emsdk_portable/fastcomp/emscripten/system/lib/libc/musl/arch/emscripten/bits/alltypes.h" 3
typedef float float_t;




typedef double double_t;
# 13 "/emsdk_portable/fastcomp/emscripten/system/include/libc/math.h" 2 3
# 39 "/emsdk_portable/fastcomp/emscripten/system/include/libc/math.h" 3
int __fpclassify(double);
int __fpclassifyf(float);
int __fpclassifyl(long double);

static inline unsigned __FLOAT_BITS(float __f)
{
 union {float __f; unsigned __i;} __u;
 __u.__f = __f;
 return __u.__i;
}
static inline unsigned long long __DOUBLE_BITS(double __f)
{
 union {double __f; unsigned long long __i;} __u;
 __u.__f = __f;
 return __u.__i;
}
# 81 "/emsdk_portable/fastcomp/emscripten/system/include/libc/math.h" 3
int __signbit(double);
int __signbitf(float);
int __signbitl(long double);
# 96 "/emsdk_portable/fastcomp/emscripten/system/include/libc/math.h" 3
static inline int __islessf(float_t __x, float_t __y) { return !(( sizeof((__x)) == sizeof(float) ? (__FLOAT_BITS((__x)) & 0x7fffffff) > 0x7f800000 : sizeof((__x)) == sizeof(double) ? (__DOUBLE_BITS((__x)) & -1ULL>>1) > 0x7ffULL<<52 : __fpclassifyl((__x)) == 0) ? ((void)(__y),1) : ( sizeof((__y)) == sizeof(float) ? (__FLOAT_BITS((__y)) & 0x7fffffff) > 0x7f800000 : sizeof((__y)) == sizeof(double) ? (__DOUBLE_BITS((__y)) & -1ULL>>1) > 0x7ffULL<<52 : __fpclassifyl((__y)) == 0)) && __x < __y; }
static inline int __isless(double_t __x, double_t __y) { return !(( sizeof((__x)) == sizeof(float) ? (__FLOAT_BITS((__x)) & 0x7fffffff) > 0x7f800000 : sizeof((__x)) == sizeof(double) ? (__DOUBLE_BITS((__x)) & -1ULL>>1) > 0x7ffULL<<52 : __fpclassifyl((__x)) == 0) ? ((void)(__y),1) : ( sizeof((__y)) == sizeof(float) ? (__FLOAT_BITS((__y)) & 0x7fffffff) > 0x7f800000 : sizeof((__y)) == sizeof(double) ? (__DOUBLE_BITS((__y)) & -1ULL>>1) > 0x7ffULL<<52 : __fpclassifyl((__y)) == 0)) && __x < __y; }
static inline int __islessl(long double __x, long double __y) { return !(( sizeof((__x)) == sizeof(float) ? (__FLOAT_BITS((__x)) & 0x7fffffff) > 0x7f800000 : sizeof((__x)) == sizeof(double) ? (__DOUBLE_BITS((__x)) & -1ULL>>1) > 0x7ffULL<<52 : __fpclassifyl((__x)) == 0) ? ((void)(__y),1) : ( sizeof((__y)) == sizeof(float) ? (__FLOAT_BITS((__y)) & 0x7fffffff) > 0x7f800000 : sizeof((__y)) == sizeof(double) ? (__DOUBLE_BITS((__y)) & -1ULL>>1) > 0x7ffULL<<52 : __fpclassifyl((__y)) == 0)) && __x < __y; }
static inline int __islessequalf(float_t __x, float_t __y) { return !(( sizeof((__x)) == sizeof(float) ? (__FLOAT_BITS((__x)) & 0x7fffffff) > 0x7f800000 : sizeof((__x)) == sizeof(double) ? (__DOUBLE_BITS((__x)) & -1ULL>>1) > 0x7ffULL<<52 : __fpclassifyl((__x)) == 0) ? ((void)(__y),1) : ( sizeof((__y)) == sizeof(float) ? (__FLOAT_BITS((__y)) & 0x7fffffff) > 0x7f800000 : sizeof((__y)) == sizeof(double) ? (__DOUBLE_BITS((__y)) & -1ULL>>1) > 0x7ffULL<<52 : __fpclassifyl((__y)) == 0)) && __x <= __y; }
static inline int __islessequal(double_t __x, double_t __y) { return !(( sizeof((__x)) == sizeof(float) ? (__FLOAT_BITS((__x)) & 0x7fffffff) > 0x7f800000 : sizeof((__x)) == sizeof(double) ? (__DOUBLE_BITS((__x)) & -1ULL>>1) > 0x7ffULL<<52 : __fpclassifyl((__x)) == 0) ? ((void)(__y),1) : ( sizeof((__y)) == sizeof(float) ? (__FLOAT_BITS((__y)) & 0x7fffffff) > 0x7f800000 : sizeof((__y)) == sizeof(double) ? (__DOUBLE_BITS((__y)) & -1ULL>>1) > 0x7ffULL<<52 : __fpclassifyl((__y)) == 0)) && __x <= __y; }
static inline int __islessequall(long double __x, long double __y) { return !(( sizeof((__x)) == sizeof(float) ? (__FLOAT_BITS((__x)) & 0x7fffffff) > 0x7f800000 : sizeof((__x)) == sizeof(double) ? (__DOUBLE_BITS((__x)) & -1ULL>>1) > 0x7ffULL<<52 : __fpclassifyl((__x)) == 0) ? ((void)(__y),1) : ( sizeof((__y)) == sizeof(float) ? (__FLOAT_BITS((__y)) & 0x7fffffff) > 0x7f800000 : sizeof((__y)) == sizeof(double) ? (__DOUBLE_BITS((__y)) & -1ULL>>1) > 0x7ffULL<<52 : __fpclassifyl((__y)) == 0)) && __x <= __y; }
static inline int __islessgreaterf(float_t __x, float_t __y) { return !(( sizeof((__x)) == sizeof(float) ? (__FLOAT_BITS((__x)) & 0x7fffffff) > 0x7f800000 : sizeof((__x)) == sizeof(double) ? (__DOUBLE_BITS((__x)) & -1ULL>>1) > 0x7ffULL<<52 : __fpclassifyl((__x)) == 0) ? ((void)(__y),1) : ( sizeof((__y)) == sizeof(float) ? (__FLOAT_BITS((__y)) & 0x7fffffff) > 0x7f800000 : sizeof((__y)) == sizeof(double) ? (__DOUBLE_BITS((__y)) & -1ULL>>1) > 0x7ffULL<<52 : __fpclassifyl((__y)) == 0)) && __x != __y; }
static inline int __islessgreater(double_t __x, double_t __y) { return !(( sizeof((__x)) == sizeof(float) ? (__FLOAT_BITS((__x)) & 0x7fffffff) > 0x7f800000 : sizeof((__x)) == sizeof(double) ? (__DOUBLE_BITS((__x)) & -1ULL>>1) > 0x7ffULL<<52 : __fpclassifyl((__x)) == 0) ? ((void)(__y),1) : ( sizeof((__y)) == sizeof(float) ? (__FLOAT_BITS((__y)) & 0x7fffffff) > 0x7f800000 : sizeof((__y)) == sizeof(double) ? (__DOUBLE_BITS((__y)) & -1ULL>>1) > 0x7ffULL<<52 : __fpclassifyl((__y)) == 0)) && __x != __y; }
static inline int __islessgreaterl(long double __x, long double __y) { return !(( sizeof((__x)) == sizeof(float) ? (__FLOAT_BITS((__x)) & 0x7fffffff) > 0x7f800000 : sizeof((__x)) == sizeof(double) ? (__DOUBLE_BITS((__x)) & -1ULL>>1) > 0x7ffULL<<52 : __fpclassifyl((__x)) == 0) ? ((void)(__y),1) : ( sizeof((__y)) == sizeof(float) ? (__FLOAT_BITS((__y)) & 0x7fffffff) > 0x7f800000 : sizeof((__y)) == sizeof(double) ? (__DOUBLE_BITS((__y)) & -1ULL>>1) > 0x7ffULL<<52 : __fpclassifyl((__y)) == 0)) && __x != __y; }
static inline int __isgreaterf(float_t __x, float_t __y) { return !(( sizeof((__x)) == sizeof(float) ? (__FLOAT_BITS((__x)) & 0x7fffffff) > 0x7f800000 : sizeof((__x)) == sizeof(double) ? (__DOUBLE_BITS((__x)) & -1ULL>>1) > 0x7ffULL<<52 : __fpclassifyl((__x)) == 0) ? ((void)(__y),1) : ( sizeof((__y)) == sizeof(float) ? (__FLOAT_BITS((__y)) & 0x7fffffff) > 0x7f800000 : sizeof((__y)) == sizeof(double) ? (__DOUBLE_BITS((__y)) & -1ULL>>1) > 0x7ffULL<<52 : __fpclassifyl((__y)) == 0)) && __x > __y; }
static inline int __isgreater(double_t __x, double_t __y) { return !(( sizeof((__x)) == sizeof(float) ? (__FLOAT_BITS((__x)) & 0x7fffffff) > 0x7f800000 : sizeof((__x)) == sizeof(double) ? (__DOUBLE_BITS((__x)) & -1ULL>>1) > 0x7ffULL<<52 : __fpclassifyl((__x)) == 0) ? ((void)(__y),1) : ( sizeof((__y)) == sizeof(float) ? (__FLOAT_BITS((__y)) & 0x7fffffff) > 0x7f800000 : sizeof((__y)) == sizeof(double) ? (__DOUBLE_BITS((__y)) & -1ULL>>1) > 0x7ffULL<<52 : __fpclassifyl((__y)) == 0)) && __x > __y; }
static inline int __isgreaterl(long double __x, long double __y) { return !(( sizeof((__x)) == sizeof(float) ? (__FLOAT_BITS((__x)) & 0x7fffffff) > 0x7f800000 : sizeof((__x)) == sizeof(double) ? (__DOUBLE_BITS((__x)) & -1ULL>>1) > 0x7ffULL<<52 : __fpclassifyl((__x)) == 0) ? ((void)(__y),1) : ( sizeof((__y)) == sizeof(float) ? (__FLOAT_BITS((__y)) & 0x7fffffff) > 0x7f800000 : sizeof((__y)) == sizeof(double) ? (__DOUBLE_BITS((__y)) & -1ULL>>1) > 0x7ffULL<<52 : __fpclassifyl((__y)) == 0)) && __x > __y; }
static inline int __isgreaterequalf(float_t __x, float_t __y) { return !(( sizeof((__x)) == sizeof(float) ? (__FLOAT_BITS((__x)) & 0x7fffffff) > 0x7f800000 : sizeof((__x)) == sizeof(double) ? (__DOUBLE_BITS((__x)) & -1ULL>>1) > 0x7ffULL<<52 : __fpclassifyl((__x)) == 0) ? ((void)(__y),1) : ( sizeof((__y)) == sizeof(float) ? (__FLOAT_BITS((__y)) & 0x7fffffff) > 0x7f800000 : sizeof((__y)) == sizeof(double) ? (__DOUBLE_BITS((__y)) & -1ULL>>1) > 0x7ffULL<<52 : __fpclassifyl((__y)) == 0)) && __x >= __y; }
static inline int __isgreaterequal(double_t __x, double_t __y) { return !(( sizeof((__x)) == sizeof(float) ? (__FLOAT_BITS((__x)) & 0x7fffffff) > 0x7f800000 : sizeof((__x)) == sizeof(double) ? (__DOUBLE_BITS((__x)) & -1ULL>>1) > 0x7ffULL<<52 : __fpclassifyl((__x)) == 0) ? ((void)(__y),1) : ( sizeof((__y)) == sizeof(float) ? (__FLOAT_BITS((__y)) & 0x7fffffff) > 0x7f800000 : sizeof((__y)) == sizeof(double) ? (__DOUBLE_BITS((__y)) & -1ULL>>1) > 0x7ffULL<<52 : __fpclassifyl((__y)) == 0)) && __x >= __y; }
static inline int __isgreaterequall(long double __x, long double __y) { return !(( sizeof((__x)) == sizeof(float) ? (__FLOAT_BITS((__x)) & 0x7fffffff) > 0x7f800000 : sizeof((__x)) == sizeof(double) ? (__DOUBLE_BITS((__x)) & -1ULL>>1) > 0x7ffULL<<52 : __fpclassifyl((__x)) == 0) ? ((void)(__y),1) : ( sizeof((__y)) == sizeof(float) ? (__FLOAT_BITS((__y)) & 0x7fffffff) > 0x7f800000 : sizeof((__y)) == sizeof(double) ? (__DOUBLE_BITS((__y)) & -1ULL>>1) > 0x7ffULL<<52 : __fpclassifyl((__y)) == 0)) && __x >= __y; }
# 123 "/emsdk_portable/fastcomp/emscripten/system/include/libc/math.h" 3
double acos(double);
float acosf(float);
long double acosl(long double);

double acosh(double);
float acoshf(float);
long double acoshl(long double);

double asin(double);
float asinf(float);
long double asinl(long double);

double asinh(double);
float asinhf(float);
long double asinhl(long double);

double atan(double);
float atanf(float);
long double atanl(long double);

double atan2(double, double);
float atan2f(float, float);
long double atan2l(long double, long double);

double atanh(double);
float atanhf(float);
long double atanhl(long double);

double cbrt(double);
float cbrtf(float);
long double cbrtl(long double);

double ceil(double);
float ceilf(float);
long double ceill(long double);

double copysign(double, double);
float copysignf(float, float);
long double copysignl(long double, long double);

double cos(double);
float cosf(float);
long double cosl(long double);

double cosh(double);
float coshf(float);
long double coshl(long double);

double erf(double);
float erff(float);
long double erfl(long double);

double erfc(double);
float erfcf(float);
long double erfcl(long double);

double exp(double);
float expf(float);
long double expl(long double);

double exp2(double);
float exp2f(float);
long double exp2l(long double);

double expm1(double);
float expm1f(float);
long double expm1l(long double);

double fabs(double);
float fabsf(float);
long double fabsl(long double);

double fdim(double, double);
float fdimf(float, float);
long double fdiml(long double, long double);

double floor(double);
float floorf(float);
long double floorl(long double);

double fma(double, double, double);
float fmaf(float, float, float);
long double fmal(long double, long double, long double);

double fmax(double, double);
float fmaxf(float, float);
long double fmaxl(long double, long double);

double fmin(double, double);
float fminf(float, float);
long double fminl(long double, long double);

double fmod(double, double);
float fmodf(float, float);
long double fmodl(long double, long double);

double frexp(double, int *);
float frexpf(float, int *);
long double frexpl(long double, int *);

double hypot(double, double);
float hypotf(float, float);
long double hypotl(long double, long double);

int ilogb(double);
int ilogbf(float);
int ilogbl(long double);

double ldexp(double, int);
float ldexpf(float, int);
long double ldexpl(long double, int);

double lgamma(double);
float lgammaf(float);
long double lgammal(long double);

long long llrint(double);
long long llrintf(float);
long long llrintl(long double);

long long llround(double);
long long llroundf(float);
long long llroundl(long double);

double log(double);
float logf(float);
long double logl(long double);

double log10(double);
float log10f(float);
long double log10l(long double);

double log1p(double);
float log1pf(float);
long double log1pl(long double);

double log2(double);
float log2f(float);
long double log2l(long double);

double logb(double);
float logbf(float);
long double logbl(long double);

long lrint(double);
long lrintf(float);
long lrintl(long double);

long lround(double);
long lroundf(float);
long lroundl(long double);

double modf(double, double *);
float modff(float, float *);
long double modfl(long double, long double *);

double nan(const char *);
float nanf(const char *);
long double nanl(const char *);

double nearbyint(double);
float nearbyintf(float);
long double nearbyintl(long double);

double nextafter(double, double);
float nextafterf(float, float);
long double nextafterl(long double, long double);

double nexttoward(double, long double);
float nexttowardf(float, long double);
long double nexttowardl(long double, long double);

double pow(double, double);
float powf(float, float);
long double powl(long double, long double);

double remainder(double, double);
float remainderf(float, float);
long double remainderl(long double, long double);

double remquo(double, double, int *);
float remquof(float, float, int *);
long double remquol(long double, long double, int *);

double rint(double);
float rintf(float);
long double rintl(long double);

double round(double);
float roundf(float);
long double roundl(long double);

double scalbln(double, long);
float scalblnf(float, long);
long double scalblnl(long double, long);

double scalbn(double, int);
float scalbnf(float, int);
long double scalbnl(long double, int);

double sin(double);
float sinf(float);
long double sinl(long double);

double sinh(double);
float sinhf(float);
long double sinhl(long double);

double sqrt(double);
float sqrtf(float);
long double sqrtl(long double);

double tan(double);
float tanf(float);
long double tanl(long double);

double tanh(double);
float tanhf(float);
long double tanhl(long double);

double tgamma(double);
float tgammaf(float);
long double tgammal(long double);

double trunc(double);
float truncf(float);
long double truncl(long double);
# 372 "/emsdk_portable/fastcomp/emscripten/system/include/libc/math.h" 3
extern int signgam;

double j0(double);
double j1(double);
double jn(int, double);

double y0(double);
double y1(double);
double yn(int, double);





double drem(double, double);
float dremf(float, float);

int finite(double);
int finitef(float);

double scalb(double, double);
float scalbf(float, float);

double significand(double);
float significandf(float);

double lgamma_r(double, int*);
float lgammaf_r(float, int*);

float j0f(float);
float j1f(float);
float jnf(int, float);

float y0f(float);
float y1f(float);
float ynf(int, float);



long double lgammal_r(long double, int*);

void sincos(double, double*, double*);
void sincosf(float, float*, float*);
void sincosl(long double, long double*, long double*);

double exp10(double);
float exp10f(float);
long double exp10l(long double);

double pow10(double);
float pow10f(float);
long double pow10l(long double);
# 13 "/emsdk_portable/fastcomp/emscripten/system/include/compat/math.h" 2 3
# 52 "Zend/zend_portability.h" 2





# 1 "/emsdk_portable/fastcomp/emscripten/system/include/compat/stdarg.h" 1 3
# 14 "/emsdk_portable/fastcomp/emscripten/system/include/compat/stdarg.h" 3
# 1 "/emsdk_portable/fastcomp/emscripten/system/include/libc/stdarg.h" 1 3
# 10 "/emsdk_portable/fastcomp/emscripten/system/include/libc/stdarg.h" 3
# 1 "/emsdk_portable/fastcomp/emscripten/system/lib/libc/musl/arch/emscripten/bits/alltypes.h" 1 3
# 11 "/emsdk_portable/fastcomp/emscripten/system/include/libc/stdarg.h" 2 3
# 15 "/emsdk_portable/fastcomp/emscripten/system/include/compat/stdarg.h" 2 3
# 58 "Zend/zend_portability.h" 2



# 1 "/emsdk_portable/fastcomp/emscripten/system/include/libc/dlfcn.h" 1 3
# 22 "/emsdk_portable/fastcomp/emscripten/system/include/libc/dlfcn.h" 3
int dlclose(void *);
char *dlerror(void);
void *dlopen(const char *, int);
void *dlsym(void *restrict, const char *restrict);


typedef struct {
 const char *dli_fname;
 void *dli_fbase;
 const char *dli_sname;
 void *dli_saddr;
} Dl_info;
int dladdr(const void *, Dl_info *);
int dlinfo(void *, int, void *);
# 62 "Zend/zend_portability.h" 2


# 1 "/emsdk_portable/fastcomp/emscripten/system/include/libc/limits.h" 1 3







# 1 "/emsdk_portable/fastcomp/emscripten/system/lib/libc/musl/arch/emscripten/bits/limits.h" 1 3
# 9 "/emsdk_portable/fastcomp/emscripten/system/include/libc/limits.h" 2 3
# 65 "Zend/zend_portability.h" 2
# 74 "Zend/zend_portability.h"
# 1 "Zend/zend_range_check.h" 1
# 22 "Zend/zend_range_check.h"
# 1 "Zend/zend_long.h" 1
# 41 "Zend/zend_long.h"
typedef int32_t zend_long;
typedef uint32_t zend_ulong;
typedef int32_t zend_off_t;
# 117 "Zend/zend_long.h"
static const char long_min_digits[] = "2147483648";
# 23 "Zend/zend_range_check.h" 2
# 75 "Zend/zend_portability.h" 2
# 26 "Zend/zend_types.h" 2

# 1 "/emsdk_portable/fastcomp/emscripten/system/include/libc/stdbool.h" 1 3
# 28 "Zend/zend_types.h" 2
# 50 "Zend/zend_types.h"
typedef _Bool zend_bool;
typedef unsigned char zend_uchar;

typedef enum {
  SUCCESS = 0,
  FAILURE = -1,
} ZEND_RESULT_CODE;

typedef ZEND_RESULT_CODE zend_result;
# 74 "Zend/zend_types.h"
typedef intptr_t zend_intptr_t;
typedef uintptr_t zend_uintptr_t;
# 85 "Zend/zend_types.h"
typedef struct _zend_object_handlers zend_object_handlers;
typedef struct _zend_class_entry zend_class_entry;
typedef union _zend_function zend_function;
typedef struct _zend_execute_data zend_execute_data;

typedef struct _zval_struct zval;

typedef struct _zend_refcounted zend_refcounted;
typedef struct _zend_string zend_string;
typedef struct _zend_array zend_array;
typedef struct _zend_object zend_object;
typedef struct _zend_resource zend_resource;
typedef struct _zend_reference zend_reference;
typedef struct _zend_ast_ref zend_ast_ref;
typedef struct _zend_ast zend_ast;

typedef int (*compare_func_t)(const void *, const void *);
typedef void (*swap_func_t)(void *, void *);
typedef void (*sort_func_t)(void *, size_t, size_t, compare_func_t, swap_func_t);
typedef void (*dtor_func_t)(zval *pDest);
typedef void (*copy_ctor_func_t)(zval *pElement);
# 127 "Zend/zend_types.h"
typedef struct {



 void *ptr;
 uint32_t type_mask;

} zend_type;

typedef struct {
 uint32_t num_types;
 zend_type types[1];
} zend_type_list;
# 285 "Zend/zend_types.h"
typedef union _zend_value {
 zend_long lval;
 double dval;
 zend_refcounted *counted;
 zend_string *str;
 zend_array *arr;
 zend_object *obj;
 zend_resource *res;
 zend_reference *ref;
 zend_ast_ref *ast;
 zval *zv;
 void *ptr;
 zend_class_entry *ce;
 zend_function *func;
 struct {
  uint32_t w1;
  uint32_t w2;
 } ww;
} zend_value;

struct _zval_struct {
 zend_value value;
 union {
  uint32_t type_info;
  struct {
   zend_uchar type; zend_uchar type_flags; union { uint16_t extra; } u;





  } v;
 } u1;
 union {
  uint32_t next;
  uint32_t cache_slot;
  uint32_t opline_num;
  uint32_t lineno;
  uint32_t num_args;
  uint32_t fe_pos;
  uint32_t fe_iter_idx;
  uint32_t access_flags;
  uint32_t property_guard;
  uint32_t constant_flags;
  uint32_t extra;
 } u2;
};

typedef struct _zend_refcounted_h {
 uint32_t refcount;
 union {
  uint32_t type_info;
 } u;
} zend_refcounted_h;

struct _zend_refcounted {
 zend_refcounted_h gc;
};

struct _zend_string {
 zend_refcounted_h gc;
 zend_ulong h;
 size_t len;
 char val[1];
};

typedef struct _Bucket {
 zval val;
 zend_ulong h;
 zend_string *key;
} Bucket;

typedef struct _zend_array HashTable;

struct _zend_array {
 zend_refcounted_h gc;
 union {
  struct {
   zend_uchar flags; zend_uchar _unused; zend_uchar nIteratorsCount; zend_uchar _unused2;




  } v;
  uint32_t flags;
 } u;
 uint32_t nTableMask;
 Bucket *arData;
 uint32_t nNumUsed;
 uint32_t nNumOfElements;
 uint32_t nTableSize;
 uint32_t nInternalPointer;
 zend_long nNextFreeElement;
 dtor_func_t pDestructor;
};
# 471 "Zend/zend_types.h"
typedef uint32_t HashPosition;

typedef struct _HashTableIterator {
 HashTable *ht;
 HashPosition pos;
} HashTableIterator;

struct _zend_object {
 zend_refcounted_h gc;
 uint32_t handle;
 zend_class_entry *ce;
 const zend_object_handlers *handlers;
 HashTable *properties;
 zval properties_table[1];
};

struct _zend_resource {
 zend_refcounted_h gc;
 int handle;
 int type;
 void *ptr;
};

typedef struct {
 size_t num;
 size_t num_allocated;
 struct _zend_property_info *ptr[1];
} zend_property_info_list;

typedef union {
 struct _zend_property_info *ptr;
 uintptr_t list;
} zend_property_info_source_list;





struct _zend_reference {
 zend_refcounted_h gc;
 zval val;
 zend_property_info_source_list sources;
};

struct _zend_ast_ref {
 zend_refcounted_h gc;

};
# 552 "Zend/zend_types.h"
static inline __attribute__((always_inline)) zend_uchar zval_get_type(const zval* pz) {
 return pz->u1.v.type;
}
# 623 "Zend/zend_types.h"
static inline __attribute__((always_inline)) zend_uchar zval_gc_type(uint32_t gc_type_info) {
 return (gc_type_info & 0x0000000f);
}

static inline __attribute__((always_inline)) uint32_t zval_gc_flags(uint32_t gc_type_info) {
 return (gc_type_info >> 0) & (0x000003f0 >> 0);
}

static inline __attribute__((always_inline)) uint32_t zval_gc_info(uint32_t gc_type_info) {
 return (gc_type_info >> 10);
}
# 1150 "Zend/zend_types.h"
static inline __attribute__((always_inline)) uint32_t zend_gc_refcount(const zend_refcounted_h *p) {
 return p->refcount;
}

static inline __attribute__((always_inline)) uint32_t zend_gc_set_refcount(zend_refcounted_h *p, uint32_t rc) {
 p->refcount = rc;
 return p->refcount;
}

static inline __attribute__((always_inline)) uint32_t zend_gc_addref(zend_refcounted_h *p) {
 do { } while (0);
 return ++(p->refcount);
}

static inline __attribute__((always_inline)) void zend_gc_try_addref(zend_refcounted_h *p) {
 if (!(p->u.type_info & (1<<6))) {
  do { } while (0);
  ++p->refcount;
 }
}

static inline __attribute__((always_inline)) uint32_t zend_gc_delref(zend_refcounted_h *p) {
 do { if (__builtin_expect(!(p->refcount > 0), 0)) __builtin_unreachable(); } while (0);
 do { } while (0);
 return --(p->refcount);
}

static inline __attribute__((always_inline)) uint32_t zend_gc_addref_ex(zend_refcounted_h *p, uint32_t rc) {
 do { } while (0);
 p->refcount += rc;
 return p->refcount;
}

static inline __attribute__((always_inline)) uint32_t zend_gc_delref_ex(zend_refcounted_h *p, uint32_t rc) {
 do { } while (0);
 p->refcount -= rc;
 return p->refcount;
}

static inline __attribute__((always_inline)) uint32_t zval_refcount_p(const zval* pz) {



 return zend_gc_refcount(&((*(pz)).value.counted)->gc);
}

static inline __attribute__((always_inline)) uint32_t zval_set_refcount_p(zval* pz, uint32_t rc) {
 do { if (__builtin_expect(!(((*(pz)).u1.v.type_flags != 0)), 0)) __builtin_unreachable(); } while (0);
 return zend_gc_set_refcount(&((*(pz)).value.counted)->gc, rc);
}

static inline __attribute__((always_inline)) uint32_t zval_addref_p(zval* pz) {
 do { if (__builtin_expect(!(((*(pz)).u1.v.type_flags != 0)), 0)) __builtin_unreachable(); } while (0);
 return zend_gc_addref(&((*(pz)).value.counted)->gc);
}

static inline __attribute__((always_inline)) uint32_t zval_delref_p(zval* pz) {
 do { if (__builtin_expect(!(((*(pz)).u1.v.type_flags != 0)), 0)) __builtin_unreachable(); } while (0);
 return zend_gc_delref(&((*(pz)).value.counted)->gc);
}
# 28 "Zend/zend.h" 2
# 1 "Zend/zend_map_ptr.h" 1
# 91 "Zend/zend_map_ptr.h"
__attribute__ ((visibility("default"))) void zend_map_ptr_reset(void);
__attribute__ ((visibility("default"))) void *zend_map_ptr_new(void);
__attribute__ ((visibility("default"))) void zend_map_ptr_extend(size_t last);
# 29 "Zend/zend.h" 2
# 1 "Zend/zend_errors.h" 1
# 30 "Zend/zend.h" 2
# 1 "Zend/zend_alloc.h" 1
# 27 "Zend/zend_alloc.h"
# 1 "Zend/zend.h" 1
# 28 "Zend/zend_alloc.h" 2
# 46 "Zend/zend_alloc.h"
typedef struct _zend_leak_info {
 void *addr;
 size_t size;
 const char *filename;
 const char *orig_filename;
 uint32_t lineno;
 uint32_t orig_lineno;
} zend_leak_info;
# 71 "Zend/zend_alloc.h"
__attribute__ ((visibility("default"))) char* zend_strndup(const char *s, size_t length) __attribute__ ((__malloc__));

__attribute__ ((visibility("default"))) void* _emalloc(size_t size ) __attribute__ ((__malloc__)) __attribute__ ((alloc_size(1)));
__attribute__ ((visibility("default"))) void* _safe_emalloc(size_t nmemb, size_t size, size_t offset ) __attribute__ ((__malloc__));
__attribute__ ((visibility("default"))) void* _safe_malloc(size_t nmemb, size_t size, size_t offset) __attribute__ ((__malloc__));
__attribute__ ((visibility("default"))) void _efree(void *ptr );
__attribute__ ((visibility("default"))) void* _ecalloc(size_t nmemb, size_t size ) __attribute__ ((__malloc__)) __attribute__ ((alloc_size(1,2)));
__attribute__ ((visibility("default"))) void* _erealloc(void *ptr, size_t size ) __attribute__ ((alloc_size(2)));
__attribute__ ((visibility("default"))) void* _erealloc2(void *ptr, size_t size, size_t copy_size ) __attribute__ ((alloc_size(2)));
__attribute__ ((visibility("default"))) void* _safe_erealloc(void *ptr, size_t nmemb, size_t size, size_t offset );
__attribute__ ((visibility("default"))) void* _safe_realloc(void *ptr, size_t nmemb, size_t size, size_t offset);
__attribute__ ((visibility("default"))) char* _estrdup(const char *s ) __attribute__ ((__malloc__));
__attribute__ ((visibility("default"))) char* _estrndup(const char *s, size_t length ) __attribute__ ((__malloc__));
__attribute__ ((visibility("default"))) size_t _zend_mem_block_size(void *ptr );


# 1 "Zend/zend_alloc_sizes.h" 1
# 87 "Zend/zend_alloc.h" 2







__attribute__ ((visibility("default"))) void* _emalloc_8(void) __attribute__ ((__malloc__)); __attribute__ ((visibility("default"))) void* _emalloc_16(void) __attribute__ ((__malloc__)); __attribute__ ((visibility("default"))) void* _emalloc_24(void) __attribute__ ((__malloc__)); __attribute__ ((visibility("default"))) void* _emalloc_32(void) __attribute__ ((__malloc__)); __attribute__ ((visibility("default"))) void* _emalloc_40(void) __attribute__ ((__malloc__)); __attribute__ ((visibility("default"))) void* _emalloc_48(void) __attribute__ ((__malloc__)); __attribute__ ((visibility("default"))) void* _emalloc_56(void) __attribute__ ((__malloc__)); __attribute__ ((visibility("default"))) void* _emalloc_64(void) __attribute__ ((__malloc__)); __attribute__ ((visibility("default"))) void* _emalloc_80(void) __attribute__ ((__malloc__)); __attribute__ ((visibility("default"))) void* _emalloc_96(void) __attribute__ ((__malloc__)); __attribute__ ((visibility("default"))) void* _emalloc_112(void) __attribute__ ((__malloc__)); __attribute__ ((visibility("default"))) void* _emalloc_128(void) __attribute__ ((__malloc__)); __attribute__ ((visibility("default"))) void* _emalloc_160(void) __attribute__ ((__malloc__)); __attribute__ ((visibility("default"))) void* _emalloc_192(void) __attribute__ ((__malloc__)); __attribute__ ((visibility("default"))) void* _emalloc_224(void) __attribute__ ((__malloc__)); __attribute__ ((visibility("default"))) void* _emalloc_256(void) __attribute__ ((__malloc__)); __attribute__ ((visibility("default"))) void* _emalloc_320(void) __attribute__ ((__malloc__)); __attribute__ ((visibility("default"))) void* _emalloc_384(void) __attribute__ ((__malloc__)); __attribute__ ((visibility("default"))) void* _emalloc_448(void) __attribute__ ((__malloc__)); __attribute__ ((visibility("default"))) void* _emalloc_512(void) __attribute__ ((__malloc__)); __attribute__ ((visibility("default"))) void* _emalloc_640(void) __attribute__ ((__malloc__)); __attribute__ ((visibility("default"))) void* _emalloc_768(void) __attribute__ ((__malloc__)); __attribute__ ((visibility("default"))) void* _emalloc_896(void) __attribute__ ((__malloc__)); __attribute__ ((visibility("default"))) void* _emalloc_1024(void) __attribute__ ((__malloc__)); __attribute__ ((visibility("default"))) void* _emalloc_1280(void) __attribute__ ((__malloc__)); __attribute__ ((visibility("default"))) void* _emalloc_1536(void) __attribute__ ((__malloc__)); __attribute__ ((visibility("default"))) void* _emalloc_1792(void) __attribute__ ((__malloc__)); __attribute__ ((visibility("default"))) void* _emalloc_2048(void) __attribute__ ((__malloc__)); __attribute__ ((visibility("default"))) void* _emalloc_2560(void) __attribute__ ((__malloc__)); __attribute__ ((visibility("default"))) void* _emalloc_3072(void) __attribute__ ((__malloc__));

__attribute__ ((visibility("default"))) void* _emalloc_large(size_t size) __attribute__ ((__malloc__)) __attribute__ ((alloc_size(1)));
__attribute__ ((visibility("default"))) void* _emalloc_huge(size_t size) __attribute__ ((__malloc__)) __attribute__ ((alloc_size(1)));
# 119 "Zend/zend_alloc.h"
__attribute__ ((visibility("default"))) void _efree_8(void *); __attribute__ ((visibility("default"))) void _efree_16(void *); __attribute__ ((visibility("default"))) void _efree_24(void *); __attribute__ ((visibility("default"))) void _efree_32(void *); __attribute__ ((visibility("default"))) void _efree_40(void *); __attribute__ ((visibility("default"))) void _efree_48(void *); __attribute__ ((visibility("default"))) void _efree_56(void *); __attribute__ ((visibility("default"))) void _efree_64(void *); __attribute__ ((visibility("default"))) void _efree_80(void *); __attribute__ ((visibility("default"))) void _efree_96(void *); __attribute__ ((visibility("default"))) void _efree_112(void *); __attribute__ ((visibility("default"))) void _efree_128(void *); __attribute__ ((visibility("default"))) void _efree_160(void *); __attribute__ ((visibility("default"))) void _efree_192(void *); __attribute__ ((visibility("default"))) void _efree_224(void *); __attribute__ ((visibility("default"))) void _efree_256(void *); __attribute__ ((visibility("default"))) void _efree_320(void *); __attribute__ ((visibility("default"))) void _efree_384(void *); __attribute__ ((visibility("default"))) void _efree_448(void *); __attribute__ ((visibility("default"))) void _efree_512(void *); __attribute__ ((visibility("default"))) void _efree_640(void *); __attribute__ ((visibility("default"))) void _efree_768(void *); __attribute__ ((visibility("default"))) void _efree_896(void *); __attribute__ ((visibility("default"))) void _efree_1024(void *); __attribute__ ((visibility("default"))) void _efree_1280(void *); __attribute__ ((visibility("default"))) void _efree_1536(void *); __attribute__ ((visibility("default"))) void _efree_1792(void *); __attribute__ ((visibility("default"))) void _efree_2048(void *); __attribute__ ((visibility("default"))) void _efree_2560(void *); __attribute__ ((visibility("default"))) void _efree_3072(void *);

__attribute__ ((visibility("default"))) void _efree_large(void *, size_t size);
__attribute__ ((visibility("default"))) void _efree_huge(void *, size_t size);
# 188 "Zend/zend_alloc.h"
__attribute__ ((visibility("default"))) void * __zend_malloc(size_t len) __attribute__ ((__malloc__)) __attribute__ ((alloc_size(1)));
__attribute__ ((visibility("default"))) void * __zend_calloc(size_t nmemb, size_t len) __attribute__ ((__malloc__)) __attribute__ ((alloc_size(1,2)));
__attribute__ ((visibility("default"))) void * __zend_realloc(void *p, size_t len) __attribute__ ((alloc_size(2)));
# 222 "Zend/zend_alloc.h"
__attribute__ ((visibility("default"))) void zend_set_memory_limit(size_t memory_limit);
__attribute__ ((visibility("default"))) zend_result zend_set_memory_limit_ex(size_t memory_limit);

__attribute__ ((visibility("default"))) void start_memory_manager(void);
__attribute__ ((visibility("default"))) void shutdown_memory_manager(_Bool silent, _Bool full_shutdown);
__attribute__ ((visibility("default"))) _Bool is_zend_mm(void);
__attribute__ ((visibility("default"))) _Bool is_zend_ptr(const void *ptr);

__attribute__ ((visibility("default"))) size_t zend_memory_usage(_Bool real_usage);
__attribute__ ((visibility("default"))) size_t zend_memory_peak_usage(_Bool real_usage);
# 247 "Zend/zend_alloc.h"
typedef struct _zend_mm_heap zend_mm_heap;

__attribute__ ((visibility("default"))) zend_mm_heap *zend_mm_startup(void);
__attribute__ ((visibility("default"))) void zend_mm_shutdown(zend_mm_heap *heap, _Bool full_shutdown, _Bool silent);
__attribute__ ((visibility("default"))) void* _zend_mm_alloc(zend_mm_heap *heap, size_t size ) __attribute__ ((__malloc__));
__attribute__ ((visibility("default"))) void _zend_mm_free(zend_mm_heap *heap, void *p );
__attribute__ ((visibility("default"))) void* _zend_mm_realloc(zend_mm_heap *heap, void *p, size_t size );
__attribute__ ((visibility("default"))) void* _zend_mm_realloc2(zend_mm_heap *heap, void *p, size_t size, size_t copy_size );
__attribute__ ((visibility("default"))) size_t _zend_mm_block_size(zend_mm_heap *heap, void *p );
# 269 "Zend/zend_alloc.h"
__attribute__ ((visibility("default"))) zend_mm_heap *zend_mm_set_heap(zend_mm_heap *new_heap);
__attribute__ ((visibility("default"))) zend_mm_heap *zend_mm_get_heap(void);

__attribute__ ((visibility("default"))) size_t zend_mm_gc(zend_mm_heap *heap);





__attribute__ ((visibility("default"))) _Bool zend_mm_is_custom_heap(zend_mm_heap *new_heap);
__attribute__ ((visibility("default"))) void zend_mm_set_custom_handlers(zend_mm_heap *heap,
                                          void* (*_malloc)(size_t),
                                          void (*_free)(void*),
                                          void* (*_realloc)(void*, size_t));
__attribute__ ((visibility("default"))) void zend_mm_get_custom_handlers(zend_mm_heap *heap,
                                          void* (**_malloc)(size_t),
                                          void (**_free)(void*),
                                          void* (**_realloc)(void*, size_t));
# 295 "Zend/zend_alloc.h"
typedef struct _zend_mm_storage zend_mm_storage;

typedef void* (*zend_mm_chunk_alloc_t)(zend_mm_storage *storage, size_t size, size_t alignment);
typedef void (*zend_mm_chunk_free_t)(zend_mm_storage *storage, void *chunk, size_t size);
typedef _Bool (*zend_mm_chunk_truncate_t)(zend_mm_storage *storage, void *chunk, size_t old_size, size_t new_size);
typedef _Bool (*zend_mm_chunk_extend_t)(zend_mm_storage *storage, void *chunk, size_t old_size, size_t new_size);

typedef struct _zend_mm_handlers {
 zend_mm_chunk_alloc_t chunk_alloc;
 zend_mm_chunk_free_t chunk_free;
 zend_mm_chunk_truncate_t chunk_truncate;
 zend_mm_chunk_extend_t chunk_extend;
} zend_mm_handlers;

struct _zend_mm_storage {
 const zend_mm_handlers handlers;
 void *data;
};

__attribute__ ((visibility("default"))) zend_mm_storage *zend_mm_get_storage(zend_mm_heap *heap);
__attribute__ ((visibility("default"))) zend_mm_heap *zend_mm_startup_ex(const zend_mm_handlers *handlers, void *data, size_t data_size);
# 31 "Zend/zend.h" 2
# 1 "Zend/zend_llist.h" 1
# 23 "Zend/zend_llist.h"
typedef struct _zend_llist_element {
 struct _zend_llist_element *next;
 struct _zend_llist_element *prev;
 char data[1];
} zend_llist_element;

typedef void (*llist_dtor_func_t)(void *);
typedef int (*llist_compare_func_t)(const zend_llist_element **, const zend_llist_element **);
typedef void (*llist_apply_with_args_func_t)(void *data, int num_args, va_list args);
typedef void (*llist_apply_with_arg_func_t)(void *data, void *arg);
typedef void (*llist_apply_func_t)(void *);

typedef struct _zend_llist {
 zend_llist_element *head;
 zend_llist_element *tail;
 size_t count;
 size_t size;
 llist_dtor_func_t dtor;
 unsigned char persistent;
 zend_llist_element *traverse_ptr;
} zend_llist;

typedef zend_llist_element* zend_llist_position;


__attribute__ ((visibility("default"))) void zend_llist_init(zend_llist *l, size_t size, llist_dtor_func_t dtor, unsigned char persistent);
__attribute__ ((visibility("default"))) void zend_llist_add_element(zend_llist *l, const void *element);
__attribute__ ((visibility("default"))) void zend_llist_prepend_element(zend_llist *l, const void *element);
__attribute__ ((visibility("default"))) void zend_llist_del_element(zend_llist *l, void *element, int (*compare)(void *element1, void *element2));
__attribute__ ((visibility("default"))) void zend_llist_destroy(zend_llist *l);
__attribute__ ((visibility("default"))) void zend_llist_clean(zend_llist *l);
__attribute__ ((visibility("default"))) void zend_llist_remove_tail(zend_llist *l);
__attribute__ ((visibility("default"))) void zend_llist_copy(zend_llist *dst, zend_llist *src);
__attribute__ ((visibility("default"))) void zend_llist_apply(zend_llist *l, llist_apply_func_t func);
__attribute__ ((visibility("default"))) void zend_llist_apply_with_del(zend_llist *l, int (*func)(void *data));
__attribute__ ((visibility("default"))) void zend_llist_apply_with_argument(zend_llist *l, llist_apply_with_arg_func_t func, void *arg);
__attribute__ ((visibility("default"))) void zend_llist_apply_with_arguments(zend_llist *l, llist_apply_with_args_func_t func, int num_args, ...);
__attribute__ ((visibility("default"))) size_t zend_llist_count(zend_llist *l);
__attribute__ ((visibility("default"))) void zend_llist_sort(zend_llist *l, llist_compare_func_t comp_func);


__attribute__ ((visibility("default"))) void *zend_llist_get_first_ex(zend_llist *l, zend_llist_position *pos);
__attribute__ ((visibility("default"))) void *zend_llist_get_last_ex(zend_llist *l, zend_llist_position *pos);
__attribute__ ((visibility("default"))) void *zend_llist_get_next_ex(zend_llist *l, zend_llist_position *pos);
__attribute__ ((visibility("default"))) void *zend_llist_get_prev_ex(zend_llist *l, zend_llist_position *pos);
# 32 "Zend/zend.h" 2
# 1 "Zend/zend_string.h" 1
# 22 "Zend/zend_string.h"
# 1 "Zend/zend.h" 1
# 23 "Zend/zend_string.h" 2



typedef void (*zend_string_copy_storage_func_t)(void);
typedef zend_string *( *zend_new_interned_string_func_t)(zend_string *str);
typedef zend_string *( *zend_string_init_interned_func_t)(const char *str, size_t size, _Bool permanent);

__attribute__ ((visibility("default"))) extern zend_new_interned_string_func_t zend_new_interned_string;
__attribute__ ((visibility("default"))) extern zend_string_init_interned_func_t zend_string_init_interned;

__attribute__ ((visibility("default"))) zend_ulong zend_string_hash_func(zend_string *str);
__attribute__ ((visibility("default"))) zend_ulong zend_hash_func(const char *str, size_t len);
__attribute__ ((visibility("default"))) zend_string* zend_interned_string_find_permanent(zend_string *str);

__attribute__ ((visibility("default"))) zend_string *zend_string_concat2(
 const char *str1, size_t str1_len,
 const char *str2, size_t str2_len);
__attribute__ ((visibility("default"))) zend_string *zend_string_concat3(
 const char *str1, size_t str1_len,
 const char *str2, size_t str2_len,
 const char *str3, size_t str3_len);

__attribute__ ((visibility("default"))) void zend_interned_strings_init(void);
__attribute__ ((visibility("default"))) void zend_interned_strings_dtor(void);
__attribute__ ((visibility("default"))) void zend_interned_strings_activate(void);
__attribute__ ((visibility("default"))) void zend_interned_strings_deactivate(void);
__attribute__ ((visibility("default"))) void zend_interned_strings_set_request_storage_handlers(zend_new_interned_string_func_t handler, zend_string_init_interned_func_t init_handler);
__attribute__ ((visibility("default"))) void zend_interned_strings_switch_storage(zend_bool request);

__attribute__ ((visibility("default"))) extern zend_string *zend_empty_string;
__attribute__ ((visibility("default"))) extern zend_string *zend_one_char_string[256];
__attribute__ ((visibility("default"))) extern zend_string **zend_known_strings;
# 107 "Zend/zend_string.h"
static inline __attribute__((always_inline)) zend_ulong zend_string_hash_val(zend_string *s)
{
 return (s)->h ? (s)->h : zend_string_hash_func(s);
}

static inline __attribute__((always_inline)) void zend_string_forget_hash_val(zend_string *s)
{
 (s)->h = 0;
 do { (s)->gc.u.type_info &= ~(((1<<9)) << 0); } while (0);
}

static inline __attribute__((always_inline)) uint32_t zend_string_refcount(const zend_string *s)
{
 if (!(zval_gc_flags((s)->gc.u.type_info) & (1<<6))) {
  return zend_gc_refcount(&(s)->gc);
 }
 return 1;
}

static inline __attribute__((always_inline)) uint32_t zend_string_addref(zend_string *s)
{
 if (!(zval_gc_flags((s)->gc.u.type_info) & (1<<6))) {
  return zend_gc_addref(&(s)->gc);
 }
 return 1;
}

static inline __attribute__((always_inline)) uint32_t zend_string_delref(zend_string *s)
{
 if (!(zval_gc_flags((s)->gc.u.type_info) & (1<<6))) {
  return zend_gc_delref(&(s)->gc);
 }
 return 1;
}

static inline __attribute__((always_inline)) zend_string *zend_string_alloc(size_t len, _Bool persistent)
{
 zend_string *ret = (zend_string *)((persistent)?__zend_malloc(((((__builtin_offsetof(zend_string, val) + len + 1)) + 8 - 1) & ~(8 - 1))):(__builtin_constant_p((((((__builtin_offsetof(zend_string, val) + len + 1)) + 8 - 1) & ~(8 - 1)))) ? (((((((__builtin_offsetof(zend_string, val) + len + 1)) + 8 - 1) & ~(8 - 1))) <= 8) ? _emalloc_8() : (((((((__builtin_offsetof(zend_string, val) + len + 1)) + 8 - 1) & ~(8 - 1))) <= 16) ? _emalloc_16() : (((((((__builtin_offsetof(zend_string, val) + len + 1)) + 8 - 1) & ~(8 - 1))) <= 24) ? _emalloc_24() : (((((((__builtin_offsetof(zend_string, val) + len + 1)) + 8 - 1) & ~(8 - 1))) <= 32) ? _emalloc_32() : (((((((__builtin_offsetof(zend_string, val) + len + 1)) + 8 - 1) & ~(8 - 1))) <= 40) ? _emalloc_40() : (((((((__builtin_offsetof(zend_string, val) + len + 1)) + 8 - 1) & ~(8 - 1))) <= 48) ? _emalloc_48() : (((((((__builtin_offsetof(zend_string, val) + len + 1)) + 8 - 1) & ~(8 - 1))) <= 56) ? _emalloc_56() : (((((((__builtin_offsetof(zend_string, val) + len + 1)) + 8 - 1) & ~(8 - 1))) <= 64) ? _emalloc_64() : (((((((__builtin_offsetof(zend_string, val) + len + 1)) + 8 - 1) & ~(8 - 1))) <= 80) ? _emalloc_80() : (((((((__builtin_offsetof(zend_string, val) + len + 1)) + 8 - 1) & ~(8 - 1))) <= 96) ? _emalloc_96() : (((((((__builtin_offsetof(zend_string, val) + len + 1)) + 8 - 1) & ~(8 - 1))) <= 112) ? _emalloc_112() : (((((((__builtin_offsetof(zend_string, val) + len + 1)) + 8 - 1) & ~(8 - 1))) <= 128) ? _emalloc_128() : (((((((__builtin_offsetof(zend_string, val) + len + 1)) + 8 - 1) & ~(8 - 1))) <= 160) ? _emalloc_160() : (((((((__builtin_offsetof(zend_string, val) + len + 1)) + 8 - 1) & ~(8 - 1))) <= 192) ? _emalloc_192() : (((((((__builtin_offsetof(zend_string, val) + len + 1)) + 8 - 1) & ~(8 - 1))) <= 224) ? _emalloc_224() : (((((((__builtin_offsetof(zend_string, val) + len + 1)) + 8 - 1) & ~(8 - 1))) <= 256) ? _emalloc_256() : (((((((__builtin_offsetof(zend_string, val) + len + 1)) + 8 - 1) & ~(8 - 1))) <= 320) ? _emalloc_320() : (((((((__builtin_offsetof(zend_string, val) + len + 1)) + 8 - 1) & ~(8 - 1))) <= 384) ? _emalloc_384() : (((((((__builtin_offsetof(zend_string, val) + len + 1)) + 8 - 1) & ~(8 - 1))) <= 448) ? _emalloc_448() : (((((((__builtin_offsetof(zend_string, val) + len + 1)) + 8 - 1) & ~(8 - 1))) <= 512) ? _emalloc_512() : (((((((__builtin_offsetof(zend_string, val) + len + 1)) + 8 - 1) & ~(8 - 1))) <= 640) ? _emalloc_640() : (((((((__builtin_offsetof(zend_string, val) + len + 1)) + 8 - 1) & ~(8 - 1))) <= 768) ? _emalloc_768() : (((((((__builtin_offsetof(zend_string, val) + len + 1)) + 8 - 1) & ~(8 - 1))) <= 896) ? _emalloc_896() : (((((((__builtin_offsetof(zend_string, val) + len + 1)) + 8 - 1) & ~(8 - 1))) <= 1024) ? _emalloc_1024() : (((((((__builtin_offsetof(zend_string, val) + len + 1)) + 8 - 1) & ~(8 - 1))) <= 1280) ? _emalloc_1280() : (((((((__builtin_offsetof(zend_string, val) + len + 1)) + 8 - 1) & ~(8 - 1))) <= 1536) ? _emalloc_1536() : (((((((__builtin_offsetof(zend_string, val) + len + 1)) + 8 - 1) & ~(8 - 1))) <= 1792) ? _emalloc_1792() : (((((((__builtin_offsetof(zend_string, val) + len + 1)) + 8 - 1) & ~(8 - 1))) <= 2048) ? _emalloc_2048() : (((((((__builtin_offsetof(zend_string, val) + len + 1)) + 8 - 1) & ~(8 - 1))) <= 2560) ? _emalloc_2560() : (((((((__builtin_offsetof(zend_string, val) + len + 1)) + 8 - 1) & ~(8 - 1))) <= 3072) ? _emalloc_3072() : (((((((__builtin_offsetof(zend_string, val) + len + 1)) + 8 - 1) & ~(8 - 1))) <= (((size_t) (2 * 1024 * 1024)) - ((4 * 1024) * (1)))) ? _emalloc_large((((((__builtin_offsetof(zend_string, val) + len + 1)) + 8 - 1) & ~(8 - 1)))) : _emalloc_huge((((((__builtin_offsetof(zend_string, val) + len + 1)) + 8 - 1) & ~(8 - 1))))) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) : _emalloc((((((__builtin_offsetof(zend_string, val) + len + 1)) + 8 - 1) & ~(8 - 1)))) ));

 zend_gc_set_refcount(&(ret)->gc, 1);
 (ret)->gc.u.type_info = (6 | ((1<<4) << 0)) | ((persistent ? (1<<7) : 0) << 0);
 (ret)->h = 0;
 (ret)->len = len;
 return ret;
}

static inline __attribute__((always_inline)) zend_string *zend_string_safe_alloc(size_t n, size_t m, size_t l, _Bool persistent)
{
 zend_string *ret = (zend_string *)((persistent)?_safe_malloc(n, m, ((((__builtin_offsetof(zend_string, val) + l + 1)) + 8 - 1) & ~(8 - 1))):_safe_emalloc((n), (m), (((((__builtin_offsetof(zend_string, val) + l + 1)) + 8 - 1) & ~(8 - 1))) ));

 zend_gc_set_refcount(&(ret)->gc, 1);
 (ret)->gc.u.type_info = (6 | ((1<<4) << 0)) | ((persistent ? (1<<7) : 0) << 0);
 (ret)->h = 0;
 (ret)->len = (n * m) + l;
 return ret;
}

static inline __attribute__((always_inline)) zend_string *zend_string_init(const char *str, size_t len, _Bool persistent)
{
 zend_string *ret = zend_string_alloc(len, persistent);

 memcpy((ret)->val, str, len);
 (ret)->val[len] = '\0';
 return ret;
}

static inline __attribute__((always_inline)) zend_string *zend_string_init_fast(const char *str, size_t len)
{
 if (len > 1) {
  return zend_string_init(str, len, 0);
 } else if (len == 0) {
  return zend_empty_string;
 } else {
  return zend_one_char_string[(zend_uchar) *str];
 }
}

static inline __attribute__((always_inline)) zend_string *zend_string_copy(zend_string *s)
{
 if (!(zval_gc_flags((s)->gc.u.type_info) & (1<<6))) {
  zend_gc_addref(&(s)->gc);
 }
 return s;
}

static inline __attribute__((always_inline)) zend_string *zend_string_dup(zend_string *s, _Bool persistent)
{
 if ((zval_gc_flags((s)->gc.u.type_info) & (1<<6))) {
  return s;
 } else {
  return zend_string_init((s)->val, (s)->len, persistent);
 }
}

static inline __attribute__((always_inline)) zend_string *zend_string_separate(zend_string *s, _Bool persistent)
{
 if ((zval_gc_flags((s)->gc.u.type_info) & (1<<6)) || zend_gc_refcount(&(s)->gc) > 1) {
  if (!(zval_gc_flags((s)->gc.u.type_info) & (1<<6))) {
   zend_gc_delref(&(s)->gc);
  }
  return zend_string_init((s)->val, (s)->len, persistent);
 }

 zend_string_forget_hash_val(s);
 return s;
}

static inline __attribute__((always_inline)) zend_string *zend_string_realloc(zend_string *s, size_t len, _Bool persistent)
{
 zend_string *ret;

 if (!(zval_gc_flags((s)->gc.u.type_info) & (1<<6))) {
  if (__builtin_expect(!!(zend_gc_refcount(&(s)->gc) == 1), 1)) {
   ret = (zend_string *)((persistent)?__zend_realloc((s), (((((__builtin_offsetof(zend_string, val) + len + 1)) + 8 - 1) & ~(8 - 1)))):_erealloc(((s)), ((((((__builtin_offsetof(zend_string, val) + len + 1)) + 8 - 1) & ~(8 - 1)))) ));
   (ret)->len = len;
   zend_string_forget_hash_val(ret);
   return ret;
  }
 }
 ret = zend_string_alloc(len, persistent);
 memcpy((ret)->val, (s)->val, (((len)<((s)->len))?(len):((s)->len)) + 1);
 if (!(zval_gc_flags((s)->gc.u.type_info) & (1<<6))) {
  zend_gc_delref(&(s)->gc);
 }
 return ret;
}

static inline __attribute__((always_inline)) zend_string *zend_string_extend(zend_string *s, size_t len, _Bool persistent)
{
 zend_string *ret;

 do { if (__builtin_expect(!(len >= (s)->len), 0)) __builtin_unreachable(); } while (0);
 if (!(zval_gc_flags((s)->gc.u.type_info) & (1<<6))) {
  if (__builtin_expect(!!(zend_gc_refcount(&(s)->gc) == 1), 1)) {
   ret = (zend_string *)((persistent)?__zend_realloc((s), (((((__builtin_offsetof(zend_string, val) + len + 1)) + 8 - 1) & ~(8 - 1)))):_erealloc(((s)), ((((((__builtin_offsetof(zend_string, val) + len + 1)) + 8 - 1) & ~(8 - 1)))) ));
   (ret)->len = len;
   zend_string_forget_hash_val(ret);
   return ret;
  }
 }
 ret = zend_string_alloc(len, persistent);
 memcpy((ret)->val, (s)->val, (s)->len + 1);
 if (!(zval_gc_flags((s)->gc.u.type_info) & (1<<6))) {
  zend_gc_delref(&(s)->gc);
 }
 return ret;
}

static inline __attribute__((always_inline)) zend_string *zend_string_truncate(zend_string *s, size_t len, _Bool persistent)
{
 zend_string *ret;

 do { if (__builtin_expect(!(len <= (s)->len), 0)) __builtin_unreachable(); } while (0);
 if (!(zval_gc_flags((s)->gc.u.type_info) & (1<<6))) {
  if (__builtin_expect(!!(zend_gc_refcount(&(s)->gc) == 1), 1)) {
   ret = (zend_string *)((persistent)?__zend_realloc((s), (((((__builtin_offsetof(zend_string, val) + len + 1)) + 8 - 1) & ~(8 - 1)))):_erealloc(((s)), ((((((__builtin_offsetof(zend_string, val) + len + 1)) + 8 - 1) & ~(8 - 1)))) ));
   (ret)->len = len;
   zend_string_forget_hash_val(ret);
   return ret;
  }
 }
 ret = zend_string_alloc(len, persistent);
 memcpy((ret)->val, (s)->val, len + 1);
 if (!(zval_gc_flags((s)->gc.u.type_info) & (1<<6))) {
  zend_gc_delref(&(s)->gc);
 }
 return ret;
}

static inline __attribute__((always_inline)) zend_string *zend_string_safe_realloc(zend_string *s, size_t n, size_t m, size_t l, _Bool persistent)
{
 zend_string *ret;

 if (!(zval_gc_flags((s)->gc.u.type_info) & (1<<6))) {
  if (zend_gc_refcount(&(s)->gc) == 1) {
   ret = (zend_string *)((persistent)?_safe_realloc((s), (n), (m), (((((__builtin_offsetof(zend_string, val) + l + 1)) + 8 - 1) & ~(8 - 1)))):_safe_erealloc(((s)), ((n)), ((m)), ((((((__builtin_offsetof(zend_string, val) + l + 1)) + 8 - 1) & ~(8 - 1)))) ));
   (ret)->len = (n * m) + l;
   zend_string_forget_hash_val(ret);
   return ret;
  }
 }
 ret = zend_string_safe_alloc(n, m, l, persistent);
 memcpy((ret)->val, (s)->val, ((((n * m) + l)<((s)->len))?((n * m) + l):((s)->len)) + 1);
 if (!(zval_gc_flags((s)->gc.u.type_info) & (1<<6))) {
  zend_gc_delref(&(s)->gc);
 }
 return ret;
}

static inline __attribute__((always_inline)) void zend_string_free(zend_string *s)
{
 if (!(zval_gc_flags((s)->gc.u.type_info) & (1<<6))) {
  do { if (__builtin_expect(!(zend_gc_refcount(&(s)->gc) <= 1), 0)) __builtin_unreachable(); } while (0);
  ((zval_gc_flags((s)->gc.u.type_info) & (1<<7))?free(s):_efree((s) ));
 }
}

static inline __attribute__((always_inline)) void zend_string_efree(zend_string *s)
{
 do { if (__builtin_expect(!(!(zval_gc_flags((s)->gc.u.type_info) & (1<<6))), 0)) __builtin_unreachable(); } while (0);
 do { if (__builtin_expect(!(zend_gc_refcount(&(s)->gc) <= 1), 0)) __builtin_unreachable(); } while (0);
 do { if (__builtin_expect(!(!(zval_gc_flags((s)->gc.u.type_info) & (1<<7))), 0)) __builtin_unreachable(); } while (0);
 _efree((s) );
}

static inline __attribute__((always_inline)) void zend_string_release(zend_string *s)
{
 if (!(zval_gc_flags((s)->gc.u.type_info) & (1<<6))) {
  if (zend_gc_delref(&(s)->gc) == 0) {
   ((zval_gc_flags((s)->gc.u.type_info) & (1<<7))?free(s):_efree((s) ));
  }
 }
}

static inline __attribute__((always_inline)) void zend_string_release_ex(zend_string *s, _Bool persistent)
{
 if (!(zval_gc_flags((s)->gc.u.type_info) & (1<<6))) {
  if (zend_gc_delref(&(s)->gc) == 0) {
   if (persistent) {
    do { if (__builtin_expect(!(zval_gc_flags((s)->gc.u.type_info) & (1<<7)), 0)) __builtin_unreachable(); } while (0);
    free(s);
   } else {
    do { if (__builtin_expect(!(!(zval_gc_flags((s)->gc.u.type_info) & (1<<7))), 0)) __builtin_unreachable(); } while (0);
    _efree((s) );
   }
  }
 }
}






static inline __attribute__((always_inline)) zend_bool zend_string_equal_val(zend_string *s1, zend_string *s2)
{
 return !memcmp((s1)->val, (s2)->val, (s1)->len);
}


static inline __attribute__((always_inline)) zend_bool zend_string_equal_content(zend_string *s1, zend_string *s2)
{
 return (s1)->len == (s2)->len && zend_string_equal_val(s1, s2);
}

static inline __attribute__((always_inline)) zend_bool zend_string_equals(zend_string *s1, zend_string *s2)
{
 return s1 == s2 || zend_string_equal_content(s1, s2);
}
# 399 "Zend/zend_string.h"
static inline __attribute__((always_inline)) zend_ulong zend_inline_hash_func(const char *str, size_t len)
{
 zend_ulong hash = 5381U;
# 467 "Zend/zend_string.h"
 for (; len >= 8; len -= 8) {
  hash = ((hash << 5) + hash) + *str++;
  hash = ((hash << 5) + hash) + *str++;
  hash = ((hash << 5) + hash) + *str++;
  hash = ((hash << 5) + hash) + *str++;
  hash = ((hash << 5) + hash) + *str++;
  hash = ((hash << 5) + hash) + *str++;
  hash = ((hash << 5) + hash) + *str++;
  hash = ((hash << 5) + hash) + *str++;
 }
 switch (len) {
  case 7: hash = ((hash << 5) + hash) + *str++;
  case 6: hash = ((hash << 5) + hash) + *str++;
  case 5: hash = ((hash << 5) + hash) + *str++;
  case 4: hash = ((hash << 5) + hash) + *str++;
  case 3: hash = ((hash << 5) + hash) + *str++;
  case 2: hash = ((hash << 5) + hash) + *str++;
  case 1: hash = ((hash << 5) + hash) + *str++; break;
  case 0: break;
default: do { if (__builtin_expect(!(0), 0)) __builtin_unreachable(); } while (0); break;
 }






 return hash | 0x80000000U;



}
# 559 "Zend/zend_string.h"
typedef enum _zend_known_string_id {

ZEND_STR_FILE, ZEND_STR_LINE, ZEND_STR_FUNCTION, ZEND_STR_CLASS, ZEND_STR_OBJECT, ZEND_STR_TYPE, ZEND_STR_OBJECT_OPERATOR, ZEND_STR_PAAMAYIM_NEKUDOTAYIM, ZEND_STR_ARGS, ZEND_STR_UNKNOWN, ZEND_STR_EVAL, ZEND_STR_INCLUDE, ZEND_STR_REQUIRE, ZEND_STR_INCLUDE_ONCE, ZEND_STR_REQUIRE_ONCE, ZEND_STR_SCALAR, ZEND_STR_ERROR_REPORTING, ZEND_STR_STATIC, ZEND_STR_THIS, ZEND_STR_VALUE, ZEND_STR_KEY, ZEND_STR_MAGIC_INVOKE, ZEND_STR_PREVIOUS, ZEND_STR_CODE, ZEND_STR_MESSAGE, ZEND_STR_SEVERITY, ZEND_STR_STRING, ZEND_STR_TRACE, ZEND_STR_SCHEME, ZEND_STR_HOST, ZEND_STR_PORT, ZEND_STR_USER, ZEND_STR_PASS, ZEND_STR_PATH, ZEND_STR_QUERY, ZEND_STR_FRAGMENT, ZEND_STR_NULL, ZEND_STR_BOOLEAN, ZEND_STR_INTEGER, ZEND_STR_DOUBLE, ZEND_STR_ARRAY, ZEND_STR_RESOURCE, ZEND_STR_CLOSED_RESOURCE, ZEND_STR_NAME, ZEND_STR_ARGV, ZEND_STR_ARGC, ZEND_STR_ARRAY_CAPITALIZED, ZEND_STR_BOOL, ZEND_STR_INT, ZEND_STR_FLOAT, ZEND_STR_CALLABLE, ZEND_STR_ITERABLE, ZEND_STR_VOID, ZEND_STR_FALSE, ZEND_STR_NULL_LOWERCASE, ZEND_STR_MIXED,

 ZEND_STR_LAST_KNOWN
} zend_known_string_id;
# 33 "Zend/zend.h" 2
# 1 "Zend/zend_hash.h" 1
# 24 "Zend/zend_hash.h"
# 1 "Zend/zend.h" 1
# 25 "Zend/zend_hash.h" 2
# 81 "Zend/zend_hash.h"
extern __attribute__ ((visibility("default"))) const HashTable zend_empty_array;
# 90 "Zend/zend_hash.h"
typedef struct _zend_hash_key {
 zend_ulong h;
 zend_string *key;
} zend_hash_key;

typedef zend_bool (*merge_checker_func_t)(HashTable *target_ht, zval *source_data, zend_hash_key *hash_key, void *pParam);




__attribute__ ((visibility("default"))) void _zend_hash_init(HashTable *ht, uint32_t nSize, dtor_func_t pDestructor, zend_bool persistent);
__attribute__ ((visibility("default"))) void zend_hash_destroy(HashTable *ht);
__attribute__ ((visibility("default"))) void zend_hash_clean(HashTable *ht);




__attribute__ ((visibility("default"))) void zend_hash_real_init(HashTable *ht, zend_bool packed);
__attribute__ ((visibility("default"))) void zend_hash_real_init_packed(HashTable *ht);
__attribute__ ((visibility("default"))) void zend_hash_real_init_mixed(HashTable *ht);
__attribute__ ((visibility("default"))) void zend_hash_packed_to_hash(HashTable *ht);
__attribute__ ((visibility("default"))) void zend_hash_to_packed(HashTable *ht);
__attribute__ ((visibility("default"))) void zend_hash_extend(HashTable *ht, uint32_t nSize, zend_bool packed);
__attribute__ ((visibility("default"))) void zend_hash_discard(HashTable *ht, uint32_t nNumUsed);


__attribute__ ((visibility("default"))) zval* zend_hash_add_or_update(HashTable *ht, zend_string *key, zval *pData, uint32_t flag);
__attribute__ ((visibility("default"))) zval* zend_hash_update(HashTable *ht, zend_string *key,zval *pData);
__attribute__ ((visibility("default"))) zval* zend_hash_update_ind(HashTable *ht, zend_string *key,zval *pData);
__attribute__ ((visibility("default"))) zval* zend_hash_add(HashTable *ht, zend_string *key,zval *pData);
__attribute__ ((visibility("default"))) zval* zend_hash_add_new(HashTable *ht, zend_string *key,zval *pData);

__attribute__ ((visibility("default"))) zval* zend_hash_str_add_or_update(HashTable *ht, const char *key, size_t len, zval *pData, uint32_t flag);
__attribute__ ((visibility("default"))) zval* zend_hash_str_update(HashTable *ht, const char *key, size_t len, zval *pData);
__attribute__ ((visibility("default"))) zval* zend_hash_str_update_ind(HashTable *ht, const char *key, size_t len, zval *pData);
__attribute__ ((visibility("default"))) zval* zend_hash_str_add(HashTable *ht, const char *key, size_t len, zval *pData);
__attribute__ ((visibility("default"))) zval* zend_hash_str_add_new(HashTable *ht, const char *key, size_t len, zval *pData);

__attribute__ ((visibility("default"))) zval* zend_hash_index_add_or_update(HashTable *ht, zend_ulong h, zval *pData, uint32_t flag);
__attribute__ ((visibility("default"))) zval* zend_hash_index_add(HashTable *ht, zend_ulong h, zval *pData);
__attribute__ ((visibility("default"))) zval* zend_hash_index_add_new(HashTable *ht, zend_ulong h, zval *pData);
__attribute__ ((visibility("default"))) zval* zend_hash_index_update(HashTable *ht, zend_ulong h, zval *pData);
__attribute__ ((visibility("default"))) zval* zend_hash_next_index_insert(HashTable *ht, zval *pData);
__attribute__ ((visibility("default"))) zval* zend_hash_next_index_insert_new(HashTable *ht, zval *pData);

__attribute__ ((visibility("default"))) zval* zend_hash_index_add_empty_element(HashTable *ht, zend_ulong h);
__attribute__ ((visibility("default"))) zval* zend_hash_add_empty_element(HashTable *ht, zend_string *key);
__attribute__ ((visibility("default"))) zval* zend_hash_str_add_empty_element(HashTable *ht, const char *key, size_t len);

__attribute__ ((visibility("default"))) zval* zend_hash_set_bucket_key(HashTable *ht, Bucket *p, zend_string *key);





typedef int (*apply_func_t)(zval *pDest);
typedef int (*apply_func_arg_t)(zval *pDest, void *argument);
typedef int (*apply_func_args_t)(zval *pDest, int num_args, va_list args, zend_hash_key *hash_key);

__attribute__ ((visibility("default"))) void zend_hash_graceful_destroy(HashTable *ht);
__attribute__ ((visibility("default"))) void zend_hash_graceful_reverse_destroy(HashTable *ht);
__attribute__ ((visibility("default"))) void zend_hash_apply(HashTable *ht, apply_func_t apply_func);
__attribute__ ((visibility("default"))) void zend_hash_apply_with_argument(HashTable *ht, apply_func_arg_t apply_func, void *);
__attribute__ ((visibility("default"))) void zend_hash_apply_with_arguments(HashTable *ht, apply_func_args_t apply_func, int, ...);







__attribute__ ((visibility("default"))) void zend_hash_reverse_apply(HashTable *ht, apply_func_t apply_func);



__attribute__ ((visibility("default"))) zend_result zend_hash_del(HashTable *ht, zend_string *key);
__attribute__ ((visibility("default"))) zend_result zend_hash_del_ind(HashTable *ht, zend_string *key);
__attribute__ ((visibility("default"))) zend_result zend_hash_str_del(HashTable *ht, const char *key, size_t len);
__attribute__ ((visibility("default"))) zend_result zend_hash_str_del_ind(HashTable *ht, const char *key, size_t len);
__attribute__ ((visibility("default"))) zend_result zend_hash_index_del(HashTable *ht, zend_ulong h);
__attribute__ ((visibility("default"))) void zend_hash_del_bucket(HashTable *ht, Bucket *p);


__attribute__ ((visibility("default"))) zval* zend_hash_find(const HashTable *ht, zend_string *key);
__attribute__ ((visibility("default"))) zval* zend_hash_str_find(const HashTable *ht, const char *key, size_t len);
__attribute__ ((visibility("default"))) zval* zend_hash_index_find(const HashTable *ht, zend_ulong h);
__attribute__ ((visibility("default"))) zval* _zend_hash_index_find(const HashTable *ht, zend_ulong h);


__attribute__ ((visibility("default"))) zval* _zend_hash_find_known_hash(const HashTable *ht, zend_string *key);

static inline __attribute__((always_inline)) zval *zend_hash_find_ex(const HashTable *ht, zend_string *key, zend_bool known_hash)
{
 if (known_hash) {
  return _zend_hash_find_known_hash(ht, key);
 } else {
  return zend_hash_find(ht, key);
 }
}
# 210 "Zend/zend_hash.h"
static inline __attribute__((always_inline)) zend_bool zend_hash_exists(const HashTable *ht, zend_string *key)
{
 return zend_hash_find(ht, key) != ((void*)0);
}

static inline __attribute__((always_inline)) zend_bool zend_hash_str_exists(const HashTable *ht, const char *str, size_t len)
{
 return zend_hash_str_find(ht, str, len) != ((void*)0);
}

static inline __attribute__((always_inline)) zend_bool zend_hash_index_exists(const HashTable *ht, zend_ulong h)
{
 return zend_hash_index_find(ht, h) != ((void*)0);
}


__attribute__ ((visibility("default"))) HashPosition zend_hash_get_current_pos(const HashTable *ht);



__attribute__ ((visibility("default"))) zend_result zend_hash_move_forward_ex(HashTable *ht, HashPosition *pos);
__attribute__ ((visibility("default"))) zend_result zend_hash_move_backwards_ex(HashTable *ht, HashPosition *pos);
__attribute__ ((visibility("default"))) int zend_hash_get_current_key_ex(const HashTable *ht, zend_string **str_index, zend_ulong *num_index, HashPosition *pos);
__attribute__ ((visibility("default"))) void zend_hash_get_current_key_zval_ex(const HashTable *ht, zval *key, HashPosition *pos);
__attribute__ ((visibility("default"))) int zend_hash_get_current_key_type_ex(HashTable *ht, HashPosition *pos);
__attribute__ ((visibility("default"))) zval* zend_hash_get_current_data_ex(HashTable *ht, HashPosition *pos);
__attribute__ ((visibility("default"))) void zend_hash_internal_pointer_reset_ex(HashTable *ht, HashPosition *pos);
__attribute__ ((visibility("default"))) void zend_hash_internal_pointer_end_ex(HashTable *ht, HashPosition *pos);
# 259 "Zend/zend_hash.h"
__attribute__ ((visibility("default"))) void zend_hash_copy(HashTable *target, HashTable *source, copy_ctor_func_t pCopyConstructor);
__attribute__ ((visibility("default"))) void zend_hash_merge(HashTable *target, HashTable *source, copy_ctor_func_t pCopyConstructor, zend_bool overwrite);
__attribute__ ((visibility("default"))) void zend_hash_merge_ex(HashTable *target, HashTable *source, copy_ctor_func_t pCopyConstructor, merge_checker_func_t pMergeSource, void *pParam);
__attribute__ ((visibility("default"))) void zend_hash_bucket_swap(Bucket *p, Bucket *q);
__attribute__ ((visibility("default"))) void zend_hash_bucket_renum_swap(Bucket *p, Bucket *q);
__attribute__ ((visibility("default"))) void zend_hash_bucket_packed_swap(Bucket *p, Bucket *q);

typedef int (*bucket_compare_func_t)(Bucket *a, Bucket *b);
__attribute__ ((visibility("default"))) int zend_hash_compare(HashTable *ht1, HashTable *ht2, compare_func_t compar, zend_bool ordered);
__attribute__ ((visibility("default"))) void zend_hash_sort_ex(HashTable *ht, sort_func_t sort_func, bucket_compare_func_t compare_func, zend_bool renumber);
__attribute__ ((visibility("default"))) zval* zend_hash_minmax(const HashTable *ht, bucket_compare_func_t compar, uint32_t flag);
# 280 "Zend/zend_hash.h"
__attribute__ ((visibility("default"))) void zend_hash_rehash(HashTable *ht);
# 298 "Zend/zend_hash.h"
__attribute__ ((visibility("default"))) HashTable* _zend_new_array_0(void);
__attribute__ ((visibility("default"))) HashTable* _zend_new_array(uint32_t size);
__attribute__ ((visibility("default"))) HashTable* zend_new_pair(zval *val1, zval *val2);
__attribute__ ((visibility("default"))) uint32_t zend_array_count(HashTable *ht);
__attribute__ ((visibility("default"))) HashTable* zend_array_dup(HashTable *source);
__attribute__ ((visibility("default"))) void zend_array_destroy(HashTable *ht);
__attribute__ ((visibility("default"))) void zend_symtable_clean(HashTable *ht);
__attribute__ ((visibility("default"))) HashTable* zend_symtable_to_proptable(HashTable *ht);
__attribute__ ((visibility("default"))) HashTable* zend_proptable_to_symtable(HashTable *ht, zend_bool always_duplicate);

__attribute__ ((visibility("default"))) _Bool _zend_handle_numeric_str_ex(const char *key, size_t length, zend_ulong *idx);

__attribute__ ((visibility("default"))) uint32_t zend_hash_iterator_add(HashTable *ht, HashPosition pos);
__attribute__ ((visibility("default"))) HashPosition zend_hash_iterator_pos(uint32_t idx, HashTable *ht);
__attribute__ ((visibility("default"))) HashPosition zend_hash_iterator_pos_ex(uint32_t idx, zval *array);
__attribute__ ((visibility("default"))) void zend_hash_iterator_del(uint32_t idx);
__attribute__ ((visibility("default"))) HashPosition zend_hash_iterators_lower_pos(HashTable *ht, HashPosition start);
__attribute__ ((visibility("default"))) void _zend_hash_iterators_update(HashTable *ht, HashPosition from, HashPosition to);
__attribute__ ((visibility("default"))) void zend_hash_iterators_advance(HashTable *ht, HashPosition step);

static inline __attribute__((always_inline)) void zend_hash_iterators_update(HashTable *ht, HashPosition from, HashPosition to)
{
 if (__builtin_expect(!!(((ht)->u.v.nIteratorsCount != 0)), 0)) {
  _zend_hash_iterators_update(ht, from, to);
 }
}


static inline __attribute__((always_inline)) void zend_array_release(zend_array *array)
{
 if (!(zval_gc_flags((array)->gc.u.type_info) & (1<<6))) {
  if (zend_gc_delref(&(array)->gc) == 0) {
   zend_array_destroy(array);
  }
 }
}


static inline __attribute__((always_inline)) void zend_hash_release(zend_array *array)
{
 if (!(zval_gc_flags((array)->gc.u.type_info) & (1<<6))) {
  if (zend_gc_delref(&(array)->gc) == 0) {
   zend_hash_destroy(array);
   ((zval_gc_flags((array)->gc.u.type_info) & (1<<7))?free(array):_efree((array) ));
  }
 }
}
# 354 "Zend/zend_hash.h"
static inline __attribute__((always_inline)) _Bool _zend_handle_numeric_str(const char *key, size_t length, zend_ulong *idx)
{
 const char *tmp = key;

 if (__builtin_expect(!!(*tmp > '9'), 1)) {
  return 0;
 } else if (*tmp < '0') {
  if (*tmp != '-') {
   return 0;
  }
  tmp++;
  if (*tmp > '9' || *tmp < '0') {
   return 0;
  }
 }
 return _zend_handle_numeric_str_ex(key, length, idx);
}
# 379 "Zend/zend_hash.h"
static inline __attribute__((always_inline)) zval *zend_hash_find_ind(const HashTable *ht, zend_string *key)
{
 zval *zv;

 zv = zend_hash_find(ht, key);
 return (zv && zval_get_type(&(*(zv))) == 12) ?
  ((zval_get_type(&(*((*(zv)).value.zv))) != 0) ? (*(zv)).value.zv : ((void*)0)) : zv;
}


static inline __attribute__((always_inline)) zval *zend_hash_find_ex_ind(const HashTable *ht, zend_string *key, zend_bool known_hash)
{
 zval *zv;

 zv = zend_hash_find_ex(ht, key, known_hash);
 return (zv && zval_get_type(&(*(zv))) == 12) ?
  ((zval_get_type(&(*((*(zv)).value.zv))) != 0) ? (*(zv)).value.zv : ((void*)0)) : zv;
}


static inline __attribute__((always_inline)) _Bool zend_hash_exists_ind(const HashTable *ht, zend_string *key)
{
 zval *zv;

 zv = zend_hash_find(ht, key);
 return zv && (zval_get_type(&(*(zv))) != 12 ||
   zval_get_type(&(*((*(zv)).value.zv))) != 0);
}


static inline __attribute__((always_inline)) zval *zend_hash_str_find_ind(const HashTable *ht, const char *str, size_t len)
{
 zval *zv;

 zv = zend_hash_str_find(ht, str, len);
 return (zv && zval_get_type(&(*(zv))) == 12) ?
  ((zval_get_type(&(*((*(zv)).value.zv))) != 0) ? (*(zv)).value.zv : ((void*)0)) : zv;
}


static inline __attribute__((always_inline)) _Bool zend_hash_str_exists_ind(const HashTable *ht, const char *str, size_t len)
{
 zval *zv;

 zv = zend_hash_str_find(ht, str, len);
 return zv && (zval_get_type(&(*(zv))) != 12 ||
   zval_get_type(&(*((*(zv)).value.zv))) != 0);
}

static inline __attribute__((always_inline)) zval *zend_symtable_add_new(HashTable *ht, zend_string *key, zval *pData)
{
 zend_ulong idx;

 if (_zend_handle_numeric_str((key)->val, (key)->len, &idx)) {
  return zend_hash_index_add_new(ht, idx, pData);
 } else {
  return zend_hash_add_new(ht, key, pData);
 }
}

static inline __attribute__((always_inline)) zval *zend_symtable_update(HashTable *ht, zend_string *key, zval *pData)
{
 zend_ulong idx;

 if (_zend_handle_numeric_str((key)->val, (key)->len, &idx)) {
  return zend_hash_index_update(ht, idx, pData);
 } else {
  return zend_hash_update(ht, key, pData);
 }
}


static inline __attribute__((always_inline)) zval *zend_symtable_update_ind(HashTable *ht, zend_string *key, zval *pData)
{
 zend_ulong idx;

 if (_zend_handle_numeric_str((key)->val, (key)->len, &idx)) {
  return zend_hash_index_update(ht, idx, pData);
 } else {
  return zend_hash_update_ind(ht, key, pData);
 }
}


static inline __attribute__((always_inline)) zend_result zend_symtable_del(HashTable *ht, zend_string *key)
{
 zend_ulong idx;

 if (_zend_handle_numeric_str((key)->val, (key)->len, &idx)) {
  return zend_hash_index_del(ht, idx);
 } else {
  return zend_hash_del(ht, key);
 }
}


static inline __attribute__((always_inline)) zend_result zend_symtable_del_ind(HashTable *ht, zend_string *key)
{
 zend_ulong idx;

 if (_zend_handle_numeric_str((key)->val, (key)->len, &idx)) {
  return zend_hash_index_del(ht, idx);
 } else {
  return zend_hash_del_ind(ht, key);
 }
}


static inline __attribute__((always_inline)) zval *zend_symtable_find(const HashTable *ht, zend_string *key)
{
 zend_ulong idx;

 if (_zend_handle_numeric_str((key)->val, (key)->len, &idx)) {
  return zend_hash_index_find(ht, idx);
 } else {
  return zend_hash_find(ht, key);
 }
}


static inline __attribute__((always_inline)) zval *zend_symtable_find_ind(const HashTable *ht, zend_string *key)
{
 zend_ulong idx;

 if (_zend_handle_numeric_str((key)->val, (key)->len, &idx)) {
  return zend_hash_index_find(ht, idx);
 } else {
  return zend_hash_find_ind(ht, key);
 }
}


static inline __attribute__((always_inline)) _Bool zend_symtable_exists(HashTable *ht, zend_string *key)
{
 zend_ulong idx;

 if (_zend_handle_numeric_str((key)->val, (key)->len, &idx)) {
  return zend_hash_index_exists(ht, idx);
 } else {
  return zend_hash_exists(ht, key);
 }
}


static inline __attribute__((always_inline)) _Bool zend_symtable_exists_ind(HashTable *ht, zend_string *key)
{
 zend_ulong idx;

 if (_zend_handle_numeric_str((key)->val, (key)->len, &idx)) {
  return zend_hash_index_exists(ht, idx);
 } else {
  return zend_hash_exists_ind(ht, key);
 }
}


static inline __attribute__((always_inline)) zval *zend_symtable_str_update(HashTable *ht, const char *str, size_t len, zval *pData)
{
 zend_ulong idx;

 if (_zend_handle_numeric_str(str, len, &idx)) {
  return zend_hash_index_update(ht, idx, pData);
 } else {
  return zend_hash_str_update(ht, str, len, pData);
 }
}


static inline __attribute__((always_inline)) zval *zend_symtable_str_update_ind(HashTable *ht, const char *str, size_t len, zval *pData)
{
 zend_ulong idx;

 if (_zend_handle_numeric_str(str, len, &idx)) {
  return zend_hash_index_update(ht, idx, pData);
 } else {
  return zend_hash_str_update_ind(ht, str, len, pData);
 }
}


static inline __attribute__((always_inline)) zend_result zend_symtable_str_del(HashTable *ht, const char *str, size_t len)
{
 zend_ulong idx;

 if (_zend_handle_numeric_str(str, len, &idx)) {
  return zend_hash_index_del(ht, idx);
 } else {
  return zend_hash_str_del(ht, str, len);
 }
}


static inline __attribute__((always_inline)) zend_result zend_symtable_str_del_ind(HashTable *ht, const char *str, size_t len)
{
 zend_ulong idx;

 if (_zend_handle_numeric_str(str, len, &idx)) {
  return zend_hash_index_del(ht, idx);
 } else {
  return zend_hash_str_del_ind(ht, str, len);
 }
}


static inline __attribute__((always_inline)) zval *zend_symtable_str_find(HashTable *ht, const char *str, size_t len)
{
 zend_ulong idx;

 if (_zend_handle_numeric_str(str, len, &idx)) {
  return zend_hash_index_find(ht, idx);
 } else {
  return zend_hash_str_find(ht, str, len);
 }
}


static inline __attribute__((always_inline)) _Bool zend_symtable_str_exists(HashTable *ht, const char *str, size_t len)
{
 zend_ulong idx;

 if (_zend_handle_numeric_str(str, len, &idx)) {
  return zend_hash_index_exists(ht, idx);
 } else {
  return zend_hash_str_exists(ht, str, len);
 }
}

static inline __attribute__((always_inline)) void *zend_hash_add_ptr(HashTable *ht, zend_string *key, void *pData)
{
 zval tmp, *zv;

 do { (*(&tmp)).value.ptr = (pData); (*(&tmp)).u1.type_info = 13; } while (0);
 zv = zend_hash_add(ht, key, &tmp);
 if (zv) {
  do { if (__builtin_expect(!((*(zv)).value.ptr), 0)) __builtin_unreachable(); } while (0);
  return (*(zv)).value.ptr;
 } else {
  return ((void*)0);
 }
}

static inline __attribute__((always_inline)) void *zend_hash_add_new_ptr(HashTable *ht, zend_string *key, void *pData)
{
 zval tmp, *zv;

 do { (*(&tmp)).value.ptr = (pData); (*(&tmp)).u1.type_info = 13; } while (0);
 zv = zend_hash_add_new(ht, key, &tmp);
 if (zv) {
  do { if (__builtin_expect(!((*(zv)).value.ptr), 0)) __builtin_unreachable(); } while (0);
  return (*(zv)).value.ptr;
 } else {
  return ((void*)0);
 }
}

static inline __attribute__((always_inline)) void *zend_hash_str_add_ptr(HashTable *ht, const char *str, size_t len, void *pData)
{
 zval tmp, *zv;

 do { (*(&tmp)).value.ptr = (pData); (*(&tmp)).u1.type_info = 13; } while (0);
 zv = zend_hash_str_add(ht, str, len, &tmp);
 if (zv) {
  do { if (__builtin_expect(!((*(zv)).value.ptr), 0)) __builtin_unreachable(); } while (0);
  return (*(zv)).value.ptr;
 } else {
  return ((void*)0);
 }
}

static inline __attribute__((always_inline)) void *zend_hash_str_add_new_ptr(HashTable *ht, const char *str, size_t len, void *pData)
{
 zval tmp, *zv;

 do { (*(&tmp)).value.ptr = (pData); (*(&tmp)).u1.type_info = 13; } while (0);
 zv = zend_hash_str_add_new(ht, str, len, &tmp);
 if (zv) {
  do { if (__builtin_expect(!((*(zv)).value.ptr), 0)) __builtin_unreachable(); } while (0);
  return (*(zv)).value.ptr;
 } else {
  return ((void*)0);
 }
}

static inline __attribute__((always_inline)) void *zend_hash_update_ptr(HashTable *ht, zend_string *key, void *pData)
{
 zval tmp, *zv;

 do { (*(&tmp)).value.ptr = (pData); (*(&tmp)).u1.type_info = 13; } while (0);
 zv = zend_hash_update(ht, key, &tmp);
 do { if (__builtin_expect(!((*(zv)).value.ptr), 0)) __builtin_unreachable(); } while (0);
 return (*(zv)).value.ptr;
}

static inline __attribute__((always_inline)) void *zend_hash_str_update_ptr(HashTable *ht, const char *str, size_t len, void *pData)
{
 zval tmp, *zv;

 do { (*(&tmp)).value.ptr = (pData); (*(&tmp)).u1.type_info = 13; } while (0);
 zv = zend_hash_str_update(ht, str, len, &tmp);
 do { if (__builtin_expect(!((*(zv)).value.ptr), 0)) __builtin_unreachable(); } while (0);
 return (*(zv)).value.ptr;
}

static inline __attribute__((always_inline)) void *zend_hash_add_mem(HashTable *ht, zend_string *key, void *pData, size_t size)
{
 zval tmp, *zv;

 do { (*(&tmp)).value.ptr = (((void*)0)); (*(&tmp)).u1.type_info = 13; } while (0);
 if ((zv = zend_hash_add(ht, key, &tmp))) {
  (*(zv)).value.ptr = ((zval_gc_flags((ht)->gc.u.type_info) & (1<<7))?__zend_malloc(size):(__builtin_constant_p((size)) ? (((size) <= 8) ? _emalloc_8() : (((size) <= 16) ? _emalloc_16() : (((size) <= 24) ? _emalloc_24() : (((size) <= 32) ? _emalloc_32() : (((size) <= 40) ? _emalloc_40() : (((size) <= 48) ? _emalloc_48() : (((size) <= 56) ? _emalloc_56() : (((size) <= 64) ? _emalloc_64() : (((size) <= 80) ? _emalloc_80() : (((size) <= 96) ? _emalloc_96() : (((size) <= 112) ? _emalloc_112() : (((size) <= 128) ? _emalloc_128() : (((size) <= 160) ? _emalloc_160() : (((size) <= 192) ? _emalloc_192() : (((size) <= 224) ? _emalloc_224() : (((size) <= 256) ? _emalloc_256() : (((size) <= 320) ? _emalloc_320() : (((size) <= 384) ? _emalloc_384() : (((size) <= 448) ? _emalloc_448() : (((size) <= 512) ? _emalloc_512() : (((size) <= 640) ? _emalloc_640() : (((size) <= 768) ? _emalloc_768() : (((size) <= 896) ? _emalloc_896() : (((size) <= 1024) ? _emalloc_1024() : (((size) <= 1280) ? _emalloc_1280() : (((size) <= 1536) ? _emalloc_1536() : (((size) <= 1792) ? _emalloc_1792() : (((size) <= 2048) ? _emalloc_2048() : (((size) <= 2560) ? _emalloc_2560() : (((size) <= 3072) ? _emalloc_3072() : (((size) <= (((size_t) (2 * 1024 * 1024)) - ((4 * 1024) * (1)))) ? _emalloc_large((size)) : _emalloc_huge((size))) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) : _emalloc((size)) ));
  memcpy((*(zv)).value.ptr, pData, size);
  return (*(zv)).value.ptr;
 }
 return ((void*)0);
}

static inline __attribute__((always_inline)) void *zend_hash_add_new_mem(HashTable *ht, zend_string *key, void *pData, size_t size)
{
 zval tmp, *zv;

 do { (*(&tmp)).value.ptr = (((void*)0)); (*(&tmp)).u1.type_info = 13; } while (0);
 if ((zv = zend_hash_add_new(ht, key, &tmp))) {
  (*(zv)).value.ptr = ((zval_gc_flags((ht)->gc.u.type_info) & (1<<7))?__zend_malloc(size):(__builtin_constant_p((size)) ? (((size) <= 8) ? _emalloc_8() : (((size) <= 16) ? _emalloc_16() : (((size) <= 24) ? _emalloc_24() : (((size) <= 32) ? _emalloc_32() : (((size) <= 40) ? _emalloc_40() : (((size) <= 48) ? _emalloc_48() : (((size) <= 56) ? _emalloc_56() : (((size) <= 64) ? _emalloc_64() : (((size) <= 80) ? _emalloc_80() : (((size) <= 96) ? _emalloc_96() : (((size) <= 112) ? _emalloc_112() : (((size) <= 128) ? _emalloc_128() : (((size) <= 160) ? _emalloc_160() : (((size) <= 192) ? _emalloc_192() : (((size) <= 224) ? _emalloc_224() : (((size) <= 256) ? _emalloc_256() : (((size) <= 320) ? _emalloc_320() : (((size) <= 384) ? _emalloc_384() : (((size) <= 448) ? _emalloc_448() : (((size) <= 512) ? _emalloc_512() : (((size) <= 640) ? _emalloc_640() : (((size) <= 768) ? _emalloc_768() : (((size) <= 896) ? _emalloc_896() : (((size) <= 1024) ? _emalloc_1024() : (((size) <= 1280) ? _emalloc_1280() : (((size) <= 1536) ? _emalloc_1536() : (((size) <= 1792) ? _emalloc_1792() : (((size) <= 2048) ? _emalloc_2048() : (((size) <= 2560) ? _emalloc_2560() : (((size) <= 3072) ? _emalloc_3072() : (((size) <= (((size_t) (2 * 1024 * 1024)) - ((4 * 1024) * (1)))) ? _emalloc_large((size)) : _emalloc_huge((size))) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) : _emalloc((size)) ));
  memcpy((*(zv)).value.ptr, pData, size);
  return (*(zv)).value.ptr;
 }
 return ((void*)0);
}

static inline __attribute__((always_inline)) void *zend_hash_str_add_mem(HashTable *ht, const char *str, size_t len, void *pData, size_t size)
{
 zval tmp, *zv;

 do { (*(&tmp)).value.ptr = (((void*)0)); (*(&tmp)).u1.type_info = 13; } while (0);
 if ((zv = zend_hash_str_add(ht, str, len, &tmp))) {
  (*(zv)).value.ptr = ((zval_gc_flags((ht)->gc.u.type_info) & (1<<7))?__zend_malloc(size):(__builtin_constant_p((size)) ? (((size) <= 8) ? _emalloc_8() : (((size) <= 16) ? _emalloc_16() : (((size) <= 24) ? _emalloc_24() : (((size) <= 32) ? _emalloc_32() : (((size) <= 40) ? _emalloc_40() : (((size) <= 48) ? _emalloc_48() : (((size) <= 56) ? _emalloc_56() : (((size) <= 64) ? _emalloc_64() : (((size) <= 80) ? _emalloc_80() : (((size) <= 96) ? _emalloc_96() : (((size) <= 112) ? _emalloc_112() : (((size) <= 128) ? _emalloc_128() : (((size) <= 160) ? _emalloc_160() : (((size) <= 192) ? _emalloc_192() : (((size) <= 224) ? _emalloc_224() : (((size) <= 256) ? _emalloc_256() : (((size) <= 320) ? _emalloc_320() : (((size) <= 384) ? _emalloc_384() : (((size) <= 448) ? _emalloc_448() : (((size) <= 512) ? _emalloc_512() : (((size) <= 640) ? _emalloc_640() : (((size) <= 768) ? _emalloc_768() : (((size) <= 896) ? _emalloc_896() : (((size) <= 1024) ? _emalloc_1024() : (((size) <= 1280) ? _emalloc_1280() : (((size) <= 1536) ? _emalloc_1536() : (((size) <= 1792) ? _emalloc_1792() : (((size) <= 2048) ? _emalloc_2048() : (((size) <= 2560) ? _emalloc_2560() : (((size) <= 3072) ? _emalloc_3072() : (((size) <= (((size_t) (2 * 1024 * 1024)) - ((4 * 1024) * (1)))) ? _emalloc_large((size)) : _emalloc_huge((size))) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) : _emalloc((size)) ));
  memcpy((*(zv)).value.ptr, pData, size);
  return (*(zv)).value.ptr;
 }
 return ((void*)0);
}

static inline __attribute__((always_inline)) void *zend_hash_str_add_new_mem(HashTable *ht, const char *str, size_t len, void *pData, size_t size)
{
 zval tmp, *zv;

 do { (*(&tmp)).value.ptr = (((void*)0)); (*(&tmp)).u1.type_info = 13; } while (0);
 if ((zv = zend_hash_str_add_new(ht, str, len, &tmp))) {
  (*(zv)).value.ptr = ((zval_gc_flags((ht)->gc.u.type_info) & (1<<7))?__zend_malloc(size):(__builtin_constant_p((size)) ? (((size) <= 8) ? _emalloc_8() : (((size) <= 16) ? _emalloc_16() : (((size) <= 24) ? _emalloc_24() : (((size) <= 32) ? _emalloc_32() : (((size) <= 40) ? _emalloc_40() : (((size) <= 48) ? _emalloc_48() : (((size) <= 56) ? _emalloc_56() : (((size) <= 64) ? _emalloc_64() : (((size) <= 80) ? _emalloc_80() : (((size) <= 96) ? _emalloc_96() : (((size) <= 112) ? _emalloc_112() : (((size) <= 128) ? _emalloc_128() : (((size) <= 160) ? _emalloc_160() : (((size) <= 192) ? _emalloc_192() : (((size) <= 224) ? _emalloc_224() : (((size) <= 256) ? _emalloc_256() : (((size) <= 320) ? _emalloc_320() : (((size) <= 384) ? _emalloc_384() : (((size) <= 448) ? _emalloc_448() : (((size) <= 512) ? _emalloc_512() : (((size) <= 640) ? _emalloc_640() : (((size) <= 768) ? _emalloc_768() : (((size) <= 896) ? _emalloc_896() : (((size) <= 1024) ? _emalloc_1024() : (((size) <= 1280) ? _emalloc_1280() : (((size) <= 1536) ? _emalloc_1536() : (((size) <= 1792) ? _emalloc_1792() : (((size) <= 2048) ? _emalloc_2048() : (((size) <= 2560) ? _emalloc_2560() : (((size) <= 3072) ? _emalloc_3072() : (((size) <= (((size_t) (2 * 1024 * 1024)) - ((4 * 1024) * (1)))) ? _emalloc_large((size)) : _emalloc_huge((size))) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) : _emalloc((size)) ));
  memcpy((*(zv)).value.ptr, pData, size);
  return (*(zv)).value.ptr;
 }
 return ((void*)0);
}

static inline __attribute__((always_inline)) void *zend_hash_update_mem(HashTable *ht, zend_string *key, void *pData, size_t size)
{
 void *p;

 p = ((zval_gc_flags((ht)->gc.u.type_info) & (1<<7))?__zend_malloc(size):(__builtin_constant_p((size)) ? (((size) <= 8) ? _emalloc_8() : (((size) <= 16) ? _emalloc_16() : (((size) <= 24) ? _emalloc_24() : (((size) <= 32) ? _emalloc_32() : (((size) <= 40) ? _emalloc_40() : (((size) <= 48) ? _emalloc_48() : (((size) <= 56) ? _emalloc_56() : (((size) <= 64) ? _emalloc_64() : (((size) <= 80) ? _emalloc_80() : (((size) <= 96) ? _emalloc_96() : (((size) <= 112) ? _emalloc_112() : (((size) <= 128) ? _emalloc_128() : (((size) <= 160) ? _emalloc_160() : (((size) <= 192) ? _emalloc_192() : (((size) <= 224) ? _emalloc_224() : (((size) <= 256) ? _emalloc_256() : (((size) <= 320) ? _emalloc_320() : (((size) <= 384) ? _emalloc_384() : (((size) <= 448) ? _emalloc_448() : (((size) <= 512) ? _emalloc_512() : (((size) <= 640) ? _emalloc_640() : (((size) <= 768) ? _emalloc_768() : (((size) <= 896) ? _emalloc_896() : (((size) <= 1024) ? _emalloc_1024() : (((size) <= 1280) ? _emalloc_1280() : (((size) <= 1536) ? _emalloc_1536() : (((size) <= 1792) ? _emalloc_1792() : (((size) <= 2048) ? _emalloc_2048() : (((size) <= 2560) ? _emalloc_2560() : (((size) <= 3072) ? _emalloc_3072() : (((size) <= (((size_t) (2 * 1024 * 1024)) - ((4 * 1024) * (1)))) ? _emalloc_large((size)) : _emalloc_huge((size))) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) : _emalloc((size)) ));
 memcpy(p, pData, size);
 return zend_hash_update_ptr(ht, key, p);
}

static inline __attribute__((always_inline)) void *zend_hash_str_update_mem(HashTable *ht, const char *str, size_t len, void *pData, size_t size)
{
 void *p;

 p = ((zval_gc_flags((ht)->gc.u.type_info) & (1<<7))?__zend_malloc(size):(__builtin_constant_p((size)) ? (((size) <= 8) ? _emalloc_8() : (((size) <= 16) ? _emalloc_16() : (((size) <= 24) ? _emalloc_24() : (((size) <= 32) ? _emalloc_32() : (((size) <= 40) ? _emalloc_40() : (((size) <= 48) ? _emalloc_48() : (((size) <= 56) ? _emalloc_56() : (((size) <= 64) ? _emalloc_64() : (((size) <= 80) ? _emalloc_80() : (((size) <= 96) ? _emalloc_96() : (((size) <= 112) ? _emalloc_112() : (((size) <= 128) ? _emalloc_128() : (((size) <= 160) ? _emalloc_160() : (((size) <= 192) ? _emalloc_192() : (((size) <= 224) ? _emalloc_224() : (((size) <= 256) ? _emalloc_256() : (((size) <= 320) ? _emalloc_320() : (((size) <= 384) ? _emalloc_384() : (((size) <= 448) ? _emalloc_448() : (((size) <= 512) ? _emalloc_512() : (((size) <= 640) ? _emalloc_640() : (((size) <= 768) ? _emalloc_768() : (((size) <= 896) ? _emalloc_896() : (((size) <= 1024) ? _emalloc_1024() : (((size) <= 1280) ? _emalloc_1280() : (((size) <= 1536) ? _emalloc_1536() : (((size) <= 1792) ? _emalloc_1792() : (((size) <= 2048) ? _emalloc_2048() : (((size) <= 2560) ? _emalloc_2560() : (((size) <= 3072) ? _emalloc_3072() : (((size) <= (((size_t) (2 * 1024 * 1024)) - ((4 * 1024) * (1)))) ? _emalloc_large((size)) : _emalloc_huge((size))) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) : _emalloc((size)) ));
 memcpy(p, pData, size);
 return zend_hash_str_update_ptr(ht, str, len, p);
}

static inline __attribute__((always_inline)) void *zend_hash_index_add_ptr(HashTable *ht, zend_ulong h, void *pData)
{
 zval tmp, *zv;

 do { (*(&tmp)).value.ptr = (pData); (*(&tmp)).u1.type_info = 13; } while (0);
 zv = zend_hash_index_add(ht, h, &tmp);
 return zv ? (*(zv)).value.ptr : ((void*)0);
}

static inline __attribute__((always_inline)) void *zend_hash_index_add_new_ptr(HashTable *ht, zend_ulong h, void *pData)
{
 zval tmp, *zv;

 do { (*(&tmp)).value.ptr = (pData); (*(&tmp)).u1.type_info = 13; } while (0);
 zv = zend_hash_index_add_new(ht, h, &tmp);
 return zv ? (*(zv)).value.ptr : ((void*)0);
}

static inline __attribute__((always_inline)) void *zend_hash_index_update_ptr(HashTable *ht, zend_ulong h, void *pData)
{
 zval tmp, *zv;

 do { (*(&tmp)).value.ptr = (pData); (*(&tmp)).u1.type_info = 13; } while (0);
 zv = zend_hash_index_update(ht, h, &tmp);
 do { if (__builtin_expect(!((*(zv)).value.ptr), 0)) __builtin_unreachable(); } while (0);
 return (*(zv)).value.ptr;
}

static inline __attribute__((always_inline)) void *zend_hash_index_add_mem(HashTable *ht, zend_ulong h, void *pData, size_t size)
{
 zval tmp, *zv;

 do { (*(&tmp)).value.ptr = (((void*)0)); (*(&tmp)).u1.type_info = 13; } while (0);
 if ((zv = zend_hash_index_add(ht, h, &tmp))) {
  (*(zv)).value.ptr = ((zval_gc_flags((ht)->gc.u.type_info) & (1<<7))?__zend_malloc(size):(__builtin_constant_p((size)) ? (((size) <= 8) ? _emalloc_8() : (((size) <= 16) ? _emalloc_16() : (((size) <= 24) ? _emalloc_24() : (((size) <= 32) ? _emalloc_32() : (((size) <= 40) ? _emalloc_40() : (((size) <= 48) ? _emalloc_48() : (((size) <= 56) ? _emalloc_56() : (((size) <= 64) ? _emalloc_64() : (((size) <= 80) ? _emalloc_80() : (((size) <= 96) ? _emalloc_96() : (((size) <= 112) ? _emalloc_112() : (((size) <= 128) ? _emalloc_128() : (((size) <= 160) ? _emalloc_160() : (((size) <= 192) ? _emalloc_192() : (((size) <= 224) ? _emalloc_224() : (((size) <= 256) ? _emalloc_256() : (((size) <= 320) ? _emalloc_320() : (((size) <= 384) ? _emalloc_384() : (((size) <= 448) ? _emalloc_448() : (((size) <= 512) ? _emalloc_512() : (((size) <= 640) ? _emalloc_640() : (((size) <= 768) ? _emalloc_768() : (((size) <= 896) ? _emalloc_896() : (((size) <= 1024) ? _emalloc_1024() : (((size) <= 1280) ? _emalloc_1280() : (((size) <= 1536) ? _emalloc_1536() : (((size) <= 1792) ? _emalloc_1792() : (((size) <= 2048) ? _emalloc_2048() : (((size) <= 2560) ? _emalloc_2560() : (((size) <= 3072) ? _emalloc_3072() : (((size) <= (((size_t) (2 * 1024 * 1024)) - ((4 * 1024) * (1)))) ? _emalloc_large((size)) : _emalloc_huge((size))) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) : _emalloc((size)) ));
  memcpy((*(zv)).value.ptr, pData, size);
  return (*(zv)).value.ptr;
 }
 return ((void*)0);
}

static inline __attribute__((always_inline)) void *zend_hash_next_index_insert_ptr(HashTable *ht, void *pData)
{
 zval tmp, *zv;

 do { (*(&tmp)).value.ptr = (pData); (*(&tmp)).u1.type_info = 13; } while (0);
 zv = zend_hash_next_index_insert(ht, &tmp);
 if (zv) {
  do { if (__builtin_expect(!((*(zv)).value.ptr), 0)) __builtin_unreachable(); } while (0);
  return (*(zv)).value.ptr;
 } else {
  return ((void*)0);
 }
}

static inline __attribute__((always_inline)) void *zend_hash_index_update_mem(HashTable *ht, zend_ulong h, void *pData, size_t size)
{
 void *p;

 p = ((zval_gc_flags((ht)->gc.u.type_info) & (1<<7))?__zend_malloc(size):(__builtin_constant_p((size)) ? (((size) <= 8) ? _emalloc_8() : (((size) <= 16) ? _emalloc_16() : (((size) <= 24) ? _emalloc_24() : (((size) <= 32) ? _emalloc_32() : (((size) <= 40) ? _emalloc_40() : (((size) <= 48) ? _emalloc_48() : (((size) <= 56) ? _emalloc_56() : (((size) <= 64) ? _emalloc_64() : (((size) <= 80) ? _emalloc_80() : (((size) <= 96) ? _emalloc_96() : (((size) <= 112) ? _emalloc_112() : (((size) <= 128) ? _emalloc_128() : (((size) <= 160) ? _emalloc_160() : (((size) <= 192) ? _emalloc_192() : (((size) <= 224) ? _emalloc_224() : (((size) <= 256) ? _emalloc_256() : (((size) <= 320) ? _emalloc_320() : (((size) <= 384) ? _emalloc_384() : (((size) <= 448) ? _emalloc_448() : (((size) <= 512) ? _emalloc_512() : (((size) <= 640) ? _emalloc_640() : (((size) <= 768) ? _emalloc_768() : (((size) <= 896) ? _emalloc_896() : (((size) <= 1024) ? _emalloc_1024() : (((size) <= 1280) ? _emalloc_1280() : (((size) <= 1536) ? _emalloc_1536() : (((size) <= 1792) ? _emalloc_1792() : (((size) <= 2048) ? _emalloc_2048() : (((size) <= 2560) ? _emalloc_2560() : (((size) <= 3072) ? _emalloc_3072() : (((size) <= (((size_t) (2 * 1024 * 1024)) - ((4 * 1024) * (1)))) ? _emalloc_large((size)) : _emalloc_huge((size))) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) : _emalloc((size)) ));
 memcpy(p, pData, size);
 return zend_hash_index_update_ptr(ht, h, p);
}

static inline __attribute__((always_inline)) void *zend_hash_next_index_insert_mem(HashTable *ht, void *pData, size_t size)
{
 zval tmp, *zv;

 do { (*(&tmp)).value.ptr = (((void*)0)); (*(&tmp)).u1.type_info = 13; } while (0);
 if ((zv = zend_hash_next_index_insert(ht, &tmp))) {
  (*(zv)).value.ptr = ((zval_gc_flags((ht)->gc.u.type_info) & (1<<7))?__zend_malloc(size):(__builtin_constant_p((size)) ? (((size) <= 8) ? _emalloc_8() : (((size) <= 16) ? _emalloc_16() : (((size) <= 24) ? _emalloc_24() : (((size) <= 32) ? _emalloc_32() : (((size) <= 40) ? _emalloc_40() : (((size) <= 48) ? _emalloc_48() : (((size) <= 56) ? _emalloc_56() : (((size) <= 64) ? _emalloc_64() : (((size) <= 80) ? _emalloc_80() : (((size) <= 96) ? _emalloc_96() : (((size) <= 112) ? _emalloc_112() : (((size) <= 128) ? _emalloc_128() : (((size) <= 160) ? _emalloc_160() : (((size) <= 192) ? _emalloc_192() : (((size) <= 224) ? _emalloc_224() : (((size) <= 256) ? _emalloc_256() : (((size) <= 320) ? _emalloc_320() : (((size) <= 384) ? _emalloc_384() : (((size) <= 448) ? _emalloc_448() : (((size) <= 512) ? _emalloc_512() : (((size) <= 640) ? _emalloc_640() : (((size) <= 768) ? _emalloc_768() : (((size) <= 896) ? _emalloc_896() : (((size) <= 1024) ? _emalloc_1024() : (((size) <= 1280) ? _emalloc_1280() : (((size) <= 1536) ? _emalloc_1536() : (((size) <= 1792) ? _emalloc_1792() : (((size) <= 2048) ? _emalloc_2048() : (((size) <= 2560) ? _emalloc_2560() : (((size) <= 3072) ? _emalloc_3072() : (((size) <= (((size_t) (2 * 1024 * 1024)) - ((4 * 1024) * (1)))) ? _emalloc_large((size)) : _emalloc_huge((size))) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) : _emalloc((size)) ));
  memcpy((*(zv)).value.ptr, pData, size);
  return (*(zv)).value.ptr;
 }
 return ((void*)0);
}

static inline __attribute__((always_inline)) void *zend_hash_find_ptr(const HashTable *ht, zend_string *key)
{
 zval *zv;

 zv = zend_hash_find(ht, key);
 if (zv) {
  do { if (__builtin_expect(!((*(zv)).value.ptr), 0)) __builtin_unreachable(); } while (0);
  return (*(zv)).value.ptr;
 } else {
  return ((void*)0);
 }
}

static inline __attribute__((always_inline)) void *zend_hash_find_ex_ptr(const HashTable *ht, zend_string *key, zend_bool known_hash)
{
 zval *zv;

 zv = zend_hash_find_ex(ht, key, known_hash);
 if (zv) {
  do { if (__builtin_expect(!((*(zv)).value.ptr), 0)) __builtin_unreachable(); } while (0);
  return (*(zv)).value.ptr;
 } else {
  return ((void*)0);
 }
}

static inline __attribute__((always_inline)) void *zend_hash_str_find_ptr(const HashTable *ht, const char *str, size_t len)
{
 zval *zv;

 zv = zend_hash_str_find(ht, str, len);
 if (zv) {
  do { if (__builtin_expect(!((*(zv)).value.ptr), 0)) __builtin_unreachable(); } while (0);
  return (*(zv)).value.ptr;
 } else {
  return ((void*)0);
 }
}



__attribute__ ((visibility("default"))) void *zend_hash_str_find_ptr_lc(const HashTable *ht, const char *str, size_t len);



__attribute__ ((visibility("default"))) void *zend_hash_find_ptr_lc(const HashTable *ht, zend_string *key);

static inline __attribute__((always_inline)) void *zend_hash_index_find_ptr(const HashTable *ht, zend_ulong h)
{
 zval *zv;

 zv = zend_hash_index_find(ht, h);
 if (zv) {
  do { if (__builtin_expect(!((*(zv)).value.ptr), 0)) __builtin_unreachable(); } while (0);
  return (*(zv)).value.ptr;
 } else {
  return ((void*)0);
 }
}

static inline __attribute__((always_inline)) zval *zend_hash_index_find_deref(HashTable *ht, zend_ulong h)
{
 zval *zv = zend_hash_index_find(ht, h);
 if (zv) {
  do { if (__builtin_expect(!!((zval_get_type(&(*(zv))) == 10)), 0)) { (zv) = &(*(zv)).value.ref->val; } } while (0);
 }
 return zv;
}

static inline __attribute__((always_inline)) zval *zend_hash_find_deref(HashTable *ht, zend_string *str)
{
 zval *zv = zend_hash_find(ht, str);
 if (zv) {
  do { if (__builtin_expect(!!((zval_get_type(&(*(zv))) == 10)), 0)) { (zv) = &(*(zv)).value.ref->val; } } while (0);
 }
 return zv;
}

static inline __attribute__((always_inline)) zval *zend_hash_str_find_deref(HashTable *ht, const char *str, size_t len)
{
 zval *zv = zend_hash_str_find(ht, str, len);
 if (zv) {
  do { if (__builtin_expect(!!((zval_get_type(&(*(zv))) == 10)), 0)) { (zv) = &(*(zv)).value.ref->val; } } while (0);
 }
 return zv;
}

static inline __attribute__((always_inline)) void *zend_symtable_str_find_ptr(HashTable *ht, const char *str, size_t len)
{
 zend_ulong idx;

 if (_zend_handle_numeric_str(str, len, &idx)) {
  return zend_hash_index_find_ptr(ht, idx);
 } else {
  return zend_hash_str_find_ptr(ht, str, len);
 }
}

static inline __attribute__((always_inline)) void *zend_hash_get_current_data_ptr_ex(HashTable *ht, HashPosition *pos)
{
 zval *zv;

 zv = zend_hash_get_current_data_ex(ht, pos);
 if (zv) {
  do { if (__builtin_expect(!((*(zv)).value.ptr), 0)) __builtin_unreachable(); } while (0);
  return (*(zv)).value.ptr;
 } else {
  return ((void*)0);
 }
}
# 1191 "Zend/zend_hash.h"
static inline __attribute__((always_inline)) zval *_zend_hash_append_ex(HashTable *ht, zend_string *key, zval *zv, _Bool interned)
{
 uint32_t idx = ht->nNumUsed++;
 uint32_t nIndex;
 Bucket *p = ht->arData + idx;

 do { zval *_z1 = (&p->val); const zval *_z2 = (zv); zend_refcounted *_gc = (*(_z2)).value.counted; uint32_t _t = (*(_z2)).u1.type_info; do { uint32_t _w2 = _z2->value.ww.w2; (*(_z1)).value.counted = _gc; _z1->value.ww.w2 = _w2; (*(_z1)).u1.type_info = _t; } while (0); } while (0);
 if (!interned && !(zval_gc_flags((key)->gc.u.type_info) & (1<<6))) {
  (ht)->u.flags &= ~(1<<4);
  zend_string_addref(key);
  zend_string_hash_val(key);
 }
 p->key = key;
 p->h = (key)->h;
 nIndex = (uint32_t)p->h | ht->nTableMask;
 (p->val).u2.next = ((uint32_t*)((ht)->arData))[(int32_t)(nIndex)];
 ((uint32_t*)((ht)->arData))[(int32_t)(nIndex)] = ((idx) * sizeof(Bucket));
 ht->nNumOfElements++;
 return &p->val;
}

static inline __attribute__((always_inline)) zval *_zend_hash_append(HashTable *ht, zend_string *key, zval *zv)
{
 return _zend_hash_append_ex(ht, key, zv, 0);
}

static inline __attribute__((always_inline)) zval *_zend_hash_append_ptr_ex(HashTable *ht, zend_string *key, void *ptr, _Bool interned)
{
 uint32_t idx = ht->nNumUsed++;
 uint32_t nIndex;
 Bucket *p = ht->arData + idx;

 do { (*(&p->val)).value.ptr = (ptr); (*(&p->val)).u1.type_info = 13; } while (0);
 if (!interned && !(zval_gc_flags((key)->gc.u.type_info) & (1<<6))) {
  (ht)->u.flags &= ~(1<<4);
  zend_string_addref(key);
  zend_string_hash_val(key);
 }
 p->key = key;
 p->h = (key)->h;
 nIndex = (uint32_t)p->h | ht->nTableMask;
 (p->val).u2.next = ((uint32_t*)((ht)->arData))[(int32_t)(nIndex)];
 ((uint32_t*)((ht)->arData))[(int32_t)(nIndex)] = ((idx) * sizeof(Bucket));
 ht->nNumOfElements++;
 return &p->val;
}

static inline __attribute__((always_inline)) zval *_zend_hash_append_ptr(HashTable *ht, zend_string *key, void *ptr)
{
 return _zend_hash_append_ptr_ex(ht, key, ptr, 0);
}

static inline __attribute__((always_inline)) void _zend_hash_append_ind(HashTable *ht, zend_string *key, zval *ptr)
{
 uint32_t idx = ht->nNumUsed++;
 uint32_t nIndex;
 Bucket *p = ht->arData + idx;

 do { (*(&p->val)).value.zv = (ptr); (*(&p->val)).u1.type_info = 12; } while (0);
 if (!(zval_gc_flags((key)->gc.u.type_info) & (1<<6))) {
  (ht)->u.flags &= ~(1<<4);
  zend_string_addref(key);
  zend_string_hash_val(key);
 }
 p->key = key;
 p->h = (key)->h;
 nIndex = (uint32_t)p->h | ht->nTableMask;
 (p->val).u2.next = ((uint32_t*)((ht)->arData))[(int32_t)(nIndex)];
 ((uint32_t*)((ht)->arData))[(int32_t)(nIndex)] = ((idx) * sizeof(Bucket));
 ht->nNumOfElements++;
}
# 34 "Zend/zend.h" 2
# 1 "Zend/zend_ast.h" 1
# 24 "Zend/zend_ast.h"
# 1 "Zend/zend.h" 1
# 25 "Zend/zend_ast.h" 2
# 34 "Zend/zend_ast.h"
enum _zend_ast_kind {

 ZEND_AST_ZVAL = 1 << 6,
 ZEND_AST_CONSTANT,
 ZEND_AST_ZNODE,


 ZEND_AST_FUNC_DECL,
 ZEND_AST_CLOSURE,
 ZEND_AST_METHOD,
 ZEND_AST_CLASS,
 ZEND_AST_ARROW_FUNC,


 ZEND_AST_ARG_LIST = 1 << 7,
 ZEND_AST_ARRAY,
 ZEND_AST_ENCAPS_LIST,
 ZEND_AST_EXPR_LIST,
 ZEND_AST_STMT_LIST,
 ZEND_AST_IF,
 ZEND_AST_SWITCH_LIST,
 ZEND_AST_CATCH_LIST,
 ZEND_AST_PARAM_LIST,
 ZEND_AST_CLOSURE_USES,
 ZEND_AST_PROP_DECL,
 ZEND_AST_CONST_DECL,
 ZEND_AST_CLASS_CONST_DECL,
 ZEND_AST_NAME_LIST,
 ZEND_AST_TRAIT_ADAPTATIONS,
 ZEND_AST_USE,
 ZEND_AST_TYPE_UNION,
 ZEND_AST_ATTRIBUTE_LIST,
 ZEND_AST_ATTRIBUTE_GROUP,
 ZEND_AST_MATCH_ARM_LIST,


 ZEND_AST_MAGIC_CONST = 0 << 8,
 ZEND_AST_TYPE,
 ZEND_AST_CONSTANT_CLASS,


 ZEND_AST_VAR = 1 << 8,
 ZEND_AST_CONST,
 ZEND_AST_UNPACK,
 ZEND_AST_UNARY_PLUS,
 ZEND_AST_UNARY_MINUS,
 ZEND_AST_CAST,
 ZEND_AST_EMPTY,
 ZEND_AST_ISSET,
 ZEND_AST_SILENCE,
 ZEND_AST_SHELL_EXEC,
 ZEND_AST_CLONE,
 ZEND_AST_EXIT,
 ZEND_AST_PRINT,
 ZEND_AST_INCLUDE_OR_EVAL,
 ZEND_AST_UNARY_OP,
 ZEND_AST_PRE_INC,
 ZEND_AST_PRE_DEC,
 ZEND_AST_POST_INC,
 ZEND_AST_POST_DEC,
 ZEND_AST_YIELD_FROM,
 ZEND_AST_CLASS_NAME,

 ZEND_AST_GLOBAL,
 ZEND_AST_UNSET,
 ZEND_AST_RETURN,
 ZEND_AST_LABEL,
 ZEND_AST_REF,
 ZEND_AST_HALT_COMPILER,
 ZEND_AST_ECHO,
 ZEND_AST_THROW,
 ZEND_AST_GOTO,
 ZEND_AST_BREAK,
 ZEND_AST_CONTINUE,


 ZEND_AST_DIM = 2 << 8,
 ZEND_AST_PROP,
 ZEND_AST_NULLSAFE_PROP,
 ZEND_AST_STATIC_PROP,
 ZEND_AST_CALL,
 ZEND_AST_CLASS_CONST,
 ZEND_AST_ASSIGN,
 ZEND_AST_ASSIGN_REF,
 ZEND_AST_ASSIGN_OP,
 ZEND_AST_BINARY_OP,
 ZEND_AST_GREATER,
 ZEND_AST_GREATER_EQUAL,
 ZEND_AST_AND,
 ZEND_AST_OR,
 ZEND_AST_ARRAY_ELEM,
 ZEND_AST_NEW,
 ZEND_AST_INSTANCEOF,
 ZEND_AST_YIELD,
 ZEND_AST_COALESCE,
 ZEND_AST_ASSIGN_COALESCE,

 ZEND_AST_STATIC,
 ZEND_AST_WHILE,
 ZEND_AST_DO_WHILE,
 ZEND_AST_IF_ELEM,
 ZEND_AST_SWITCH,
 ZEND_AST_SWITCH_CASE,
 ZEND_AST_DECLARE,
 ZEND_AST_USE_TRAIT,
 ZEND_AST_TRAIT_PRECEDENCE,
 ZEND_AST_METHOD_REFERENCE,
 ZEND_AST_NAMESPACE,
 ZEND_AST_USE_ELEM,
 ZEND_AST_TRAIT_ALIAS,
 ZEND_AST_GROUP_USE,
 ZEND_AST_CLASS_CONST_GROUP,
 ZEND_AST_ATTRIBUTE,
 ZEND_AST_MATCH,
 ZEND_AST_MATCH_ARM,
 ZEND_AST_NAMED_ARG,


 ZEND_AST_METHOD_CALL = 3 << 8,
 ZEND_AST_NULLSAFE_METHOD_CALL,
 ZEND_AST_STATIC_CALL,
 ZEND_AST_CONDITIONAL,

 ZEND_AST_TRY,
 ZEND_AST_CATCH,
 ZEND_AST_PROP_GROUP,
 ZEND_AST_PROP_ELEM,
 ZEND_AST_CONST_ELEM,


 ZEND_AST_FOR = 4 << 8,
 ZEND_AST_FOREACH,


 ZEND_AST_PARAM = 5 << 8,
};

typedef uint16_t zend_ast_kind;
typedef uint16_t zend_ast_attr;

struct _zend_ast {
 zend_ast_kind kind;
 zend_ast_attr attr;
 uint32_t lineno;
 zend_ast *child[1];
};


typedef struct _zend_ast_list {
 zend_ast_kind kind;
 zend_ast_attr attr;
 uint32_t lineno;
 uint32_t children;
 zend_ast *child[1];
} zend_ast_list;


typedef struct _zend_ast_zval {
 zend_ast_kind kind;
 zend_ast_attr attr;
 zval val;
} zend_ast_zval;


typedef struct _zend_ast_decl {
 zend_ast_kind kind;
 zend_ast_attr attr;
 uint32_t start_lineno;
 uint32_t end_lineno;
 uint32_t flags;
 unsigned char *lex_pos;
 zend_string *doc_comment;
 zend_string *name;
 zend_ast *child[5];
} zend_ast_decl;

typedef void (*zend_ast_process_t)(zend_ast *ast);
extern __attribute__ ((visibility("default"))) zend_ast_process_t zend_ast_process;

__attribute__ ((visibility("default"))) zend_ast * zend_ast_create_zval_with_lineno(zval *zv, uint32_t lineno);
__attribute__ ((visibility("default"))) zend_ast * zend_ast_create_zval_ex(zval *zv, zend_ast_attr attr);
__attribute__ ((visibility("default"))) zend_ast * zend_ast_create_zval(zval *zv);
__attribute__ ((visibility("default"))) zend_ast * zend_ast_create_zval_from_str(zend_string *str);
__attribute__ ((visibility("default"))) zend_ast * zend_ast_create_zval_from_long(zend_long lval);

__attribute__ ((visibility("default"))) zend_ast * zend_ast_create_constant(zend_string *name, zend_ast_attr attr);
__attribute__ ((visibility("default"))) zend_ast * zend_ast_create_class_const_or_name(zend_ast *class_name, zend_ast *name);
# 232 "Zend/zend_ast.h"
__attribute__ ((visibility("default"))) zend_ast * zend_ast_create_0(zend_ast_kind kind);
__attribute__ ((visibility("default"))) zend_ast * zend_ast_create_1(zend_ast_kind kind, zend_ast *child);
__attribute__ ((visibility("default"))) zend_ast * zend_ast_create_2(zend_ast_kind kind, zend_ast *child1, zend_ast *child2);
__attribute__ ((visibility("default"))) zend_ast * zend_ast_create_3(zend_ast_kind kind, zend_ast *child1, zend_ast *child2, zend_ast *child3);
__attribute__ ((visibility("default"))) zend_ast * zend_ast_create_4(zend_ast_kind kind, zend_ast *child1, zend_ast *child2, zend_ast *child3, zend_ast *child4);
__attribute__ ((visibility("default"))) zend_ast * zend_ast_create_5(zend_ast_kind kind, zend_ast *child1, zend_ast *child2, zend_ast *child3, zend_ast *child4, zend_ast *child5);

static inline __attribute__((always_inline)) zend_ast * zend_ast_create_ex_0(zend_ast_kind kind, zend_ast_attr attr) {
 zend_ast *ast = zend_ast_create_0(kind);
 ast->attr = attr;
 return ast;
}
static inline __attribute__((always_inline)) zend_ast * zend_ast_create_ex_1(zend_ast_kind kind, zend_ast_attr attr, zend_ast *child) {
 zend_ast *ast = zend_ast_create_1(kind, child);
 ast->attr = attr;
 return ast;
}
static inline __attribute__((always_inline)) zend_ast * zend_ast_create_ex_2(zend_ast_kind kind, zend_ast_attr attr, zend_ast *child1, zend_ast *child2) {
 zend_ast *ast = zend_ast_create_2(kind, child1, child2);
 ast->attr = attr;
 return ast;
}
static inline __attribute__((always_inline)) zend_ast * zend_ast_create_ex_3(zend_ast_kind kind, zend_ast_attr attr, zend_ast *child1, zend_ast *child2, zend_ast *child3) {
 zend_ast *ast = zend_ast_create_3(kind, child1, child2, child3);
 ast->attr = attr;
 return ast;
}
static inline __attribute__((always_inline)) zend_ast * zend_ast_create_ex_4(zend_ast_kind kind, zend_ast_attr attr, zend_ast *child1, zend_ast *child2, zend_ast *child3, zend_ast *child4) {
 zend_ast *ast = zend_ast_create_4(kind, child1, child2, child3, child4);
 ast->attr = attr;
 return ast;
}
static inline __attribute__((always_inline)) zend_ast * zend_ast_create_ex_5(zend_ast_kind kind, zend_ast_attr attr, zend_ast *child1, zend_ast *child2, zend_ast *child3, zend_ast *child4, zend_ast *child5) {
 zend_ast *ast = zend_ast_create_5(kind, child1, child2, child3, child4, child5);
 ast->attr = attr;
 return ast;
}

__attribute__ ((visibility("default"))) zend_ast * zend_ast_create_list_0(zend_ast_kind kind);
__attribute__ ((visibility("default"))) zend_ast * zend_ast_create_list_1(zend_ast_kind kind, zend_ast *child);
__attribute__ ((visibility("default"))) zend_ast * zend_ast_create_list_2(zend_ast_kind kind, zend_ast *child1, zend_ast *child2);
# 287 "Zend/zend_ast.h"
__attribute__ ((visibility("default"))) zend_ast * zend_ast_list_add(zend_ast *list, zend_ast *op);

__attribute__ ((visibility("default"))) zend_ast *zend_ast_create_decl(
 zend_ast_kind kind, uint32_t flags, uint32_t start_lineno, zend_string *doc_comment,
 zend_string *name, zend_ast *child0, zend_ast *child1, zend_ast *child2, zend_ast *child3, zend_ast *child4
);

__attribute__ ((visibility("default"))) zend_result zend_ast_evaluate(zval *result, zend_ast *ast, zend_class_entry *scope);
__attribute__ ((visibility("default"))) zend_string *zend_ast_export(const char *prefix, zend_ast *ast, const char *suffix);

__attribute__ ((visibility("default"))) zend_ast_ref * zend_ast_copy(zend_ast *ast);
__attribute__ ((visibility("default"))) void zend_ast_destroy(zend_ast *ast);
__attribute__ ((visibility("default"))) void zend_ast_ref_destroy(zend_ast_ref *ast);

typedef void (*zend_ast_apply_func)(zend_ast **ast_ptr);
__attribute__ ((visibility("default"))) void zend_ast_apply(zend_ast *ast, zend_ast_apply_func fn);

static inline __attribute__((always_inline)) zend_bool zend_ast_is_special(zend_ast *ast) {
 return (ast->kind >> 6) & 1;
}

static inline __attribute__((always_inline)) zend_bool zend_ast_is_list(zend_ast *ast) {
 return (ast->kind >> 7) & 1;
}
static inline __attribute__((always_inline)) zend_ast_list *zend_ast_get_list(zend_ast *ast) {
 do { if (__builtin_expect(!(zend_ast_is_list(ast)), 0)) __builtin_unreachable(); } while (0);
 return (zend_ast_list *) ast;
}

static inline __attribute__((always_inline)) zval *zend_ast_get_zval(zend_ast *ast) {
 do { if (__builtin_expect(!(ast->kind == ZEND_AST_ZVAL), 0)) __builtin_unreachable(); } while (0);
 return &((zend_ast_zval *) ast)->val;
}
static inline __attribute__((always_inline)) zend_string *zend_ast_get_str(zend_ast *ast) {
 zval *zv = zend_ast_get_zval(ast);
 do { if (__builtin_expect(!(zval_get_type(&(*(zv))) == 6), 0)) __builtin_unreachable(); } while (0);
 return (*(zv)).value.str;
}

static inline __attribute__((always_inline)) zend_string *zend_ast_get_constant_name(zend_ast *ast) {
 do { if (__builtin_expect(!(ast->kind == ZEND_AST_CONSTANT), 0)) __builtin_unreachable(); } while (0);
 do { if (__builtin_expect(!(zval_get_type(&(((zend_ast_zval *) ast)->val)) == 6), 0)) __builtin_unreachable(); } while (0);
 return (((zend_ast_zval *) ast)->val).value.str;
}

static inline __attribute__((always_inline)) uint32_t zend_ast_get_num_children(zend_ast *ast) {
 do { if (__builtin_expect(!(!zend_ast_is_list(ast)), 0)) __builtin_unreachable(); } while (0);
 return ast->kind >> 8;
}
static inline __attribute__((always_inline)) uint32_t zend_ast_get_lineno(zend_ast *ast) {
 if (ast->kind == ZEND_AST_ZVAL) {
  zval *zv = zend_ast_get_zval(ast);
  return (*(zv)).u2.lineno;
 } else {
  return ast->lineno;
 }
}

static inline __attribute__((always_inline)) zend_ast *zend_ast_create_binary_op(uint32_t opcode, zend_ast *op0, zend_ast *op1) {
 return zend_ast_create_ex_2(ZEND_AST_BINARY_OP, opcode, op0, op1);
}
static inline __attribute__((always_inline)) zend_ast *zend_ast_create_assign_op(uint32_t opcode, zend_ast *op0, zend_ast *op1) {
 return zend_ast_create_ex_2(ZEND_AST_ASSIGN_OP, opcode, op0, op1);
}
static inline __attribute__((always_inline)) zend_ast *zend_ast_create_cast(uint32_t type, zend_ast *op0) {
 return zend_ast_create_ex_1(ZEND_AST_CAST, type, op0);
}
static inline __attribute__((always_inline)) zend_ast *zend_ast_list_rtrim(zend_ast *ast) {
 zend_ast_list *list = zend_ast_get_list(ast);
 if (list->children && list->child[list->children - 1] == ((void*)0)) {
  list->children--;
 }
 return ast;
}

zend_ast * zend_ast_with_attributes(zend_ast *ast, zend_ast *attr);
# 35 "Zend/zend.h" 2
# 1 "Zend/zend_gc.h" 1
# 25 "Zend/zend_gc.h"
typedef struct _zend_gc_status {
 uint32_t runs;
 uint32_t collected;
 uint32_t threshold;
 uint32_t num_roots;
} zend_gc_status;

__attribute__ ((visibility("default"))) extern int (*gc_collect_cycles)(void);

__attribute__ ((visibility("default"))) void gc_possible_root(zend_refcounted *ref);
__attribute__ ((visibility("default"))) void gc_remove_from_buffer(zend_refcounted *ref);


__attribute__ ((visibility("default"))) zend_bool gc_enable(zend_bool enable);
__attribute__ ((visibility("default"))) zend_bool gc_enabled(void);


__attribute__ ((visibility("default"))) zend_bool gc_protect(zend_bool protect);
__attribute__ ((visibility("default"))) zend_bool gc_protected(void);


__attribute__ ((visibility("default"))) int zend_gc_collect_cycles(void);

__attribute__ ((visibility("default"))) void zend_gc_get_status(zend_gc_status *status);

void gc_globals_ctor(void);
void gc_globals_dtor(void);
void gc_reset(void);
# 69 "Zend/zend_gc.h"
static inline __attribute__((always_inline)) void gc_check_possible_root(zend_refcounted *ref)
{
 if (__builtin_expect(!!((ref)->gc.u.type_info == (10 | ((1<<4) << 0))), 1)) {
  zval *zv = &((zend_reference*)ref)->val;

  if (!(((*(zv)).u1.v.type_flags & (1<<1)) != 0)) {
   return;
  }
  ref = (*(zv)).value.counted;
 }
 if (__builtin_expect(!!((((ref)->gc.u.type_info & (0xfffffc00 | ((1<<4) << 0))) == 0)), 0)) {
  gc_possible_root(ref);
 }
}





typedef struct {
 zval *cur;
 zval *end;
 zval *start;
} zend_get_gc_buffer;

__attribute__ ((visibility("default"))) zend_get_gc_buffer *zend_get_gc_buffer_create(void);
__attribute__ ((visibility("default"))) void zend_get_gc_buffer_grow(zend_get_gc_buffer *gc_buffer);

static inline __attribute__((always_inline)) void zend_get_gc_buffer_add_zval(
  zend_get_gc_buffer *gc_buffer, zval *zv) {
 if (((*(zv)).u1.v.type_flags != 0)) {
  if (__builtin_expect(!!(gc_buffer->cur == gc_buffer->end), 0)) {
   zend_get_gc_buffer_grow(gc_buffer);
  }
  do { zval *_z1 = (gc_buffer->cur); const zval *_z2 = (zv); zend_refcounted *_gc = (*(_z2)).value.counted; uint32_t _t = (*(_z2)).u1.type_info; do { uint32_t _w2 = _z2->value.ww.w2; (*(_z1)).value.counted = _gc; _z1->value.ww.w2 = _w2; (*(_z1)).u1.type_info = _t; } while (0); } while (0);
  gc_buffer->cur++;
 }
}

static inline __attribute__((always_inline)) void zend_get_gc_buffer_add_obj(
  zend_get_gc_buffer *gc_buffer, zend_object *obj) {
 if (__builtin_expect(!!(gc_buffer->cur == gc_buffer->end), 0)) {
  zend_get_gc_buffer_grow(gc_buffer);
 }
 do { zval *__z = (gc_buffer->cur); (*(__z)).value.obj = (obj); (*(__z)).u1.type_info = (8 | ((1<<0) << 8) | ((1<<1) << 8)); } while (0);
 gc_buffer->cur++;
}

static inline __attribute__((always_inline)) void zend_get_gc_buffer_use(
  zend_get_gc_buffer *gc_buffer, zval **table, int *n) {
 *table = gc_buffer->start;
 *n = gc_buffer->cur - gc_buffer->start;
}
# 36 "Zend/zend.h" 2
# 1 "Zend/zend_variables.h" 1
# 29 "Zend/zend_variables.h"
__attribute__ ((visibility("default"))) void rc_dtor_func(zend_refcounted *p);
__attribute__ ((visibility("default"))) void zval_copy_ctor_func(zval *zvalue);

static inline __attribute__((always_inline)) void zval_ptr_dtor_nogc(zval *zval_ptr)
{
 if (((*(zval_ptr)).u1.v.type_flags != 0) && !zval_delref_p(zval_ptr)) {
  rc_dtor_func((*(zval_ptr)).value.counted);
 }
}

static inline __attribute__((always_inline)) void i_zval_ptr_dtor(zval *zval_ptr)
{
 if (((*(zval_ptr)).u1.v.type_flags != 0)) {
  zend_refcounted *ref = (*(zval_ptr)).value.counted;
  if (!zend_gc_delref(&(ref)->gc)) {
   rc_dtor_func(ref);
  } else {
   gc_check_possible_root(ref);
  }
 }
}

static inline __attribute__((always_inline)) void zval_copy_ctor(zval *zvalue)
{
 if (zval_get_type(&(*(zvalue))) == 7) {
  do { zend_array *__arr = (zend_array_dup((*(zvalue)).value.arr)); zval *__z = (zvalue); (*(__z)).value.arr = __arr; (*(__z)).u1.type_info = (7 | ((1<<0) << 8) | ((1<<1) << 8)); } while (0);
 } else if (((*(zvalue)).u1.v.type_flags != 0)) {
  zval_addref_p(zvalue);
 }
}

static inline __attribute__((always_inline)) void zval_opt_copy_ctor(zval *zvalue)
{
 if (((*(zvalue)).u1.type_info & 0xff) == 7) {
  do { zend_array *__arr = (zend_array_dup((*(zvalue)).value.arr)); zval *__z = (zvalue); (*(__z)).value.arr = __arr; (*(__z)).u1.type_info = (7 | ((1<<0) << 8) | ((1<<1) << 8)); } while (0);
 } else if (((((*(zvalue)).u1.type_info) & 0xff00) != 0)) {
  zval_addref_p(zvalue);
 }
}

static inline __attribute__((always_inline)) void zval_ptr_dtor_str(zval *zval_ptr)
{
 if (((*(zval_ptr)).u1.v.type_flags != 0) && !zval_delref_p(zval_ptr)) {
  do { if (__builtin_expect(!(zval_get_type(&(*(zval_ptr))) == 6), 0)) __builtin_unreachable(); } while (0);
  do { if (__builtin_expect(!(!(zval_gc_flags(((*(zval_ptr)).value.str)->gc.u.type_info) & (1<<6))), 0)) __builtin_unreachable(); } while (0);
  do { if (__builtin_expect(!(!(zval_gc_flags(((*(zval_ptr)).value.str)->gc.u.type_info) & (1<<7))), 0)) __builtin_unreachable(); } while (0);
  _efree(((*(zval_ptr)).value.str) );
 }
}

__attribute__ ((visibility("default"))) void zval_ptr_dtor(zval *zval_ptr);
__attribute__ ((visibility("default"))) void zval_internal_ptr_dtor(zval *zvalue);




__attribute__ ((visibility("default"))) void zval_add_ref(zval *p);
# 37 "Zend/zend.h" 2
# 1 "Zend/zend_iterators.h" 1
# 27 "Zend/zend_iterators.h"
typedef struct _zend_object_iterator zend_object_iterator;

typedef struct _zend_object_iterator_funcs {

 void (*dtor)(zend_object_iterator *iter);


 int (*valid)(zend_object_iterator *iter);


 zval *(*get_current_data)(zend_object_iterator *iter);





 void (*get_current_key)(zend_object_iterator *iter, zval *key);


 void (*move_forward)(zend_object_iterator *iter);


 void (*rewind)(zend_object_iterator *iter);


 void (*invalidate_current)(zend_object_iterator *iter);



 HashTable *(*get_gc)(zend_object_iterator *iter, zval **table, int *n);
} zend_object_iterator_funcs;

struct _zend_object_iterator {
 zend_object std;
 zval data;
 const zend_object_iterator_funcs *funcs;
 zend_ulong index;
};

typedef struct _zend_class_iterator_funcs {
 zend_function *zf_new_iterator;
 zend_function *zf_valid;
 zend_function *zf_current;
 zend_function *zf_key;
 zend_function *zf_next;
 zend_function *zf_rewind;
} zend_class_iterator_funcs;



__attribute__ ((visibility("default"))) zend_object_iterator* zend_iterator_unwrap(zval *array_ptr);


__attribute__ ((visibility("default"))) void zend_iterator_init(zend_object_iterator *iter);
__attribute__ ((visibility("default"))) void zend_iterator_dtor(zend_object_iterator *iter);

__attribute__ ((visibility("default"))) void zend_register_iterator_wrapper(void);
# 38 "Zend/zend.h" 2
# 1 "Zend/zend_stream.h" 1
# 26 "Zend/zend_stream.h"
# 1 "/emsdk_portable/fastcomp/emscripten/system/include/compat/sys/stat.h" 1 3







# 1 "/emsdk_portable/fastcomp/emscripten/system/include/libc/sys/stat.h" 1 3
# 21 "/emsdk_portable/fastcomp/emscripten/system/include/libc/sys/stat.h" 3
# 1 "/emsdk_portable/fastcomp/emscripten/system/lib/libc/musl/arch/emscripten/bits/alltypes.h" 1 3
# 22 "/emsdk_portable/fastcomp/emscripten/system/include/libc/sys/stat.h" 2 3

# 1 "/emsdk_portable/fastcomp/emscripten/system/lib/libc/musl/arch/emscripten/bits/stat.h" 1 3



struct stat
{
 dev_t st_dev;
 int __st_dev_padding;
 long __st_ino_truncated;
 mode_t st_mode;
 nlink_t st_nlink;
 uid_t st_uid;
 gid_t st_gid;
 dev_t st_rdev;
 int __st_rdev_padding;
 off_t st_size;
 blksize_t st_blksize;
 blkcnt_t st_blocks;
 struct timespec st_atim;
 struct timespec st_mtim;
 struct timespec st_ctim;
 ino_t st_ino;
};
# 24 "/emsdk_portable/fastcomp/emscripten/system/include/libc/sys/stat.h" 2 3
# 73 "/emsdk_portable/fastcomp/emscripten/system/include/libc/sys/stat.h" 3
int stat(const char *restrict, struct stat *restrict);
int fstat(int, struct stat *);
int lstat(const char *restrict, struct stat *restrict);
int fstatat(int, const char *restrict, struct stat *restrict, int);
int chmod(const char *, mode_t);
int fchmod(int, mode_t);
int fchmodat(int, const char *, mode_t, int);
mode_t umask(mode_t);
int mkdir(const char *, mode_t);
int mknod(const char *, mode_t, dev_t);
int mkfifo(const char *, mode_t);
int mkdirat(int, const char *, mode_t);
int mknodat(int, const char *, mode_t, dev_t);
int mkfifoat(int, const char *, mode_t);

int futimens(int, const struct timespec [2]);
int utimensat(int, const char *, const struct timespec [2], int);


int lchmod(const char *, mode_t);
# 9 "/emsdk_portable/fastcomp/emscripten/system/include/compat/sys/stat.h" 2 3
# 27 "Zend/zend_stream.h" 2




typedef size_t (*zend_stream_fsizer_t)(void* handle);
typedef ssize_t (*zend_stream_reader_t)(void* handle, char *buf, size_t len);
typedef void (*zend_stream_closer_t)(void* handle);



typedef enum {
 ZEND_HANDLE_FILENAME,
 ZEND_HANDLE_FP,
 ZEND_HANDLE_STREAM
} zend_stream_type;

typedef struct _zend_stream {
 void *handle;
 int isatty;
 zend_stream_reader_t reader;
 zend_stream_fsizer_t fsizer;
 zend_stream_closer_t closer;
} zend_stream;

typedef struct _zend_file_handle {
 union {
  FILE *fp;
  zend_stream stream;
 } handle;
 const char *filename;
 zend_string *opened_path;
 zend_stream_type type;


 zend_bool free_filename;
 char *buf;
 size_t len;
} zend_file_handle;


__attribute__ ((visibility("default"))) void zend_stream_init_fp(zend_file_handle *handle, FILE *fp, const char *filename);
__attribute__ ((visibility("default"))) void zend_stream_init_filename(zend_file_handle *handle, const char *filename);
__attribute__ ((visibility("default"))) zend_result zend_stream_open(const char *filename, zend_file_handle *handle);
__attribute__ ((visibility("default"))) zend_result zend_stream_fixup(zend_file_handle *file_handle, char **buf, size_t *len);
__attribute__ ((visibility("default"))) void zend_file_handle_dtor(zend_file_handle *fh);
__attribute__ ((visibility("default"))) int zend_compare_file_handles(zend_file_handle *fh1, zend_file_handle *fh2);
# 90 "Zend/zend_stream.h"
typedef struct stat zend_stat_t;
# 39 "Zend/zend.h" 2
# 1 "Zend/zend_smart_str_public.h" 1
# 20 "Zend/zend_smart_str_public.h"
typedef struct {
 zend_string *s;
 size_t a;
} smart_str;
# 40 "Zend/zend.h" 2
# 1 "Zend/zend_smart_string_public.h" 1
# 23 "Zend/zend_smart_string_public.h"
typedef struct {
 char *c;
 size_t len;
 size_t a;
} smart_string;
# 41 "Zend/zend.h" 2
# 1 "Zend/zend_signal.h" 1
# 37 "Zend/zend_signal.h"
typedef struct _zend_signal_entry_t {
 int flags;
 void* handler;
} zend_signal_entry_t;

typedef struct _zend_signal_t {
 int signo;
 siginfo_t *siginfo;
 void* context;
} zend_signal_t;

typedef struct _zend_signal_queue_t {
 zend_signal_t zend_signal;
 struct _zend_signal_queue_t *next;
} zend_signal_queue_t;


typedef struct _zend_signal_globals_t {
 int depth;
 int blocked;
 int running;
 int active;
 zend_bool check;
 zend_bool reset;
 zend_signal_entry_t handlers[65];
 zend_signal_queue_t pstorage[64], *phead, *ptail, *pavail;
} zend_signal_globals_t;
# 74 "Zend/zend_signal.h"
__attribute__ ((visibility("default"))) extern zend_signal_globals_t zend_signal_globals;
# 86 "Zend/zend_signal.h"
__attribute__ ((visibility("default"))) void zend_signal_handler_unblock(void);
void zend_signal_activate(void);
void zend_signal_deactivate(void);

__attribute__ ((visibility("default"))) void zend_signal_startup(void);

void zend_signal_init(void);

__attribute__ ((visibility("default"))) void zend_signal(int signo, void (*handler)(int));
__attribute__ ((visibility("default"))) void zend_sigaction(int signo, const struct sigaction *act, struct sigaction *oldact);
# 42 "Zend/zend.h" 2
# 74 "Zend/zend.h"
struct _zend_serialize_data;
struct _zend_unserialize_data;

typedef struct _zend_serialize_data zend_serialize_data;
typedef struct _zend_unserialize_data zend_unserialize_data;

typedef struct _zend_class_name {
 zend_string *name;
 zend_string *lc_name;
} zend_class_name;

typedef struct _zend_trait_method_reference {
 zend_string *method_name;
 zend_string *class_name;
} zend_trait_method_reference;

typedef struct _zend_trait_precedence {
 zend_trait_method_reference trait_method;
 uint32_t num_excludes;
 zend_string *exclude_class_names[1];
} zend_trait_precedence;

typedef struct _zend_trait_alias {
 zend_trait_method_reference trait_method;




 zend_string *alias;




 uint32_t modifiers;
} zend_trait_alias;

struct _zend_class_entry {
 char type;
 zend_string *name;

 union {
  zend_class_entry *parent;
  zend_string *parent_name;
 };
 int refcount;
 uint32_t ce_flags;

 int default_properties_count;
 int default_static_members_count;
 zval *default_properties_table;
 zval *default_static_members_table;
 zval * * static_members_table__ptr;
 HashTable function_table;
 HashTable properties_info;
 HashTable constants_table;

 struct _zend_property_info **properties_info_table;

 zend_function *constructor;
 zend_function *destructor;
 zend_function *clone;
 zend_function *__get;
 zend_function *__set;
 zend_function *__unset;
 zend_function *__isset;
 zend_function *__call;
 zend_function *__callstatic;
 zend_function *__tostring;
 zend_function *__debugInfo;
 zend_function *__serialize;
 zend_function *__unserialize;


 zend_class_iterator_funcs *iterator_funcs_ptr;


 union {
  zend_object* (*create_object)(zend_class_entry *class_type);
  int (*interface_gets_implemented)(zend_class_entry *iface, zend_class_entry *class_type);
 };
 zend_object_iterator *(*get_iterator)(zend_class_entry *ce, zval *object, int by_ref);
 zend_function *(*get_static_method)(zend_class_entry *ce, zend_string* method);


 int (*serialize)(zval *object, unsigned char **buffer, size_t *buf_len, zend_serialize_data *data);
 int (*unserialize)(zval *object, zend_class_entry *ce, const unsigned char *buf, size_t buf_len, zend_unserialize_data *data);

 uint32_t num_interfaces;
 uint32_t num_traits;


 union {
  zend_class_entry **interfaces;
  zend_class_name *interface_names;
 };

 zend_class_name *trait_names;
 zend_trait_alias **trait_aliases;
 zend_trait_precedence **trait_precedences;
 HashTable *attributes;

 union {
  struct {
   zend_string *filename;
   uint32_t line_start;
   uint32_t line_end;
   zend_string *doc_comment;
  } user;
  struct {
   const struct _zend_function_entry *builtin_functions;
   struct _zend_module_entry *module;
  } internal;
 } info;
};

typedef struct _zend_utility_functions {
 void (*error_function)(int type, const char *error_filename, const uint32_t error_lineno, zend_string *message);
 size_t (*printf_function)(const char *format, ...) __attribute__ ((format(printf, 1, 2)));
 size_t (*write_function)(const char *str, size_t str_length);
 FILE *(*fopen_function)(const char *filename, zend_string **opened_path);
 void (*message_handler)(zend_long message, const void *data);
 zval *(*get_configuration_directive)(zend_string *name);
 void (*ticks_function)(int ticks);
 void (*on_timeout)(int seconds);
 zend_result (*stream_open_function)(const char *filename, zend_file_handle *handle);
 void (*printf_to_smart_string_function)(smart_string *buf, const char *format, va_list ap);
 void (*printf_to_smart_str_function)(smart_str *buf, const char *format, va_list ap);
 char *(*getenv_function)(const char *name, size_t name_len);
 zend_string *(*resolve_path_function)(const char *filename, size_t filename_len);
} zend_utility_functions;

typedef struct _zend_utility_values {
 zend_bool html_errors;
} zend_utility_values;

typedef size_t (*zend_write_func_t)(const char *str, size_t str_length);
# 230 "Zend/zend.h"
void zend_startup(zend_utility_functions *utility_functions);
void zend_shutdown(void);
void zend_register_standard_ini_entries(void);
zend_result zend_post_startup(void);
void zend_set_utility_values(zend_utility_values *utility_values);

__attribute__ ((visibility("default"))) __attribute__((noreturn)) void _zend_bailout(const char *filename, uint32_t lineno);

__attribute__ ((visibility("default"))) size_t zend_vspprintf(char **pbuf, size_t max_len, const char *format, va_list ap);
__attribute__ ((visibility("default"))) size_t zend_spprintf(char **message, size_t max_len, const char *format, ...) __attribute__ ((format(printf, 3, 4)));
__attribute__ ((visibility("default"))) zend_string *zend_vstrpprintf(size_t max_len, const char *format, va_list ap);
__attribute__ ((visibility("default"))) zend_string *zend_strpprintf(size_t max_len, const char *format, ...) __attribute__ ((format(printf, 2, 3)));



__attribute__ ((visibility("default"))) size_t zend_spprintf_unchecked(char **message, size_t max_len, const char *format, ...);
__attribute__ ((visibility("default"))) zend_string *zend_strpprintf_unchecked(size_t max_len, const char *format, ...);

__attribute__ ((visibility("default"))) const char *get_zend_version(void);
__attribute__ ((visibility("default"))) _Bool zend_make_printable_zval(zval *expr, zval *expr_copy);
__attribute__ ((visibility("default"))) size_t zend_print_zval(zval *expr, int indent);
__attribute__ ((visibility("default"))) void zend_print_zval_r(zval *expr, int indent);
__attribute__ ((visibility("default"))) zend_string *zend_print_zval_r_to_str(zval *expr, int indent);
__attribute__ ((visibility("default"))) void zend_print_flat_zval_r(zval *expr);




__attribute__ ((visibility("default"))) void zend_output_debug_string(zend_bool trigger_break, const char *format, ...) __attribute__ ((format(printf, 2, 3)));

__attribute__ ((visibility("default"))) void zend_activate(void);
__attribute__ ((visibility("default"))) void zend_deactivate(void);
__attribute__ ((visibility("default"))) void zend_call_destructors(void);
__attribute__ ((visibility("default"))) void zend_activate_modules(void);
__attribute__ ((visibility("default"))) void zend_deactivate_modules(void);
__attribute__ ((visibility("default"))) void zend_post_deactivate_modules(void);

__attribute__ ((visibility("default"))) void free_estring(char **str_p);
# 279 "Zend/zend.h"
extern __attribute__ ((visibility("default"))) size_t (*zend_printf)(const char *format, ...) __attribute__ ((format(printf, 1, 2)));
extern __attribute__ ((visibility("default"))) zend_write_func_t zend_write;
extern __attribute__ ((visibility("default"))) FILE *(*zend_fopen)(const char *filename, zend_string **opened_path);
extern __attribute__ ((visibility("default"))) void (*zend_ticks_function)(int ticks);
extern __attribute__ ((visibility("default"))) void (*zend_interrupt_function)(zend_execute_data *execute_data);
extern __attribute__ ((visibility("default"))) void (*zend_error_cb)(int type, const char *error_filename, const uint32_t error_lineno, zend_string *message);
extern __attribute__ ((visibility("default"))) void (*zend_on_timeout)(int seconds);
extern __attribute__ ((visibility("default"))) zend_result (*zend_stream_open_function)(const char *filename, zend_file_handle *handle);
extern void (*zend_printf_to_smart_string)(smart_string *buf, const char *format, va_list ap);
extern void (*zend_printf_to_smart_str)(smart_str *buf, const char *format, va_list ap);
extern __attribute__ ((visibility("default"))) char *(*zend_getenv)(const char *name, size_t name_len);
extern __attribute__ ((visibility("default"))) zend_string *(*zend_resolve_path)(const char *filename, size_t filename_len);


extern __attribute__ ((visibility("default"))) zend_result (*zend_post_startup_cb)(void);
extern __attribute__ ((visibility("default"))) void (*zend_post_shutdown_cb)(void);


extern __attribute__ ((visibility("default"))) zend_result (*zend_preload_autoload)(zend_string *filename);

__attribute__ ((visibility("default"))) void zend_error(int type, const char *format, ...) __attribute__ ((format(printf, 2, 3)));
__attribute__ ((visibility("default"))) __attribute__((noreturn)) void zend_error_noreturn(int type, const char *format, ...) __attribute__ ((format(printf, 2, 3)));

__attribute__ ((visibility("default"))) void zend_error_at(int type, const char *filename, uint32_t lineno, const char *format, ...) __attribute__ ((format(printf, 4, 5)));
__attribute__ ((visibility("default"))) __attribute__((noreturn)) void zend_error_at_noreturn(int type, const char *filename, uint32_t lineno, const char *format, ...) __attribute__ ((format(printf, 4, 5)));
__attribute__ ((visibility("default"))) void zend_error_zstr(int type, zend_string *message);

__attribute__ ((visibility("default"))) void zend_throw_error(zend_class_entry *exception_ce, const char *format, ...) __attribute__ ((format(printf, 2, 3)));
__attribute__ ((visibility("default"))) void zend_type_error(const char *format, ...) __attribute__ ((format(printf, 1, 2)));
__attribute__ ((visibility("default"))) void zend_argument_count_error(const char *format, ...) __attribute__ ((format(printf, 1, 2)));
__attribute__ ((visibility("default"))) void zend_value_error(const char *format, ...) __attribute__ ((format(printf, 1, 2)));

          void zenderror(const char *error);



extern __attribute__ ((visibility("default"))) zend_class_entry *zend_standard_class_def;
extern __attribute__ ((visibility("default"))) zend_utility_values zend_uv;


extern __attribute__ ((visibility("default"))) zend_bool zend_dtrace_enabled;





__attribute__ ((visibility("default"))) void zend_message_dispatcher(zend_long message, const void *data);

__attribute__ ((visibility("default"))) zval *zend_get_configuration_directive(zend_string *name);
# 339 "Zend/zend.h"
typedef enum {
 EH_NORMAL = 0,
 EH_THROW
} zend_error_handling_t;

typedef struct {
 zend_error_handling_t handling;
 zend_class_entry *exception;
} zend_error_handling;

__attribute__ ((visibility("default"))) void zend_save_error_handling(zend_error_handling *current);
__attribute__ ((visibility("default"))) void zend_replace_error_handling(zend_error_handling_t error_handling, zend_class_entry *exception_class, zend_error_handling *current);
__attribute__ ((visibility("default"))) void zend_restore_error_handling(zend_error_handling *saved);





# 1 "Zend/zend_object_handlers.h" 1
# 23 "Zend/zend_object_handlers.h"
struct _zend_property_info;
# 44 "Zend/zend_object_handlers.h"
typedef zval *(*zend_object_read_property_t)(zend_object *object, zend_string *member, int type, void **cache_slot, zval *rv);


typedef zval *(*zend_object_read_dimension_t)(zend_object *object, zval *offset, int type, zval *rv);
# 57 "Zend/zend_object_handlers.h"
typedef zval *(*zend_object_write_property_t)(zend_object *object, zend_string *member, zval *value, void **cache_slot);


typedef void (*zend_object_write_dimension_t)(zend_object *object, zval *offset, zval *value);
# 70 "Zend/zend_object_handlers.h"
typedef zval *(*zend_object_get_property_ptr_ptr_t)(zend_object *object, zend_string *member, int type, void **cache_slot);







typedef int (*zend_object_has_property_t)(zend_object *object, zend_string *member, int has_set_exists, void **cache_slot);


typedef int (*zend_object_has_dimension_t)(zend_object *object, zval *member, int check_empty);


typedef void (*zend_object_unset_property_t)(zend_object *object, zend_string *member, void **cache_slot);


typedef void (*zend_object_unset_dimension_t)(zend_object *object, zval *offset);


typedef HashTable *(*zend_object_get_properties_t)(zend_object *object);

typedef HashTable *(*zend_object_get_debug_info_t)(zend_object *object, int *is_temp);

typedef enum _zend_prop_purpose {

 ZEND_PROP_PURPOSE_DEBUG,

 ZEND_PROP_PURPOSE_ARRAY_CAST,


 ZEND_PROP_PURPOSE_SERIALIZE,


 ZEND_PROP_PURPOSE_VAR_EXPORT,

 ZEND_PROP_PURPOSE_JSON,

 _ZEND_PROP_PURPOSE_NON_EXHAUSTIVE_ENUM
} zend_prop_purpose;


typedef zend_array *(*zend_object_get_properties_for_t)(zend_object *object, zend_prop_purpose purpose);





typedef zend_function *(*zend_object_get_method_t)(zend_object **object, zend_string *method, const zval *key);
typedef zend_function *(*zend_object_get_constructor_t)(zend_object *object);


typedef void (*zend_object_dtor_obj_t)(zend_object *object);
typedef void (*zend_object_free_obj_t)(zend_object *object);
typedef zend_object* (*zend_object_clone_obj_t)(zend_object *object);



typedef zend_string *(*zend_object_get_class_name_t)(const zend_object *object);

typedef int (*zend_object_compare_t)(zval *object1, zval *object2);




typedef int (*zend_object_cast_t)(zend_object *readobj, zval *retval, int type);



typedef int (*zend_object_count_elements_t)(zend_object *object, zend_long *count);

typedef int (*zend_object_get_closure_t)(zend_object *obj, zend_class_entry **ce_ptr, zend_function **fptr_ptr, zend_object **obj_ptr, zend_bool check_only);

typedef HashTable *(*zend_object_get_gc_t)(zend_object *object, zval **table, int *n);

typedef int (*zend_object_do_operation_t)(zend_uchar opcode, zval *result, zval *op1, zval *op2);

struct _zend_object_handlers {

 int offset;

 zend_object_free_obj_t free_obj;
 zend_object_dtor_obj_t dtor_obj;
 zend_object_clone_obj_t clone_obj;
 zend_object_read_property_t read_property;
 zend_object_write_property_t write_property;
 zend_object_read_dimension_t read_dimension;
 zend_object_write_dimension_t write_dimension;
 zend_object_get_property_ptr_ptr_t get_property_ptr_ptr;
 zend_object_has_property_t has_property;
 zend_object_unset_property_t unset_property;
 zend_object_has_dimension_t has_dimension;
 zend_object_unset_dimension_t unset_dimension;
 zend_object_get_properties_t get_properties;
 zend_object_get_method_t get_method;
 zend_object_get_constructor_t get_constructor;
 zend_object_get_class_name_t get_class_name;
 zend_object_cast_t cast_object;
 zend_object_count_elements_t count_elements;
 zend_object_get_debug_info_t get_debug_info;
 zend_object_get_closure_t get_closure;
 zend_object_get_gc_t get_gc;
 zend_object_do_operation_t do_operation;
 zend_object_compare_t compare;
 zend_object_get_properties_for_t get_properties_for;
};


extern const __attribute__ ((visibility("default"))) zend_object_handlers std_object_handlers;
# 190 "Zend/zend_object_handlers.h"
__attribute__ ((visibility("default"))) void zend_class_init_statics(zend_class_entry *ce);
__attribute__ ((visibility("default"))) zend_function *zend_std_get_static_method(zend_class_entry *ce, zend_string *function_name_strval, const zval *key);
__attribute__ ((visibility("default"))) zval *zend_std_get_static_property_with_info(zend_class_entry *ce, zend_string *property_name, int type, struct _zend_property_info **prop_info);
__attribute__ ((visibility("default"))) zval *zend_std_get_static_property(zend_class_entry *ce, zend_string *property_name, int type);
__attribute__ ((visibility("default"))) zend_bool zend_std_unset_static_property(zend_class_entry *ce, zend_string *property_name);
__attribute__ ((visibility("default"))) zend_function *zend_std_get_constructor(zend_object *object);
__attribute__ ((visibility("default"))) struct _zend_property_info *zend_get_property_info(zend_class_entry *ce, zend_string *member, int silent);
__attribute__ ((visibility("default"))) HashTable *zend_std_get_properties(zend_object *object);
__attribute__ ((visibility("default"))) HashTable *zend_std_get_gc(zend_object *object, zval **table, int *n);
__attribute__ ((visibility("default"))) HashTable *zend_std_get_debug_info(zend_object *object, int *is_temp);
__attribute__ ((visibility("default"))) int zend_std_cast_object_tostring(zend_object *object, zval *writeobj, int type);
__attribute__ ((visibility("default"))) zval *zend_std_get_property_ptr_ptr(zend_object *object, zend_string *member, int type, void **cache_slot);
__attribute__ ((visibility("default"))) zval *zend_std_read_property(zend_object *object, zend_string *member, int type, void **cache_slot, zval *rv);
__attribute__ ((visibility("default"))) zval *zend_std_write_property(zend_object *object, zend_string *member, zval *value, void **cache_slot);
__attribute__ ((visibility("default"))) int zend_std_has_property(zend_object *object, zend_string *member, int has_set_exists, void **cache_slot);
__attribute__ ((visibility("default"))) void zend_std_unset_property(zend_object *object, zend_string *member, void **cache_slot);
__attribute__ ((visibility("default"))) zval *zend_std_read_dimension(zend_object *object, zval *offset, int type, zval *rv);
__attribute__ ((visibility("default"))) void zend_std_write_dimension(zend_object *object, zval *offset, zval *value);
__attribute__ ((visibility("default"))) int zend_std_has_dimension(zend_object *object, zval *offset, int check_empty);
__attribute__ ((visibility("default"))) void zend_std_unset_dimension(zend_object *object, zval *offset);
__attribute__ ((visibility("default"))) zend_function *zend_std_get_method(zend_object **obj_ptr, zend_string *method_name, const zval *key);
__attribute__ ((visibility("default"))) zend_string *zend_std_get_class_name(const zend_object *zobj);
__attribute__ ((visibility("default"))) int zend_std_compare_objects(zval *o1, zval *o2);
__attribute__ ((visibility("default"))) int zend_std_get_closure(zend_object *obj, zend_class_entry **ce_ptr, zend_function **fptr_ptr, zend_object **obj_ptr, zend_bool check_only);
__attribute__ ((visibility("default"))) void rebuild_object_properties(zend_object *zobj);



__attribute__ ((visibility("default"))) int zend_objects_not_comparable(zval *o1, zval *o2);

__attribute__ ((visibility("default"))) int zend_check_protected(zend_class_entry *ce, zend_class_entry *scope);

__attribute__ ((visibility("default"))) int zend_check_property_access(zend_object *zobj, zend_string *prop_info_name, zend_bool is_dynamic);

__attribute__ ((visibility("default"))) zend_function *zend_get_call_trampoline_func(zend_class_entry *ce, zend_string *method_name, int is_static);

__attribute__ ((visibility("default"))) uint32_t *zend_get_property_guard(zend_object *zobj, zend_string *member);



__attribute__ ((visibility("default"))) HashTable *zend_std_get_properties_for(zend_object *obj, zend_prop_purpose purpose);



__attribute__ ((visibility("default"))) HashTable *zend_get_properties_for(zval *obj, zend_prop_purpose purpose);
# 357 "Zend/zend.h" 2
# 1 "Zend/zend_operators.h" 1
# 24 "Zend/zend_operators.h"
# 1 "/emsdk_portable/fastcomp/emscripten/system/include/libc/errno.h" 1 3
# 10 "/emsdk_portable/fastcomp/emscripten/system/include/libc/errno.h" 3
# 1 "/emsdk_portable/fastcomp/emscripten/system/lib/libc/musl/arch/emscripten/bits/errno.h" 1 3
# 11 "/emsdk_portable/fastcomp/emscripten/system/include/libc/errno.h" 2 3

int *__errno_location(void);



extern char *program_invocation_short_name, *program_invocation_name;
# 25 "Zend/zend_operators.h" 2

# 1 "/emsdk_portable/fastcomp/emscripten/system/include/libc/assert.h" 1 3
# 20 "/emsdk_portable/fastcomp/emscripten/system/include/libc/assert.h" 3
_Noreturn

void __assert_fail (const char *, const char *, int, const char *);
# 27 "Zend/zend_operators.h" 2







# 1 "Zend/zend_strtod.h" 1
# 23 "Zend/zend_strtod.h"
# 1 "Zend/zend.h" 1
# 24 "Zend/zend_strtod.h" 2


__attribute__ ((visibility("default"))) void zend_freedtoa(char *s);
__attribute__ ((visibility("default"))) char * zend_dtoa(double _d, int mode, int ndigits, int *decpt, int *sign, char **rve);
__attribute__ ((visibility("default"))) double zend_strtod(const char *s00, const char **se);
__attribute__ ((visibility("default"))) double zend_hex_strtod(const char *str, const char **endptr);
__attribute__ ((visibility("default"))) double zend_oct_strtod(const char *str, const char **endptr);
__attribute__ ((visibility("default"))) double zend_bin_strtod(const char *str, const char **endptr);
__attribute__ ((visibility("default"))) int zend_startup_strtod(void);
__attribute__ ((visibility("default"))) int zend_shutdown_strtod(void);
# 35 "Zend/zend_operators.h" 2
# 1 "Zend/zend_multiply.h" 1
# 289 "Zend/zend_multiply.h"
static inline __attribute__((always_inline)) size_t zend_safe_address(size_t nmemb, size_t size, size_t offset, _Bool *overflow)
{
 uint64_t res = (uint64_t) nmemb * (uint64_t) size + (uint64_t) offset;

 if (__builtin_expect(!!(res > 0xFFFFFFFFULL), 0)) {
  *overflow = 1;
  return 0;
 }
 *overflow = 0;
 return (size_t) res;
}
# 318 "Zend/zend_multiply.h"
static inline __attribute__((always_inline)) size_t zend_safe_address_guarded(size_t nmemb, size_t size, size_t offset)
{
 _Bool overflow;
 size_t ret = zend_safe_address(nmemb, size, offset, &overflow);

 if (__builtin_expect(!!(overflow), 0)) {
  zend_error_noreturn((1<<0L), "Possible integer overflow in memory allocation (%zu * %zu + %zu)", nmemb, size, offset);
  return 0;
 }
 return ret;
}


static inline __attribute__((always_inline)) size_t zend_safe_addmult(size_t nmemb, size_t size, size_t offset, const char *message)
{
 _Bool overflow;
 size_t ret = zend_safe_address(nmemb, size, offset, &overflow);

 if (__builtin_expect(!!(overflow), 0)) {
  zend_error_noreturn((1<<0L), "Possible integer overflow in %s (%zu * %zu + %zu)", message, nmemb, size, offset);
  return 0;
 }
 return ret;
}
# 36 "Zend/zend_operators.h" 2





__attribute__ ((visibility("default"))) zend_result add_function(zval *result, zval *op1, zval *op2);
__attribute__ ((visibility("default"))) zend_result sub_function(zval *result, zval *op1, zval *op2);
__attribute__ ((visibility("default"))) zend_result mul_function(zval *result, zval *op1, zval *op2);
__attribute__ ((visibility("default"))) zend_result pow_function(zval *result, zval *op1, zval *op2);
__attribute__ ((visibility("default"))) zend_result div_function(zval *result, zval *op1, zval *op2);
__attribute__ ((visibility("default"))) zend_result mod_function(zval *result, zval *op1, zval *op2);
__attribute__ ((visibility("default"))) zend_result boolean_xor_function(zval *result, zval *op1, zval *op2);
__attribute__ ((visibility("default"))) zend_result boolean_not_function(zval *result, zval *op1);
__attribute__ ((visibility("default"))) zend_result bitwise_not_function(zval *result, zval *op1);
__attribute__ ((visibility("default"))) zend_result bitwise_or_function(zval *result, zval *op1, zval *op2);
__attribute__ ((visibility("default"))) zend_result bitwise_and_function(zval *result, zval *op1, zval *op2);
__attribute__ ((visibility("default"))) zend_result bitwise_xor_function(zval *result, zval *op1, zval *op2);
__attribute__ ((visibility("default"))) zend_result shift_left_function(zval *result, zval *op1, zval *op2);
__attribute__ ((visibility("default"))) zend_result shift_right_function(zval *result, zval *op1, zval *op2);
__attribute__ ((visibility("default"))) zend_result concat_function(zval *result, zval *op1, zval *op2);

__attribute__ ((visibility("default"))) zend_bool zend_is_identical(zval *op1, zval *op2);

__attribute__ ((visibility("default"))) zend_result is_equal_function(zval *result, zval *op1, zval *op2);
__attribute__ ((visibility("default"))) zend_result is_identical_function(zval *result, zval *op1, zval *op2);
__attribute__ ((visibility("default"))) zend_result is_not_identical_function(zval *result, zval *op1, zval *op2);
__attribute__ ((visibility("default"))) zend_result is_not_equal_function(zval *result, zval *op1, zval *op2);
__attribute__ ((visibility("default"))) zend_result is_smaller_function(zval *result, zval *op1, zval *op2);
__attribute__ ((visibility("default"))) zend_result is_smaller_or_equal_function(zval *result, zval *op1, zval *op2);

__attribute__ ((visibility("default"))) zend_bool zend_class_implements_interface(const zend_class_entry *class_ce, const zend_class_entry *interface_ce);
__attribute__ ((visibility("default"))) zend_bool instanceof_function_slow(const zend_class_entry *instance_ce, const zend_class_entry *ce);

static inline __attribute__((always_inline)) zend_bool instanceof_function(
  const zend_class_entry *instance_ce, const zend_class_entry *ce) {
 return instance_ce == ce || instanceof_function_slow(instance_ce, ce);
}
# 89 "Zend/zend_operators.h"
__attribute__ ((visibility("default"))) zend_uchar _is_numeric_string_ex(const char *str, size_t length, zend_long *lval,
 double *dval, _Bool allow_errors, int *oflow_info, _Bool *trailing_data);

__attribute__ ((visibility("default"))) const char* zend_memnstr_ex(const char *haystack, const char *needle, size_t needle_len, const char *end);
__attribute__ ((visibility("default"))) const char* zend_memnrstr_ex(const char *haystack, const char *needle, size_t needle_len, const char *end);
# 102 "Zend/zend_operators.h"
__attribute__ ((visibility("default"))) zend_long zend_dval_to_lval_slow(double d);

static inline __attribute__((always_inline)) zend_long zend_dval_to_lval(double d)
{
 if (__builtin_expect(!!(!( sizeof(d) == sizeof(float) ? (__FLOAT_BITS(d) & 0x7fffffff) < 0x7f800000 : sizeof(d) == sizeof(double) ? (__DOUBLE_BITS(d) & -1ULL>>1) < 0x7ffULL<<52 : __fpclassifyl(d) > 1)), 0) || __builtin_expect(!!(( sizeof(d) == sizeof(float) ? (__FLOAT_BITS(d) & 0x7fffffff) > 0x7f800000 : sizeof(d) == sizeof(double) ? (__DOUBLE_BITS(d) & -1ULL>>1) > 0x7ffULL<<52 : __fpclassifyl(d) == 0)), 0)) {
  return 0;
 } else if (!(!((d) > (double)(0x7fffffff) || (d) < (double)(-1-0x7fffffff)))) {
  return zend_dval_to_lval_slow(d);
 }
 return (zend_long)d;
}

static inline __attribute__((always_inline)) zend_long zend_dval_to_lval_cap(double d)
{
 if (__builtin_expect(!!(!( sizeof(d) == sizeof(float) ? (__FLOAT_BITS(d) & 0x7fffffff) < 0x7f800000 : sizeof(d) == sizeof(double) ? (__DOUBLE_BITS(d) & -1ULL>>1) < 0x7ffULL<<52 : __fpclassifyl(d) > 1)), 0) || __builtin_expect(!!(( sizeof(d) == sizeof(float) ? (__FLOAT_BITS(d) & 0x7fffffff) > 0x7f800000 : sizeof(d) == sizeof(double) ? (__DOUBLE_BITS(d) & -1ULL>>1) > 0x7ffULL<<52 : __fpclassifyl(d) == 0)), 0)) {
  return 0;
 } else if (!(!((d) > (double)(0x7fffffff) || (d) < (double)(-1-0x7fffffff)))) {
  return (d > 0 ? (0x7fffffff) : (-1-0x7fffffff));
 }
 return (zend_long)d;
}





static inline __attribute__((always_inline)) zend_uchar is_numeric_string_ex(const char *str, size_t length, zend_long *lval,
 double *dval, _Bool allow_errors, int *oflow_info, _Bool *trailing_data)
{
 if (*str > '9') {
  return 0;
 }
 return _is_numeric_string_ex(str, length, lval, dval, allow_errors, oflow_info, trailing_data);
}

static inline __attribute__((always_inline)) zend_uchar is_numeric_string(const char *str, size_t length, zend_long *lval, double *dval, _Bool allow_errors) {
    return is_numeric_string_ex(str, length, lval, dval, allow_errors, ((void*)0), ((void*)0));
}

__attribute__ ((visibility("default"))) zend_uchar is_numeric_str_function(const zend_string *str, zend_long *lval, double *dval);

static inline __attribute__((always_inline)) const char *
zend_memnstr(const char *haystack, const char *needle, size_t needle_len, const char *end)
{
 const char *p = haystack;
 ptrdiff_t off_p;
 size_t off_s;

 if (needle_len == 0) {
  return p;
 }

 if (needle_len == 1) {
  return (const char *)memchr(p, *needle, (end-p));
 }

 off_p = end - haystack;
 off_s = (off_p > 0) ? (size_t)off_p : 0;

 if (needle_len > off_s) {
  return ((void*)0);
 }

 if (__builtin_expect(!!(off_s < 1024 || needle_len < 9), 1)) {
  const char ne = needle[needle_len-1];
  end -= needle_len;

  while (p <= end) {
   if ((p = (const char *)memchr(p, *needle, (end-p+1))) && ne == p[needle_len-1]) {
    if (!memcmp(needle+1, p+1, needle_len-2)) {
     return p;
    }
   }

   if (p == ((void*)0)) {
    return ((void*)0);
   }

   p++;
  }

  return ((void*)0);
 } else {
  return zend_memnstr_ex(haystack, needle, needle_len, end);
 }
}

static inline __attribute__((always_inline)) const void *zend_memrchr(const void *s, int c, size_t n)
{
 const unsigned char *e;
 if (0 == n) {
  return ((void*)0);
 }

 for (e = (const unsigned char *)s + n - 1; e >= (const unsigned char *)s; e--) {
  if (*e == (const unsigned char)c) {
   return (const void *)e;
  }
 }
 return ((void*)0);
}


static inline __attribute__((always_inline)) const char *
zend_memnrstr(const char *haystack, const char *needle, size_t needle_len, const char *end)
{
    const char *p = end;
    ptrdiff_t off_p;
    size_t off_s;

 if (needle_len == 0) {
  return p;
 }

    if (needle_len == 1) {
        return (const char *)zend_memrchr(haystack, *needle, (p - haystack));
    }

    off_p = end - haystack;
    off_s = (off_p > 0) ? (size_t)off_p : 0;

    if (needle_len > off_s) {
        return ((void*)0);
    }

 if (__builtin_expect(!!(off_s < 1024 || needle_len < 3), 1)) {
  const char ne = needle[needle_len-1];
  p -= needle_len;

  do {
   p = (const char *)zend_memrchr(haystack, *needle, (p - haystack) + 1);
   if (!p) {
    return ((void*)0);
   }
   if (ne == p[needle_len-1] && !memcmp(needle + 1, p + 1, needle_len - 2)) {
    return p;
   }
  } while (p-- >= haystack);

  return ((void*)0);
 } else {
  return zend_memnrstr_ex(haystack, needle, needle_len, end);
 }
}

__attribute__ ((visibility("default"))) zend_result increment_function(zval *op1);
__attribute__ ((visibility("default"))) zend_result decrement_function(zval *op2);

__attribute__ ((visibility("default"))) void convert_scalar_to_number(zval *op);
__attribute__ ((visibility("default"))) void _convert_to_string(zval *op);
__attribute__ ((visibility("default"))) void convert_to_long(zval *op);
__attribute__ ((visibility("default"))) void convert_to_double(zval *op);
__attribute__ ((visibility("default"))) void convert_to_long_base(zval *op, int base);
__attribute__ ((visibility("default"))) void convert_to_null(zval *op);
__attribute__ ((visibility("default"))) void convert_to_boolean(zval *op);
__attribute__ ((visibility("default"))) void convert_to_array(zval *op);
__attribute__ ((visibility("default"))) void convert_to_object(zval *op);

__attribute__ ((visibility("default"))) zend_long zval_get_long_func(zval *op);
__attribute__ ((visibility("default"))) double zval_get_double_func(zval *op);
__attribute__ ((visibility("default"))) zend_string* zval_get_string_func(zval *op);
__attribute__ ((visibility("default"))) zend_string* zval_try_get_string_func(zval *op);

static inline __attribute__((always_inline)) zend_long zval_get_long(zval *op) {
 return __builtin_expect(!!(zval_get_type(&(*(op))) == 4), 1) ? (*(op)).value.lval : zval_get_long_func(op);
}
static inline __attribute__((always_inline)) double zval_get_double(zval *op) {
 return __builtin_expect(!!(zval_get_type(&(*(op))) == 5), 1) ? (*(op)).value.dval : zval_get_double_func(op);
}
static inline __attribute__((always_inline)) zend_string *zval_get_string(zval *op) {
 return __builtin_expect(!!(zval_get_type(&(*(op))) == 6), 1) ? zend_string_copy((*(op)).value.str) : zval_get_string_func(op);
}

static inline __attribute__((always_inline)) zend_string *zval_get_tmp_string(zval *op, zend_string **tmp) {
 if (__builtin_expect(!!(zval_get_type(&(*(op))) == 6), 1)) {
  *tmp = ((void*)0);
  return (*(op)).value.str;
 } else {
  return *tmp = zval_get_string_func(op);
 }
}
static inline __attribute__((always_inline)) void zend_tmp_string_release(zend_string *tmp) {
 if (__builtin_expect(!!(tmp), 0)) {
  zend_string_release_ex(tmp, 0);
 }
}


static inline __attribute__((always_inline)) zend_string *zval_try_get_string(zval *op) {
 if (__builtin_expect(!!(zval_get_type(&(*(op))) == 6), 1)) {
  zend_string *ret = zend_string_copy((*(op)).value.str);
  do { if (__builtin_expect(!(ret != ((void*)0)), 0)) __builtin_unreachable(); } while (0);
  return ret;
 } else {
  return zval_try_get_string_func(op);
 }
}


static inline __attribute__((always_inline)) zend_string *zval_try_get_tmp_string(zval *op, zend_string **tmp) {
 if (__builtin_expect(!!(zval_get_type(&(*(op))) == 6), 1)) {
  zend_string *ret = (*(op)).value.str;
  *tmp = ((void*)0);
  do { if (__builtin_expect(!(ret != ((void*)0)), 0)) __builtin_unreachable(); } while (0);
  return ret;
 } else {
  return *tmp = zval_try_get_string_func(op);
 }
}



__attribute__ ((visibility("default"))) zend_bool _try_convert_to_string(zval *op);
static inline __attribute__((always_inline)) zend_bool try_convert_to_string(zval *op) {
 if (zval_get_type(&(*(op))) == 6) {
  return 1;
 }
 return _try_convert_to_string(op);
}
# 333 "Zend/zend_operators.h"
__attribute__ ((visibility("default"))) int zend_is_true(zval *op);
__attribute__ ((visibility("default"))) _Bool zend_object_is_true(zval *op);




static inline __attribute__((always_inline)) _Bool i_zend_is_true(zval *op)
{
 _Bool result = 0;

again:
 switch (zval_get_type(&(*(op)))) {
  case 3:
   result = 1;
   break;
  case 4:
   if ((*(op)).value.lval) {
    result = 1;
   }
   break;
  case 5:
   if ((*(op)).value.dval) {
    result = 1;
   }
   break;
  case 6:
   if (((*(op)).value.str)->len > 1 || (((*(op)).value.str)->len && ((*(op)).value.str)->val[0] != '0')) {
    result = 1;
   }
   break;
  case 7:
   if (((*(op)).value.arr)->nNumOfElements) {
    result = 1;
   }
   break;
  case 8:
   if (__builtin_expect(!!((*(op)).value.obj->handlers->cast_object == zend_std_cast_object_tostring), 1)) {
    result = 1;
   } else {
    result = zend_object_is_true(op);
   }
   break;
  case 9:
   if (__builtin_expect(!!((*op).value.res->handle), 1)) {
    result = 1;
   }
   break;
  case 10:
   op = &(*(op)).value.ref->val;
   goto again;
   break;
  default:
   break;
 }
 return result;
}







__attribute__ ((visibility("default"))) int zend_compare(zval *op1, zval *op2);

__attribute__ ((visibility("default"))) int compare_function(zval *result, zval *op1, zval *op2);

__attribute__ ((visibility("default"))) int numeric_compare_function(zval *op1, zval *op2);
__attribute__ ((visibility("default"))) int string_compare_function_ex(zval *op1, zval *op2, zend_bool case_insensitive);
__attribute__ ((visibility("default"))) int string_compare_function(zval *op1, zval *op2);
__attribute__ ((visibility("default"))) int string_case_compare_function(zval *op1, zval *op2);
__attribute__ ((visibility("default"))) int string_locale_compare_function(zval *op1, zval *op2);

__attribute__ ((visibility("default"))) void zend_str_tolower(char *str, size_t length);
__attribute__ ((visibility("default"))) char* zend_str_tolower_copy(char *dest, const char *source, size_t length);
__attribute__ ((visibility("default"))) char* zend_str_tolower_dup(const char *source, size_t length);
__attribute__ ((visibility("default"))) char* zend_str_tolower_dup_ex(const char *source, size_t length);
__attribute__ ((visibility("default"))) zend_string* zend_string_tolower_ex(zend_string *str, _Bool persistent);



__attribute__ ((visibility("default"))) int zend_binary_zval_strcmp(zval *s1, zval *s2);
__attribute__ ((visibility("default"))) int zend_binary_zval_strncmp(zval *s1, zval *s2, zval *s3);
__attribute__ ((visibility("default"))) int zend_binary_zval_strcasecmp(zval *s1, zval *s2);
__attribute__ ((visibility("default"))) int zend_binary_zval_strncasecmp(zval *s1, zval *s2, zval *s3);
__attribute__ ((visibility("default"))) int zend_binary_strcmp(const char *s1, size_t len1, const char *s2, size_t len2);
__attribute__ ((visibility("default"))) int zend_binary_strncmp(const char *s1, size_t len1, const char *s2, size_t len2, size_t length);
__attribute__ ((visibility("default"))) int zend_binary_strcasecmp(const char *s1, size_t len1, const char *s2, size_t len2);
__attribute__ ((visibility("default"))) int zend_binary_strncasecmp(const char *s1, size_t len1, const char *s2, size_t len2, size_t length);
__attribute__ ((visibility("default"))) int zend_binary_strcasecmp_l(const char *s1, size_t len1, const char *s2, size_t len2);
__attribute__ ((visibility("default"))) int zend_binary_strncasecmp_l(const char *s1, size_t len1, const char *s2, size_t len2, size_t length);

__attribute__ ((visibility("default"))) _Bool zendi_smart_streq(zend_string *s1, zend_string *s2);
__attribute__ ((visibility("default"))) int zendi_smart_strcmp(zend_string *s1, zend_string *s2);
__attribute__ ((visibility("default"))) int zend_compare_symbol_tables(HashTable *ht1, HashTable *ht2);
__attribute__ ((visibility("default"))) int zend_compare_arrays(zval *a1, zval *a2);
__attribute__ ((visibility("default"))) int zend_compare_objects(zval *o1, zval *o2);

__attribute__ ((visibility("default"))) int zend_atoi(const char *str, size_t str_len);
__attribute__ ((visibility("default"))) zend_long zend_atol(const char *str, size_t str_len);

__attribute__ ((visibility("default"))) void zend_locale_sprintf_double(zval *op );
# 516 "Zend/zend_operators.h"
static inline __attribute__((always_inline)) void fast_long_increment_function(zval *op1)
{
# 554 "Zend/zend_operators.h"
 long lresult;
 if (__builtin_expect(!!(__builtin_saddl_overflow((*(op1)).value.lval, 1, &lresult)), 0)) {

  do { zval *__z = (op1); (*(__z)).value.dval = (double)(0x7fffffff) + 1.0; (*(__z)).u1.type_info = 5; } while (0);
 } else {
  (*(op1)).value.lval = lresult;
 }
# 577 "Zend/zend_operators.h"
}

static inline __attribute__((always_inline)) void fast_long_decrement_function(zval *op1)
{
# 617 "Zend/zend_operators.h"
 long lresult;
 if (__builtin_expect(!!(__builtin_ssubl_overflow((*(op1)).value.lval, 1, &lresult)), 0)) {

  do { zval *__z = (op1); (*(__z)).value.dval = (double)(-1-0x7fffffff) - 1.0; (*(__z)).u1.type_info = 5; } while (0);
 } else {
  (*(op1)).value.lval = lresult;
 }
# 640 "Zend/zend_operators.h"
}

static inline __attribute__((always_inline)) void fast_long_add_function(zval *result, zval *op1, zval *op2)
{
# 701 "Zend/zend_operators.h"
 long lresult;
 if (__builtin_expect(!!(__builtin_saddl_overflow((*(op1)).value.lval, (*(op2)).value.lval, &lresult)), 0)) {
  do { zval *__z = (result); (*(__z)).value.dval = (double) (*(op1)).value.lval + (double) (*(op2)).value.lval; (*(__z)).u1.type_info = 5; } while (0);
 } else {
  do { zval *__z = (result); (*(__z)).value.lval = lresult; (*(__z)).u1.type_info = 4; } while (0);
 }
# 728 "Zend/zend_operators.h"
}

static inline __attribute__((always_inline)) zend_result fast_add_function(zval *result, zval *op1, zval *op2)
{
 if (__builtin_expect(!!(zval_get_type(&(*(op1))) == 4), 1)) {
  if (__builtin_expect(!!(zval_get_type(&(*(op2))) == 4), 1)) {
   fast_long_add_function(result, op1, op2);
   return SUCCESS;
  } else if (__builtin_expect(!!(zval_get_type(&(*(op2))) == 5), 1)) {
   do { zval *__z = (result); (*(__z)).value.dval = ((double)(*(op1)).value.lval) + (*(op2)).value.dval; (*(__z)).u1.type_info = 5; } while (0);
   return SUCCESS;
  }
 } else if (__builtin_expect(!!(zval_get_type(&(*(op1))) == 5), 1)) {
  if (__builtin_expect(!!(zval_get_type(&(*(op2))) == 5), 1)) {
   do { zval *__z = (result); (*(__z)).value.dval = (*(op1)).value.dval + (*(op2)).value.dval; (*(__z)).u1.type_info = 5; } while (0);
   return SUCCESS;
  } else if (__builtin_expect(!!(zval_get_type(&(*(op2))) == 4), 1)) {
   do { zval *__z = (result); (*(__z)).value.dval = (*(op1)).value.dval + ((double)(*(op2)).value.lval); (*(__z)).u1.type_info = 5; } while (0);
   return SUCCESS;
  }
 }
 return add_function(result, op1, op2);
}

static inline __attribute__((always_inline)) void fast_long_sub_function(zval *result, zval *op1, zval *op2)
{
# 811 "Zend/zend_operators.h"
 long lresult;
 if (__builtin_expect(!!(__builtin_ssubl_overflow((*(op1)).value.lval, (*(op2)).value.lval, &lresult)), 0)) {
  do { zval *__z = (result); (*(__z)).value.dval = (double) (*(op1)).value.lval - (double) (*(op2)).value.lval; (*(__z)).u1.type_info = 5; } while (0);
 } else {
  do { zval *__z = (result); (*(__z)).value.lval = lresult; (*(__z)).u1.type_info = 4; } while (0);
 }
# 832 "Zend/zend_operators.h"
}

static inline __attribute__((always_inline)) zend_result fast_div_function(zval *result, zval *op1, zval *op2)
{
 return div_function(result, op1, op2);
}

static inline __attribute__((always_inline)) _Bool zend_fast_equal_strings(zend_string *s1, zend_string *s2)
{
 if (s1 == s2) {
  return 1;
 } else if ((s1)->val[0] > '9' || (s2)->val[0] > '9') {
  return zend_string_equal_content(s1, s2);
 } else {
  return zendi_smart_streq(s1, s2);
 }
}

static inline __attribute__((always_inline)) _Bool fast_equal_check_function(zval *op1, zval *op2)
{
 if (__builtin_expect(!!(zval_get_type(&(*(op1))) == 4), 1)) {
  if (__builtin_expect(!!(zval_get_type(&(*(op2))) == 4), 1)) {
   return (*(op1)).value.lval == (*(op2)).value.lval;
  } else if (__builtin_expect(!!(zval_get_type(&(*(op2))) == 5), 1)) {
   return ((double)(*(op1)).value.lval) == (*(op2)).value.dval;
  }
 } else if (__builtin_expect(!!(zval_get_type(&(*(op1))) == 5), 1)) {
  if (__builtin_expect(!!(zval_get_type(&(*(op2))) == 5), 1)) {
   return (*(op1)).value.dval == (*(op2)).value.dval;
  } else if (__builtin_expect(!!(zval_get_type(&(*(op2))) == 4), 1)) {
   return (*(op1)).value.dval == ((double)(*(op2)).value.lval);
  }
 } else if (__builtin_expect(!!(zval_get_type(&(*(op1))) == 6), 1)) {
  if (__builtin_expect(!!(zval_get_type(&(*(op2))) == 6), 1)) {
   return zend_fast_equal_strings((*(op1)).value.str, (*(op2)).value.str);
  }
 }
 return zend_compare(op1, op2) == 0;
}

static inline __attribute__((always_inline)) _Bool fast_equal_check_long(zval *op1, zval *op2)
{
 if (__builtin_expect(!!(zval_get_type(&(*(op2))) == 4), 1)) {
  return (*(op1)).value.lval == (*(op2)).value.lval;
 }
 return zend_compare(op1, op2) == 0;
}

static inline __attribute__((always_inline)) _Bool fast_equal_check_string(zval *op1, zval *op2)
{
 if (__builtin_expect(!!(zval_get_type(&(*(op2))) == 6), 1)) {
  return zend_fast_equal_strings((*(op1)).value.str, (*(op2)).value.str);
 }
 return zend_compare(op1, op2) == 0;
}

static inline __attribute__((always_inline)) zend_bool fast_is_identical_function(zval *op1, zval *op2)
{
 if (zval_get_type(&(*(op1))) != zval_get_type(&(*(op2)))) {
  return 0;
 } else if (zval_get_type(&(*(op1))) <= 3) {
  return 1;
 }
 return zend_is_identical(op1, op2);
}

static inline __attribute__((always_inline)) zend_bool fast_is_not_identical_function(zval *op1, zval *op2)
{
 if (zval_get_type(&(*(op1))) != zval_get_type(&(*(op2)))) {
  return 1;
 } else if (zval_get_type(&(*(op1))) <= 3) {
  return 0;
 }
 return !zend_is_identical(op1, op2);
}


static inline __attribute__((always_inline)) char *zend_print_ulong_to_buf(char *buf, zend_ulong num) {
 *buf = '\0';
 do {
  *--buf = (char) (num % 10) + '0';
  num /= 10;
 } while (num > 0);
 return buf;
}


static inline __attribute__((always_inline)) char *zend_print_long_to_buf(char *buf, zend_long num) {
 if (num < 0) {
     char *result = zend_print_ulong_to_buf(buf, ~((zend_ulong) num) + 1);
     *--result = '-';
  return result;
 } else {
     return zend_print_ulong_to_buf(buf, num);
 }
}

__attribute__ ((visibility("default"))) zend_string* zend_long_to_str(zend_long num);

static inline __attribute__((always_inline)) void zend_unwrap_reference(zval *op)
{
 if (zval_refcount_p(op) == 1) {
  do { zval *_z = (op); zend_reference *ref; do { if (__builtin_expect(!((zval_get_type(&(*(_z))) == 10)), 0)) __builtin_unreachable(); } while (0); ref = (*(_z)).value.ref; do { zval *_z1 = (_z); const zval *_z2 = (&ref->val); zend_refcounted *_gc = (*(_z2)).value.counted; uint32_t _t = (*(_z2)).u1.type_info; do { uint32_t _w2 = _z2->value.ww.w2; (*(_z1)).value.counted = _gc; _z1->value.ww.w2 = _w2; (*(_z1)).u1.type_info = _t; } while (0); } while (0); do { if (__builtin_constant_p(sizeof(zend_reference))) { if (sizeof(zend_reference) <= 8) { _efree_8(ref); } else if (sizeof(zend_reference) <= 16) { _efree_16(ref); } else if (sizeof(zend_reference) <= 24) { _efree_24(ref); } else if (sizeof(zend_reference) <= 32) { _efree_32(ref); } else if (sizeof(zend_reference) <= 40) { _efree_40(ref); } else if (sizeof(zend_reference) <= 48) { _efree_48(ref); } else if (sizeof(zend_reference) <= 56) { _efree_56(ref); } else if (sizeof(zend_reference) <= 64) { _efree_64(ref); } else if (sizeof(zend_reference) <= 80) { _efree_80(ref); } else if (sizeof(zend_reference) <= 96) { _efree_96(ref); } else if (sizeof(zend_reference) <= 112) { _efree_112(ref); } else if (sizeof(zend_reference) <= 128) { _efree_128(ref); } else if (sizeof(zend_reference) <= 160) { _efree_160(ref); } else if (sizeof(zend_reference) <= 192) { _efree_192(ref); } else if (sizeof(zend_reference) <= 224) { _efree_224(ref); } else if (sizeof(zend_reference) <= 256) { _efree_256(ref); } else if (sizeof(zend_reference) <= 320) { _efree_320(ref); } else if (sizeof(zend_reference) <= 384) { _efree_384(ref); } else if (sizeof(zend_reference) <= 448) { _efree_448(ref); } else if (sizeof(zend_reference) <= 512) { _efree_512(ref); } else if (sizeof(zend_reference) <= 640) { _efree_640(ref); } else if (sizeof(zend_reference) <= 768) { _efree_768(ref); } else if (sizeof(zend_reference) <= 896) { _efree_896(ref); } else if (sizeof(zend_reference) <= 1024) { _efree_1024(ref); } else if (sizeof(zend_reference) <= 1280) { _efree_1280(ref); } else if (sizeof(zend_reference) <= 1536) { _efree_1536(ref); } else if (sizeof(zend_reference) <= 1792) { _efree_1792(ref); } else if (sizeof(zend_reference) <= 2048) { _efree_2048(ref); } else if (sizeof(zend_reference) <= 2560) { _efree_2560(ref); } else if (sizeof(zend_reference) <= 3072) { _efree_3072(ref); } else if (sizeof(zend_reference) <= (((size_t) (2 * 1024 * 1024)) - ((4 * 1024) * (1)))) { _efree_large(ref, sizeof(zend_reference)); } else { _efree_huge(ref, sizeof(zend_reference)); } } else { _efree(ref); } } while (0); } while (0);
 } else {
  zval_delref_p(op);
  do { zval *_z1 = (op); const zval *_z2 = (&(*(op)).value.ref->val); zend_refcounted *_gc = (*(_z2)).value.counted; uint32_t _t = (*(_z2)).u1.type_info; do { uint32_t _w2 = _z2->value.ww.w2; (*(_z1)).value.counted = _gc; _z1->value.ww.w2 = _w2; (*(_z1)).u1.type_info = _t; } while (0); if ((((_t) & 0xff00) != 0)) { zend_gc_addref(&(_gc)->gc); } } while (0);
 }
}
# 358 "Zend/zend.h" 2
# 9 "/root/pib_eval.c" 2
# 1 "Zend/zend_compile.h" 1
# 49 "Zend/zend_compile.h"
typedef struct _zend_op_array zend_op_array;
typedef struct _zend_op zend_op;
# 63 "Zend/zend_compile.h"
typedef union _znode_op {
 uint32_t constant;
 uint32_t var;
 uint32_t num;
 uint32_t opline_num;

 zend_op *jmp_addr;




 zval *zv;

} znode_op;

typedef struct _znode {
 zend_uchar op_type;
 zend_uchar flag;
 union {
  znode_op op;
  zval constant;
 } u;
} znode;


typedef struct _zend_ast_znode {
 zend_ast_kind kind;
 zend_ast_attr attr;
 uint32_t lineno;
 znode node;
} zend_ast_znode;

__attribute__ ((visibility("default"))) zend_ast * zend_ast_create_znode(znode *node);

static inline __attribute__((always_inline)) znode *zend_ast_get_znode(zend_ast *ast) {
 return &((zend_ast_znode *) ast)->node;
}

typedef struct _zend_declarables {
 zend_long ticks;
} zend_declarables;


typedef struct _zend_file_context {
 zend_declarables declarables;

 zend_string *current_namespace;
 zend_bool in_namespace;
 zend_bool has_bracketed_namespaces;

 HashTable *imports;
 HashTable *imports_function;
 HashTable *imports_const;

 HashTable seen_symbols;
} zend_file_context;

typedef struct {
 uint32_t offset;
 uint32_t len;
} zend_lexer_ident_ref;

typedef union _zend_parser_stack_elem {
 zend_ast *ast;
 zend_string *str;
 zend_ulong num;
 unsigned char *ptr;
 zend_lexer_ident_ref ident;
} zend_parser_stack_elem;

void zend_compile_top_stmt(zend_ast *ast);
void zend_compile_stmt(zend_ast *ast);
void zend_compile_expr(znode *node, zend_ast *ast);
zend_op *zend_compile_var(znode *node, zend_ast *ast, uint32_t type, _Bool by_ref);
void zend_eval_const_expr(zend_ast **ast_ptr);
void zend_const_expr_to_zval(zval *result, zend_ast **ast_ptr);

typedef int (*user_opcode_handler_t) (zend_execute_data *execute_data);

struct _zend_op {
 const void *handler;
 znode_op op1;
 znode_op op2;
 znode_op result;
 uint32_t extended_value;
 uint32_t lineno;
 zend_uchar opcode;
 zend_uchar op1_type;
 zend_uchar op2_type;
 zend_uchar result_type;
};


typedef struct _zend_brk_cont_element {
 int start;
 int cont;
 int brk;
 int parent;
 zend_bool is_switch;
} zend_brk_cont_element;

typedef struct _zend_label {
 int brk_cont;
 uint32_t opline_num;
} zend_label;

typedef struct _zend_try_catch_element {
 uint32_t try_op;
 uint32_t catch_op;
 uint32_t finally_op;
 uint32_t finally_end;
} zend_try_catch_element;
# 183 "Zend/zend_compile.h"
typedef struct _zend_live_range {
 uint32_t var;
 uint32_t start;
 uint32_t end;
} zend_live_range;


typedef struct _zend_oparray_context {
 uint32_t opcodes_size;
 int vars_size;
 int literals_size;
 uint32_t fast_call_var;
 uint32_t try_catch_offset;
 int current_brk_cont;
 int last_brk_cont;
 zend_brk_cont_element *brk_cont_array;
 HashTable *labels;
} zend_oparray_context;
# 359 "Zend/zend_compile.h"
char *zend_visibility_string(uint32_t fn_flags);

typedef struct _zend_property_info {
 uint32_t offset;

 uint32_t flags;
 zend_string *name;
 zend_string *doc_comment;
 HashTable *attributes;
 zend_class_entry *ce;
 zend_type type;
} zend_property_info;
# 381 "Zend/zend_compile.h"
typedef struct _zend_class_constant {
 zval value;
 zend_string *doc_comment;
 HashTable *attributes;
 zend_class_entry *ce;
} zend_class_constant;


typedef struct _zend_internal_arg_info {
 const char *name;
 zend_type type;
 const char *default_value;
} zend_internal_arg_info;


typedef struct _zend_arg_info {
 zend_string *name;
 zend_type type;
 zend_string *default_value;
} zend_arg_info;






typedef struct _zend_internal_function_info {
 zend_uintptr_t required_num_args;
 zend_type type;
 const char *default_value;
} zend_internal_function_info;

struct _zend_op_array {

 zend_uchar type;
 zend_uchar arg_flags[3];
 uint32_t fn_flags;
 zend_string *function_name;
 zend_class_entry *scope;
 zend_function *prototype;
 uint32_t num_args;
 uint32_t required_num_args;
 zend_arg_info *arg_info;
 HashTable *attributes;


 int cache_size;
 int last_var;
 uint32_t T;
 uint32_t last;

 zend_op *opcodes;
 void ** * run_time_cache__ptr;
 HashTable * * static_variables_ptr__ptr;
 HashTable *static_variables;
 zend_string **vars;

 uint32_t *refcount;

 int last_live_range;
 int last_try_catch;
 zend_live_range *live_range;
 zend_try_catch_element *try_catch_array;

 zend_string *filename;
 uint32_t line_start;
 uint32_t line_end;
 zend_string *doc_comment;

 int last_literal;
 zval *literals;

 void *reserved[6];
};






typedef void ( *zif_handler)(zend_execute_data *execute_data, zval *return_value);

typedef struct _zend_internal_function {

 zend_uchar type;
 zend_uchar arg_flags[3];
 uint32_t fn_flags;
 zend_string* function_name;
 zend_class_entry *scope;
 zend_function *prototype;
 uint32_t num_args;
 uint32_t required_num_args;
 zend_internal_arg_info *arg_info;
 HashTable *attributes;


 zif_handler handler;
 struct _zend_module_entry *module;
 void *reserved[6];
} zend_internal_function;



union _zend_function {
 zend_uchar type;
 uint32_t quick_arg_flags;

 struct {
  zend_uchar type;
  zend_uchar arg_flags[3];
  uint32_t fn_flags;
  zend_string *function_name;
  zend_class_entry *scope;
  zend_function *prototype;
  uint32_t num_args;
  uint32_t required_num_args;
  zend_arg_info *arg_info;
  HashTable *attributes;
 } common;

 zend_op_array op_array;
 zend_internal_function internal_function;
};

struct _zend_execute_data {
 const zend_op *opline;
 zend_execute_data *call;
 zval *return_value;
 zend_function *func;
 zval This;
 zend_execute_data *prev_execute_data;
 zend_array *symbol_table;
 void **run_time_cache;
 zend_array *extra_named_params;
};
# 724 "Zend/zend_compile.h"
# 1 "Zend/zend_globals.h" 1
# 24 "Zend/zend_globals.h"
# 1 "/emsdk_portable/fastcomp/emscripten/system/include/libc/setjmp.h" 1 3
# 10 "/emsdk_portable/fastcomp/emscripten/system/include/libc/setjmp.h" 3
# 1 "/emsdk_portable/fastcomp/emscripten/system/lib/libc/musl/arch/emscripten/bits/setjmp.h" 1 3
typedef unsigned long __jmp_buf[6];
# 11 "/emsdk_portable/fastcomp/emscripten/system/include/libc/setjmp.h" 2 3

typedef struct __jmp_buf_tag {
 __jmp_buf __jb;
 unsigned long __fl;
 unsigned long __ss[128/sizeof(long)];
} jmp_buf[1];




typedef jmp_buf sigjmp_buf;






_Noreturn void siglongjmp (sigjmp_buf, int);




int _setjmp (jmp_buf);
_Noreturn void _longjmp (jmp_buf, int);


int setjmp (jmp_buf);
_Noreturn void longjmp (jmp_buf, int);
# 25 "Zend/zend_globals.h" 2

# 1 "Zend/zend_globals_macros.h" 1
# 23 "Zend/zend_globals_macros.h"
typedef struct _zend_compiler_globals zend_compiler_globals;
typedef struct _zend_executor_globals zend_executor_globals;
typedef struct _zend_php_scanner_globals zend_php_scanner_globals;
typedef struct _zend_ini_scanner_globals zend_ini_scanner_globals;
# 35 "Zend/zend_globals_macros.h"
extern __attribute__ ((visibility("default"))) struct _zend_compiler_globals compiler_globals;

__attribute__ ((visibility("default"))) int zendparse(void);







extern __attribute__ ((visibility("default"))) zend_executor_globals executor_globals;
# 55 "Zend/zend_globals_macros.h"
extern __attribute__ ((visibility("default"))) zend_php_scanner_globals language_scanner_globals;
# 66 "Zend/zend_globals_macros.h"
extern __attribute__ ((visibility("default"))) zend_ini_scanner_globals ini_scanner_globals;
# 27 "Zend/zend_globals.h" 2

# 1 "Zend/zend_stack.h" 1
# 23 "Zend/zend_stack.h"
typedef struct _zend_stack {
 int size, top, max;
 void *elements;
} zend_stack;





__attribute__ ((visibility("default"))) void zend_stack_init(zend_stack *stack, int size);
__attribute__ ((visibility("default"))) int zend_stack_push(zend_stack *stack, const void *element);
__attribute__ ((visibility("default"))) void *zend_stack_top(const zend_stack *stack);
__attribute__ ((visibility("default"))) void zend_stack_del_top(zend_stack *stack);
__attribute__ ((visibility("default"))) int zend_stack_int_top(const zend_stack *stack);
__attribute__ ((visibility("default"))) _Bool zend_stack_is_empty(const zend_stack *stack);
__attribute__ ((visibility("default"))) void zend_stack_destroy(zend_stack *stack);
__attribute__ ((visibility("default"))) void *zend_stack_base(const zend_stack *stack);
__attribute__ ((visibility("default"))) int zend_stack_count(const zend_stack *stack);
__attribute__ ((visibility("default"))) void zend_stack_apply(zend_stack *stack, int type, int (*apply_function)(void *element));
__attribute__ ((visibility("default"))) void zend_stack_apply_with_argument(zend_stack *stack, int type, int (*apply_function)(void *element, void *arg), void *arg);
__attribute__ ((visibility("default"))) void zend_stack_clean(zend_stack *stack, void (*func)(void *), zend_bool free_elements);
# 29 "Zend/zend_globals.h" 2
# 1 "Zend/zend_ptr_stack.h" 1
# 23 "Zend/zend_ptr_stack.h"
typedef struct _zend_ptr_stack {
 int top, max;
 void **elements;
 void **top_element;
 zend_bool persistent;
} zend_ptr_stack;





__attribute__ ((visibility("default"))) void zend_ptr_stack_init(zend_ptr_stack *stack);
__attribute__ ((visibility("default"))) void zend_ptr_stack_init_ex(zend_ptr_stack *stack, zend_bool persistent);
__attribute__ ((visibility("default"))) void zend_ptr_stack_n_push(zend_ptr_stack *stack, int count, ...);
__attribute__ ((visibility("default"))) void zend_ptr_stack_n_pop(zend_ptr_stack *stack, int count, ...);
__attribute__ ((visibility("default"))) void zend_ptr_stack_destroy(zend_ptr_stack *stack);
__attribute__ ((visibility("default"))) void zend_ptr_stack_apply(zend_ptr_stack *stack, void (*func)(void *));
__attribute__ ((visibility("default"))) void zend_ptr_stack_reverse_apply(zend_ptr_stack *stack, void (*func)(void *));
__attribute__ ((visibility("default"))) void zend_ptr_stack_clean(zend_ptr_stack *stack, void (*func)(void *), zend_bool free_elements);
__attribute__ ((visibility("default"))) int zend_ptr_stack_num_elements(zend_ptr_stack *stack);
# 57 "Zend/zend_ptr_stack.h"
static inline __attribute__((always_inline)) void zend_ptr_stack_3_push(zend_ptr_stack *stack, void *a, void *b, void *c)
{


 if (stack->top+3 > stack->max) { do { stack->max += 64; } while (stack->top+3 > stack->max); stack->elements = (void **) ((stack->persistent)?__zend_realloc((stack->elements), ((sizeof(void *) * (stack->max)))):_erealloc(((stack->elements)), (((sizeof(void *) * (stack->max)))) )); stack->top_element = stack->elements+stack->top; }

 stack->top += 3;
 *(stack->top_element++) = a;
 *(stack->top_element++) = b;
 *(stack->top_element++) = c;


}

static inline __attribute__((always_inline)) void zend_ptr_stack_2_push(zend_ptr_stack *stack, void *a, void *b)
{


 if (stack->top+2 > stack->max) { do { stack->max += 64; } while (stack->top+2 > stack->max); stack->elements = (void **) ((stack->persistent)?__zend_realloc((stack->elements), ((sizeof(void *) * (stack->max)))):_erealloc(((stack->elements)), (((sizeof(void *) * (stack->max)))) )); stack->top_element = stack->elements+stack->top; }

 stack->top += 2;
 *(stack->top_element++) = a;
 *(stack->top_element++) = b;


}

static inline __attribute__((always_inline)) void zend_ptr_stack_3_pop(zend_ptr_stack *stack, void **a, void **b, void **c)
{
 *a = *(--stack->top_element);
 *b = *(--stack->top_element);
 *c = *(--stack->top_element);
 stack->top -= 3;
}

static inline __attribute__((always_inline)) void zend_ptr_stack_2_pop(zend_ptr_stack *stack, void **a, void **b)
{
 *a = *(--stack->top_element);
 *b = *(--stack->top_element);
 stack->top -= 2;
}

static inline __attribute__((always_inline)) void zend_ptr_stack_push(zend_ptr_stack *stack, void *ptr)
{
 if (stack->top+1 > stack->max) { do { stack->max += 64; } while (stack->top+1 > stack->max); stack->elements = (void **) ((stack->persistent)?__zend_realloc((stack->elements), ((sizeof(void *) * (stack->max)))):_erealloc(((stack->elements)), (((sizeof(void *) * (stack->max)))) )); stack->top_element = stack->elements+stack->top; }

 stack->top++;
 *(stack->top_element++) = ptr;
}

static inline __attribute__((always_inline)) void *zend_ptr_stack_pop(zend_ptr_stack *stack)
{
 stack->top--;
 return *(--stack->top_element);
}

static inline __attribute__((always_inline)) void *zend_ptr_stack_top(zend_ptr_stack *stack)
{
    return stack->elements[stack->top - 1];
}
# 30 "Zend/zend_globals.h" 2


# 1 "Zend/zend_objects.h" 1
# 26 "Zend/zend_objects.h"
__attribute__ ((visibility("default"))) void zend_object_std_init(zend_object *object, zend_class_entry *ce);
__attribute__ ((visibility("default"))) zend_object* zend_objects_new(zend_class_entry *ce);
__attribute__ ((visibility("default"))) void zend_objects_clone_members(zend_object *new_object, zend_object *old_object);

__attribute__ ((visibility("default"))) void zend_object_std_dtor(zend_object *object);
__attribute__ ((visibility("default"))) void zend_objects_destroy_object(zend_object *object);
__attribute__ ((visibility("default"))) zend_object *zend_objects_clone_obj(zend_object *object);
# 33 "Zend/zend_globals.h" 2
# 1 "Zend/zend_objects_API.h" 1
# 24 "Zend/zend_objects_API.h"
# 1 "Zend/zend_compile.h" 1
# 25 "Zend/zend_objects_API.h" 2
# 45 "Zend/zend_objects_API.h"
typedef struct _zend_objects_store {
 zend_object **object_buckets;
 uint32_t top;
 uint32_t size;
 int free_list_head;
} zend_objects_store;



__attribute__ ((visibility("default"))) void zend_objects_store_init(zend_objects_store *objects, uint32_t init_size);
__attribute__ ((visibility("default"))) void zend_objects_store_call_destructors(zend_objects_store *objects);
__attribute__ ((visibility("default"))) void zend_objects_store_mark_destructed(zend_objects_store *objects);
__attribute__ ((visibility("default"))) void zend_objects_store_free_object_storage(zend_objects_store *objects, zend_bool fast_shutdown);
__attribute__ ((visibility("default"))) void zend_objects_store_destroy(zend_objects_store *objects);


__attribute__ ((visibility("default"))) void zend_objects_store_put(zend_object *object);
__attribute__ ((visibility("default"))) void zend_objects_store_del(zend_object *object);


static inline __attribute__((always_inline)) void zend_object_store_ctor_failed(zend_object *obj)
{
 do { (obj)->gc.u.type_info |= ((1<<8)) << 0; } while (0);
}



static inline __attribute__((always_inline)) void zend_object_release(zend_object *obj)
{
 if (zend_gc_delref(&(obj)->gc) == 0) {
  zend_objects_store_del(obj);
 } else if (__builtin_expect(!!(((((zend_refcounted*)obj)->gc.u.type_info & (0xfffffc00 | ((1<<4) << 0))) == 0)), 0)) {
  gc_possible_root((zend_refcounted*)obj);
 }
}

static inline __attribute__((always_inline)) size_t zend_object_properties_size(zend_class_entry *ce)
{
 return sizeof(zval) *
  (ce->default_properties_count -
   ((ce->ce_flags & (1 << 11)) ? 0 : 1));
}



static inline __attribute__((always_inline)) void *zend_object_alloc(size_t obj_size, zend_class_entry *ce) {
 void *obj = (__builtin_constant_p((obj_size + zend_object_properties_size(ce))) ? (((obj_size + zend_object_properties_size(ce)) <= 8) ? _emalloc_8() : (((obj_size + zend_object_properties_size(ce)) <= 16) ? _emalloc_16() : (((obj_size + zend_object_properties_size(ce)) <= 24) ? _emalloc_24() : (((obj_size + zend_object_properties_size(ce)) <= 32) ? _emalloc_32() : (((obj_size + zend_object_properties_size(ce)) <= 40) ? _emalloc_40() : (((obj_size + zend_object_properties_size(ce)) <= 48) ? _emalloc_48() : (((obj_size + zend_object_properties_size(ce)) <= 56) ? _emalloc_56() : (((obj_size + zend_object_properties_size(ce)) <= 64) ? _emalloc_64() : (((obj_size + zend_object_properties_size(ce)) <= 80) ? _emalloc_80() : (((obj_size + zend_object_properties_size(ce)) <= 96) ? _emalloc_96() : (((obj_size + zend_object_properties_size(ce)) <= 112) ? _emalloc_112() : (((obj_size + zend_object_properties_size(ce)) <= 128) ? _emalloc_128() : (((obj_size + zend_object_properties_size(ce)) <= 160) ? _emalloc_160() : (((obj_size + zend_object_properties_size(ce)) <= 192) ? _emalloc_192() : (((obj_size + zend_object_properties_size(ce)) <= 224) ? _emalloc_224() : (((obj_size + zend_object_properties_size(ce)) <= 256) ? _emalloc_256() : (((obj_size + zend_object_properties_size(ce)) <= 320) ? _emalloc_320() : (((obj_size + zend_object_properties_size(ce)) <= 384) ? _emalloc_384() : (((obj_size + zend_object_properties_size(ce)) <= 448) ? _emalloc_448() : (((obj_size + zend_object_properties_size(ce)) <= 512) ? _emalloc_512() : (((obj_size + zend_object_properties_size(ce)) <= 640) ? _emalloc_640() : (((obj_size + zend_object_properties_size(ce)) <= 768) ? _emalloc_768() : (((obj_size + zend_object_properties_size(ce)) <= 896) ? _emalloc_896() : (((obj_size + zend_object_properties_size(ce)) <= 1024) ? _emalloc_1024() : (((obj_size + zend_object_properties_size(ce)) <= 1280) ? _emalloc_1280() : (((obj_size + zend_object_properties_size(ce)) <= 1536) ? _emalloc_1536() : (((obj_size + zend_object_properties_size(ce)) <= 1792) ? _emalloc_1792() : (((obj_size + zend_object_properties_size(ce)) <= 2048) ? _emalloc_2048() : (((obj_size + zend_object_properties_size(ce)) <= 2560) ? _emalloc_2560() : (((obj_size + zend_object_properties_size(ce)) <= 3072) ? _emalloc_3072() : (((obj_size + zend_object_properties_size(ce)) <= (((size_t) (2 * 1024 * 1024)) - ((4 * 1024) * (1)))) ? _emalloc_large((obj_size + zend_object_properties_size(ce))) : _emalloc_huge((obj_size + zend_object_properties_size(ce)))) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) : _emalloc((obj_size + zend_object_properties_size(ce))) );


 memset(obj, 0, obj_size - sizeof(zval));
 return obj;
}

static inline zend_property_info *zend_get_property_info_for_slot(zend_object *obj, zval *slot)
{
 zend_property_info **table = obj->ce->properties_info_table;
 intptr_t prop_num = slot - obj->properties_table;
 do { if (__builtin_expect(!(prop_num >= 0 && prop_num < obj->ce->default_properties_count), 0)) __builtin_unreachable(); } while (0);
 return table[prop_num];
}


static inline zend_property_info *zend_get_typed_property_info_for_slot(zend_object *obj, zval *slot)
{
 zend_property_info *prop_info = zend_get_property_info_for_slot(obj, slot);
 if (prop_info && (((prop_info->type).type_mask & ((1u << 24) - 1)) != 0)) {
  return prop_info;
 }
 return ((void*)0);
}
# 34 "Zend/zend_globals.h" 2
# 1 "Zend/zend_modules.h" 1
# 24 "Zend/zend_modules.h"
# 1 "Zend/zend_compile.h" 1
# 25 "Zend/zend_modules.h" 2
# 1 "Zend/zend_build.h" 1
# 26 "Zend/zend_modules.h" 2
# 67 "Zend/zend_modules.h"
struct _zend_ini_entry;
typedef struct _zend_module_entry zend_module_entry;
typedef struct _zend_module_dep zend_module_dep;

struct _zend_module_entry {
 unsigned short size;
 unsigned int zend_api;
 unsigned char zend_debug;
 unsigned char zts;
 const struct _zend_ini_entry *ini_entry;
 const struct _zend_module_dep *deps;
 const char *name;
 const struct _zend_function_entry *functions;
 zend_result (*module_startup_func)(int type, int module_number);
 zend_result (*module_shutdown_func)(int type, int module_number);
 zend_result (*request_startup_func)(int type, int module_number);
 zend_result (*request_shutdown_func)(int type, int module_number);
 void (*info_func)(zend_module_entry *zend_module);
 const char *version;
 size_t globals_size;



 void* globals_ptr;

 void (*globals_ctor)(void *global);
 void (*globals_dtor)(void *global);
 zend_result (*post_deactivate_func)(void);
 int module_started;
 unsigned char type;
 void *handle;
 int module_number;
 const char *build_id;
};
# 116 "Zend/zend_modules.h"
struct _zend_module_dep {
 const char *name;
 const char *rel;
 const char *version;
 unsigned char type;
};


extern __attribute__ ((visibility("default"))) HashTable module_registry;

void module_destructor(zend_module_entry *module);
int module_registry_request_startup(zend_module_entry *module);
int module_registry_unload_temp(const zend_module_entry *module);
# 35 "Zend/zend_globals.h" 2
# 1 "Zend/zend_float.h" 1
# 27 "Zend/zend_float.h"
extern __attribute__ ((visibility("default"))) void zend_init_fpu(void);
extern __attribute__ ((visibility("default"))) void zend_shutdown_fpu(void);
extern __attribute__ ((visibility("default"))) void zend_ensure_fpu_mode(void);
# 36 "Zend/zend_globals.h" 2
# 1 "Zend/zend_multibyte.h" 1
# 23 "Zend/zend_multibyte.h"
typedef struct _zend_encoding zend_encoding;

typedef size_t (*zend_encoding_filter)(unsigned char **str, size_t *str_length, const unsigned char *buf, size_t length);

typedef const zend_encoding* (*zend_encoding_fetcher)(const char *encoding_name);
typedef const char* (*zend_encoding_name_getter)(const zend_encoding *encoding);
typedef _Bool (*zend_encoding_lexer_compatibility_checker)(const zend_encoding *encoding);
typedef const zend_encoding *(*zend_encoding_detector)(const unsigned char *string, size_t length, const zend_encoding **list, size_t list_size);
typedef size_t (*zend_encoding_converter)(unsigned char **to, size_t *to_length, const unsigned char *from, size_t from_length, const zend_encoding *encoding_to, const zend_encoding *encoding_from);
typedef zend_result (*zend_encoding_list_parser)(const char *encoding_list, size_t encoding_list_len, const zend_encoding ***return_list, size_t *return_size, _Bool persistent);
typedef const zend_encoding *(*zend_encoding_internal_encoding_getter)(void);
typedef zend_result (*zend_encoding_internal_encoding_setter)(const zend_encoding *encoding);

typedef struct _zend_multibyte_functions {
    const char *provider_name;
    zend_encoding_fetcher encoding_fetcher;
    zend_encoding_name_getter encoding_name_getter;
    zend_encoding_lexer_compatibility_checker lexer_compatibility_checker;
    zend_encoding_detector encoding_detector;
    zend_encoding_converter encoding_converter;
    zend_encoding_list_parser encoding_list_parser;
    zend_encoding_internal_encoding_getter internal_encoding_getter;
    zend_encoding_internal_encoding_setter internal_encoding_setter;
} zend_multibyte_functions;






__attribute__ ((visibility("default"))) extern const zend_encoding *zend_multibyte_encoding_utf32be;
__attribute__ ((visibility("default"))) extern const zend_encoding *zend_multibyte_encoding_utf32le;
__attribute__ ((visibility("default"))) extern const zend_encoding *zend_multibyte_encoding_utf16be;
__attribute__ ((visibility("default"))) extern const zend_encoding *zend_multibyte_encoding_utf16le;
__attribute__ ((visibility("default"))) extern const zend_encoding *zend_multibyte_encoding_utf8;


__attribute__ ((visibility("default"))) zend_result zend_multibyte_set_functions(const zend_multibyte_functions *functions);
__attribute__ ((visibility("default"))) void zend_multibyte_restore_functions(void);
__attribute__ ((visibility("default"))) const zend_multibyte_functions *zend_multibyte_get_functions(void);

__attribute__ ((visibility("default"))) const zend_encoding *zend_multibyte_fetch_encoding(const char *name);
__attribute__ ((visibility("default"))) const char *zend_multibyte_get_encoding_name(const zend_encoding *encoding);
__attribute__ ((visibility("default"))) int zend_multibyte_check_lexer_compatibility(const zend_encoding *encoding);
__attribute__ ((visibility("default"))) const zend_encoding *zend_multibyte_encoding_detector(const unsigned char *string, size_t length, const zend_encoding **list, size_t list_size);
__attribute__ ((visibility("default"))) size_t zend_multibyte_encoding_converter(unsigned char **to, size_t *to_length, const unsigned char *from, size_t from_length, const zend_encoding *encoding_to, const zend_encoding *encoding_from);
__attribute__ ((visibility("default"))) int zend_multibyte_parse_encoding_list(const char *encoding_list, size_t encoding_list_len, const zend_encoding ***return_list, size_t *return_size, _Bool persistent);

__attribute__ ((visibility("default"))) const zend_encoding *zend_multibyte_get_internal_encoding(void);
__attribute__ ((visibility("default"))) const zend_encoding *zend_multibyte_get_script_encoding(void);
__attribute__ ((visibility("default"))) int zend_multibyte_set_script_encoding(const zend_encoding **encoding_list, size_t encoding_list_size);
__attribute__ ((visibility("default"))) int zend_multibyte_set_internal_encoding(const zend_encoding *encoding);
__attribute__ ((visibility("default"))) zend_result zend_multibyte_set_script_encoding_by_string(const char *new_value, size_t new_value_length);
# 37 "Zend/zend_globals.h" 2
# 1 "Zend/zend_multiply.h" 1
# 38 "Zend/zend_globals.h" 2
# 1 "Zend/zend_arena.h" 1
# 26 "Zend/zend_arena.h"
typedef struct _zend_arena zend_arena;

struct _zend_arena {
 char *ptr;
 char *end;
 zend_arena *prev;
};

static inline __attribute__((always_inline)) zend_arena* zend_arena_create(size_t size)
{
 zend_arena *arena = (zend_arena*)(__builtin_constant_p((size)) ? (((size) <= 8) ? _emalloc_8() : (((size) <= 16) ? _emalloc_16() : (((size) <= 24) ? _emalloc_24() : (((size) <= 32) ? _emalloc_32() : (((size) <= 40) ? _emalloc_40() : (((size) <= 48) ? _emalloc_48() : (((size) <= 56) ? _emalloc_56() : (((size) <= 64) ? _emalloc_64() : (((size) <= 80) ? _emalloc_80() : (((size) <= 96) ? _emalloc_96() : (((size) <= 112) ? _emalloc_112() : (((size) <= 128) ? _emalloc_128() : (((size) <= 160) ? _emalloc_160() : (((size) <= 192) ? _emalloc_192() : (((size) <= 224) ? _emalloc_224() : (((size) <= 256) ? _emalloc_256() : (((size) <= 320) ? _emalloc_320() : (((size) <= 384) ? _emalloc_384() : (((size) <= 448) ? _emalloc_448() : (((size) <= 512) ? _emalloc_512() : (((size) <= 640) ? _emalloc_640() : (((size) <= 768) ? _emalloc_768() : (((size) <= 896) ? _emalloc_896() : (((size) <= 1024) ? _emalloc_1024() : (((size) <= 1280) ? _emalloc_1280() : (((size) <= 1536) ? _emalloc_1536() : (((size) <= 1792) ? _emalloc_1792() : (((size) <= 2048) ? _emalloc_2048() : (((size) <= 2560) ? _emalloc_2560() : (((size) <= 3072) ? _emalloc_3072() : (((size) <= (((size_t) (2 * 1024 * 1024)) - ((4 * 1024) * (1)))) ? _emalloc_large((size)) : _emalloc_huge((size))) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) : _emalloc((size)) );

 arena->ptr = (char*) arena + (((sizeof(zend_arena)) + 8 - 1) & ~(8 - 1));
 arena->end = (char*) arena + size;
 arena->prev = ((void*)0);
 return arena;
}

static inline __attribute__((always_inline)) void zend_arena_destroy(zend_arena *arena)
{
 do {
  zend_arena *prev = arena->prev;
  _efree((arena) );
  arena = prev;
 } while (arena);
}

static inline __attribute__((always_inline)) void* zend_arena_alloc(zend_arena **arena_ptr, size_t size)
{
 zend_arena *arena = *arena_ptr;
 char *ptr = arena->ptr;

 size = (((size) + 8 - 1) & ~(8 - 1));

 if (__builtin_expect(!!(size <= (size_t)(arena->end - ptr)), 1)) {
  arena->ptr = ptr + size;
 } else {
  size_t arena_size =
   __builtin_expect(!!((size + (((sizeof(zend_arena)) + 8 - 1) & ~(8 - 1))) > (size_t)(arena->end - (char*) arena)), 0) ?
    (size + (((sizeof(zend_arena)) + 8 - 1) & ~(8 - 1))) :
    (size_t)(arena->end - (char*) arena);
  zend_arena *new_arena = (zend_arena*)(__builtin_constant_p((arena_size)) ? (((arena_size) <= 8) ? _emalloc_8() : (((arena_size) <= 16) ? _emalloc_16() : (((arena_size) <= 24) ? _emalloc_24() : (((arena_size) <= 32) ? _emalloc_32() : (((arena_size) <= 40) ? _emalloc_40() : (((arena_size) <= 48) ? _emalloc_48() : (((arena_size) <= 56) ? _emalloc_56() : (((arena_size) <= 64) ? _emalloc_64() : (((arena_size) <= 80) ? _emalloc_80() : (((arena_size) <= 96) ? _emalloc_96() : (((arena_size) <= 112) ? _emalloc_112() : (((arena_size) <= 128) ? _emalloc_128() : (((arena_size) <= 160) ? _emalloc_160() : (((arena_size) <= 192) ? _emalloc_192() : (((arena_size) <= 224) ? _emalloc_224() : (((arena_size) <= 256) ? _emalloc_256() : (((arena_size) <= 320) ? _emalloc_320() : (((arena_size) <= 384) ? _emalloc_384() : (((arena_size) <= 448) ? _emalloc_448() : (((arena_size) <= 512) ? _emalloc_512() : (((arena_size) <= 640) ? _emalloc_640() : (((arena_size) <= 768) ? _emalloc_768() : (((arena_size) <= 896) ? _emalloc_896() : (((arena_size) <= 1024) ? _emalloc_1024() : (((arena_size) <= 1280) ? _emalloc_1280() : (((arena_size) <= 1536) ? _emalloc_1536() : (((arena_size) <= 1792) ? _emalloc_1792() : (((arena_size) <= 2048) ? _emalloc_2048() : (((arena_size) <= 2560) ? _emalloc_2560() : (((arena_size) <= 3072) ? _emalloc_3072() : (((arena_size) <= (((size_t) (2 * 1024 * 1024)) - ((4 * 1024) * (1)))) ? _emalloc_large((arena_size)) : _emalloc_huge((arena_size))) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) : _emalloc((arena_size)) );

  ptr = (char*) new_arena + (((sizeof(zend_arena)) + 8 - 1) & ~(8 - 1));
  new_arena->ptr = (char*) new_arena + (((sizeof(zend_arena)) + 8 - 1) & ~(8 - 1)) + size;
  new_arena->end = (char*) new_arena + arena_size;
  new_arena->prev = arena;
  *arena_ptr = new_arena;
 }

 return (void*) ptr;
}

static inline __attribute__((always_inline)) void* zend_arena_calloc(zend_arena **arena_ptr, size_t count, size_t unit_size)
{
 _Bool overflow;
 size_t size;
 void *ret;

 size = zend_safe_address(unit_size, count, 0, &overflow);
 if (__builtin_expect(!!(overflow), 0)) {
  zend_error((1<<0L), "Possible integer overflow in zend_arena_calloc() (%zu * %zu)", unit_size, count);
 }
 ret = zend_arena_alloc(arena_ptr, size);
 memset(ret, 0, size);
 return ret;
}

static inline __attribute__((always_inline)) void* zend_arena_checkpoint(zend_arena *arena)
{
 return arena->ptr;
}

static inline __attribute__((always_inline)) void zend_arena_release(zend_arena **arena_ptr, void *checkpoint)
{
 zend_arena *arena = *arena_ptr;

 while (__builtin_expect(!!((char*)checkpoint > arena->end), 0) ||
        __builtin_expect(!!((char*)checkpoint <= (char*)arena), 0)) {
  zend_arena *prev = arena->prev;
  _efree((arena) );
  *arena_ptr = arena = prev;
 }
 do { if (__builtin_expect(!((char*)checkpoint > (char*)arena && (char*)checkpoint <= arena->end), 0)) __builtin_unreachable(); } while (0);
 arena->ptr = (char*)checkpoint;
}

static inline __attribute__((always_inline)) zend_bool zend_arena_contains(zend_arena *arena, void *ptr)
{
 while (arena) {
  if ((char*)ptr > (char*)arena && (char*)ptr <= arena->ptr) {
   return 1;
  }
  arena = arena->prev;
 }
 return 0;
}
# 39 "Zend/zend_globals.h" 2
# 57 "Zend/zend_globals.h"
# 1 "Zend/zend_compile.h" 1
# 58 "Zend/zend_globals.h" 2




typedef struct _zend_vm_stack *zend_vm_stack;
typedef struct _zend_ini_entry zend_ini_entry;


struct _zend_compiler_globals {
 zend_stack loop_var_stack;

 zend_class_entry *active_class_entry;

 zend_string *compiled_filename;

 int zend_lineno;

 zend_op_array *active_op_array;

 HashTable *function_table;
 HashTable *class_table;

 HashTable *auto_globals;


 zend_uchar parse_error;
 zend_bool in_compilation;
 zend_bool short_tags;

 zend_bool unclean_shutdown;

 zend_bool ini_parser_unbuffered_errors;

 zend_llist open_files;

 struct _zend_ini_parser_param *ini_parser_param;

 zend_bool skip_shebang;
 zend_bool increment_lineno;

 zend_string *doc_comment;
 uint32_t extra_fn_flags;

 uint32_t compiler_options;

 zend_oparray_context context;
 zend_file_context file_context;

 zend_arena *arena;

 HashTable interned_strings;

 const zend_encoding **script_encoding_list;
 size_t script_encoding_list_size;
 zend_bool multibyte;
 zend_bool detect_unicode;
 zend_bool encoding_declared;

 zend_ast *ast;
 zend_arena *ast_arena;

 zend_stack delayed_oplines_stack;
 HashTable *memoized_exprs;
 int memoize_mode;

 void *map_ptr_base;
 size_t map_ptr_size;
 size_t map_ptr_last;

 HashTable *delayed_variance_obligations;
 HashTable *delayed_autoloads;

 uint32_t rtd_key_counter;

 zend_stack short_circuiting_opnums;
};


struct _zend_executor_globals {
 zval uninitialized_zval;
 zval error_zval;


 zend_array *symtable_cache[32];

 zend_array **symtable_cache_limit;

 zend_array **symtable_cache_ptr;

 zend_array symbol_table;

 HashTable included_files;

 jmp_buf *bailout;

 int error_reporting;
 int exit_status;

 HashTable *function_table;
 HashTable *class_table;
 HashTable *zend_constants;

 zval *vm_stack_top;
 zval *vm_stack_end;
 zend_vm_stack vm_stack;
 size_t vm_stack_page_size;

 struct _zend_execute_data *current_execute_data;
 zend_class_entry *fake_scope;

 uint32_t jit_trace_num;

 zend_long precision;

 int ticks_count;

 uint32_t persistent_constants_count;
 uint32_t persistent_functions_count;
 uint32_t persistent_classes_count;

 HashTable *in_autoload;
 zend_bool full_tables_cleanup;


 zend_bool no_extensions;

 zend_bool vm_interrupt;
 zend_bool timed_out;
 zend_long hard_timeout;





 HashTable regular_list;
 HashTable persistent_list;

 int user_error_handler_error_reporting;
 zval user_error_handler;
 zval user_exception_handler;
 zend_stack user_error_handlers_error_reporting;
 zend_stack user_error_handlers;
 zend_stack user_exception_handlers;

 zend_error_handling_t error_handling;
 zend_class_entry *exception_class;


 zend_long timeout_seconds;

 int lambda_count;

 HashTable *ini_directives;
 HashTable *modified_ini_directives;
 zend_ini_entry *error_reporting_ini_entry;

 zend_objects_store objects_store;
 zend_object *exception, *prev_exception;
 const zend_op *opline_before_exception;
 zend_op exception_op[3];

 struct _zend_module_entry *current_module;

 zend_bool active;
 zend_uchar flags;

 zend_long assertions;

 uint32_t ht_iterators_count;
 uint32_t ht_iterators_used;
 HashTableIterator *ht_iterators;
 HashTableIterator ht_iterators_slots[16];

 void *saved_fpu_cw_ptr;




 zend_function trampoline;
 zend_op call_trampoline_op;

 HashTable weakrefs;

 zend_bool exception_ignore_args;
 zend_long exception_string_param_max_len;

 zend_get_gc_buffer get_gc_buffer;

 void *reserved[6];
};






struct _zend_ini_scanner_globals {
 zend_file_handle *yy_in;
 zend_file_handle *yy_out;

 unsigned int yy_leng;
 unsigned char *yy_start;
 unsigned char *yy_text;
 unsigned char *yy_cursor;
 unsigned char *yy_marker;
 unsigned char *yy_limit;
 int yy_state;
 zend_stack state_stack;

 char *filename;
 int lineno;


 int scanner_mode;
};

typedef enum {
 ON_TOKEN,
 ON_FEEDBACK,
 ON_STOP
} zend_php_scanner_event;

struct _zend_php_scanner_globals {
 zend_file_handle *yy_in;
 zend_file_handle *yy_out;

 unsigned int yy_leng;
 unsigned char *yy_start;
 unsigned char *yy_text;
 unsigned char *yy_cursor;
 unsigned char *yy_marker;
 unsigned char *yy_limit;
 int yy_state;
 zend_stack state_stack;
 zend_ptr_stack heredoc_label_stack;
 zend_stack nest_location_stack;
 zend_bool heredoc_scan_ahead;
 int heredoc_indentation;
 zend_bool heredoc_indentation_uses_spaces;


 unsigned char *script_org;
 size_t script_org_size;


 unsigned char *script_filtered;
 size_t script_filtered_size;


 zend_encoding_filter input_filter;
 zend_encoding_filter output_filter;
 const zend_encoding *script_encoding;


 int scanned_string_len;


 void (*on_event)(
  zend_php_scanner_event event, int token, int line,
  const char *text, size_t length, void *context);
 void *on_event_context;
};
# 725 "Zend/zend_compile.h" 2



void init_compiler(void);
void shutdown_compiler(void);
void zend_init_compiler_data_structures(void);

void zend_oparray_context_begin(zend_oparray_context *prev_context);
void zend_oparray_context_end(zend_oparray_context *prev_context);
void zend_file_context_begin(zend_file_context *prev_context);
void zend_file_context_end(zend_file_context *prev_context);

extern __attribute__ ((visibility("default"))) zend_op_array *(*zend_compile_file)(zend_file_handle *file_handle, int type);
extern __attribute__ ((visibility("default"))) zend_op_array *(*zend_compile_string)(zend_string *source_string, const char *filename);

__attribute__ ((visibility("default"))) int lex_scan(zval *zendlval, zend_parser_stack_elem *elem);
void startup_scanner(void);
void shutdown_scanner(void);

__attribute__ ((visibility("default"))) zend_string *zend_set_compiled_filename(zend_string *new_compiled_filename);
__attribute__ ((visibility("default"))) void zend_restore_compiled_filename(zend_string *original_compiled_filename);
__attribute__ ((visibility("default"))) zend_string *zend_get_compiled_filename(void);
__attribute__ ((visibility("default"))) int zend_get_compiled_lineno(void);
__attribute__ ((visibility("default"))) size_t zend_get_scanned_file_offset(void);

__attribute__ ((visibility("default"))) zend_string *zend_get_compiled_variable_name(const zend_op_array *op_array, uint32_t var);






typedef zend_result ( *unary_op_type)(zval *, zval *);
typedef zend_result ( *binary_op_type)(zval *, zval *, zval *);

__attribute__ ((visibility("default"))) unary_op_type get_unary_op(int opcode);
__attribute__ ((visibility("default"))) binary_op_type get_binary_op(int opcode);

void zend_stop_lexing(void);
void zend_emit_final_return(_Bool return_one);


zend_ast *zend_ast_append_str(zend_ast *left, zend_ast *right);
zend_ast *zend_negate_num_string(zend_ast *ast);
uint32_t zend_add_class_modifier(uint32_t flags, uint32_t new_flag);
uint32_t zend_add_member_modifier(uint32_t flags, uint32_t new_flag);
zend_bool zend_handle_encoding_declaration(zend_ast *ast);


void zend_do_free(znode *op1);

__attribute__ ((visibility("default"))) zend_result do_bind_function(zval *lcname);
__attribute__ ((visibility("default"))) zend_result do_bind_class(zval *lcname, zend_string *lc_parent_name);
__attribute__ ((visibility("default"))) uint32_t zend_build_delayed_early_binding_list(const zend_op_array *op_array);
__attribute__ ((visibility("default"))) void zend_do_delayed_early_binding(zend_op_array *op_array, uint32_t first_early_binding_opline);

void zend_do_extended_info(void);
void zend_do_extended_fcall_begin(void);
void zend_do_extended_fcall_end(void);

void zend_verify_namespace(void);

void zend_resolve_goto_label(zend_op_array *op_array, zend_op *opline);

__attribute__ ((visibility("default"))) void function_add_ref(zend_function *function);





struct _zend_arena;

__attribute__ ((visibility("default"))) zend_op_array *compile_file(zend_file_handle *file_handle, int type);
__attribute__ ((visibility("default"))) zend_op_array *compile_string(zend_string *source_string, const char *filename);
__attribute__ ((visibility("default"))) zend_op_array *compile_filename(int type, zval *filename);
__attribute__ ((visibility("default"))) zend_ast *zend_compile_string_to_ast(
  zend_string *code, struct _zend_arena **ast_arena, const char *filename);
__attribute__ ((visibility("default"))) int zend_execute_scripts(int type, zval *retval, int file_count, ...);
__attribute__ ((visibility("default"))) int open_file_for_scanning(zend_file_handle *file_handle);
__attribute__ ((visibility("default"))) void init_op_array(zend_op_array *op_array, zend_uchar type, int initial_ops_size);
__attribute__ ((visibility("default"))) void destroy_op_array(zend_op_array *op_array);
__attribute__ ((visibility("default"))) void zend_destroy_file_handle(zend_file_handle *file_handle);
__attribute__ ((visibility("default"))) void zend_cleanup_internal_class_data(zend_class_entry *ce);
__attribute__ ((visibility("default"))) void zend_cleanup_internal_classes(void);
__attribute__ ((visibility("default"))) void zend_type_release(zend_type type, zend_bool persistent);
__attribute__ ((visibility("default"))) zend_string *zend_create_member_string(zend_string *class_name, zend_string *member_name);


__attribute__ ((visibility("default"))) void zend_user_exception_handler(void);
# 823 "Zend/zend_compile.h"
void zend_free_internal_arg_info(zend_internal_function *function);
__attribute__ ((visibility("default"))) void destroy_zend_function(zend_function *function);
__attribute__ ((visibility("default"))) void zend_function_dtor(zval *zv);
__attribute__ ((visibility("default"))) void destroy_zend_class(zval *zv);
void zend_class_add_ref(zval *zv);

__attribute__ ((visibility("default"))) zend_string *zend_mangle_property_name(const char *src1, size_t src1_length, const char *src2, size_t src2_length, _Bool internal);


__attribute__ ((visibility("default"))) zend_result zend_unmangle_property_name_ex(const zend_string *name, const char **class_name, const char **prop_name, size_t *prop_len);

static inline __attribute__((always_inline)) const char *zend_get_unmangled_property_name(const zend_string *mangled_prop) {
 const char *class_name, *prop_name;
 zend_unmangle_property_name_ex(mangled_prop, &class_name, &prop_name, ((void*)0));
 return prop_name;
}




typedef zend_bool (*zend_needs_live_range_cb)(zend_op_array *op_array, zend_op *opline);
__attribute__ ((visibility("default"))) void zend_recalc_live_ranges(
 zend_op_array *op_array, zend_needs_live_range_cb needs_live_range);

__attribute__ ((visibility("default"))) void pass_two(zend_op_array *op_array);
__attribute__ ((visibility("default"))) zend_bool zend_is_compiling(void);
__attribute__ ((visibility("default"))) char *zend_make_compiled_string_description(const char *name);
__attribute__ ((visibility("default"))) void zend_initialize_class_data(zend_class_entry *ce, zend_bool nullify_handlers);
uint32_t zend_get_class_fetch_type(zend_string *name);
__attribute__ ((visibility("default"))) zend_uchar zend_get_call_op(const zend_op *init_op, zend_function *fbc);
__attribute__ ((visibility("default"))) _Bool zend_is_smart_branch(const zend_op *opline);

typedef zend_bool (*zend_auto_global_callback)(zend_string *name);
typedef struct _zend_auto_global {
 zend_string *name;
 zend_auto_global_callback auto_global_callback;
 zend_bool jit;
 zend_bool armed;
} zend_auto_global;

__attribute__ ((visibility("default"))) zend_result zend_register_auto_global(zend_string *name, zend_bool jit, zend_auto_global_callback auto_global_callback);
__attribute__ ((visibility("default"))) void zend_activate_auto_globals(void);
__attribute__ ((visibility("default"))) zend_bool zend_is_auto_global(zend_string *name);
__attribute__ ((visibility("default"))) zend_bool zend_is_auto_global_str(const char *name, size_t len);
__attribute__ ((visibility("default"))) size_t zend_dirname(char *path, size_t len);
__attribute__ ((visibility("default"))) void zend_set_function_arg_flags(zend_function *func);

int zendlex(zend_parser_stack_elem *elem);

void zend_assert_valid_class_name(const zend_string *const_name);

zend_string *zend_type_to_string_resolved(zend_type type, zend_class_entry *scope);
__attribute__ ((visibility("default"))) zend_string *zend_type_to_string(zend_type type);




# 1 "Zend/zend_vm_opcodes.h" 1
# 80 "Zend/zend_vm_opcodes.h"
__attribute__ ((visibility("default"))) const char* zend_get_opcode_name(zend_uchar opcode);
__attribute__ ((visibility("default"))) uint32_t zend_get_opcode_flags(zend_uchar opcode);
# 880 "Zend/zend_compile.h" 2
# 980 "Zend/zend_compile.h"
static inline __attribute__((always_inline)) _Bool zend_check_arg_send_type(const zend_function *zf, uint32_t arg_num, uint32_t mask)
{
 arg_num--;
 if (__builtin_expect(!!(arg_num >= zf->common.num_args), 0)) {
  if (__builtin_expect(!!((zf->common.fn_flags & (1 << 14)) == 0), 1)) {
   return 0;
  }
  arg_num = zf->common.num_args;
 }
 return __builtin_expect(!!(((((((&zf->common.arg_info[arg_num])->type).type_mask) >> 24) & 3) & mask) != 0), 0);
}
# 1137 "Zend/zend_compile.h"
__attribute__ ((visibility("default"))) zend_bool zend_binary_op_produces_error(uint32_t opcode, zval *op1, zval *op2);
# 10 "/root/pib_eval.c" 2
# 1 "Zend/zend_execute.h" 1
# 30 "Zend/zend_execute.h"
struct _zend_fcall_info;
__attribute__ ((visibility("default"))) extern void (*zend_execute_ex)(zend_execute_data *execute_data);
__attribute__ ((visibility("default"))) extern void (*zend_execute_internal)(zend_execute_data *execute_data, zval *return_value);


__attribute__ ((visibility("default"))) extern zend_class_entry *(*zend_autoload)(zend_string *name, zend_string *lc_name);

void init_executor(void);
void shutdown_executor(void);
void shutdown_destructors(void);
__attribute__ ((visibility("default"))) void zend_init_execute_data(zend_execute_data *execute_data, zend_op_array *op_array, zval *return_value);
__attribute__ ((visibility("default"))) void zend_init_func_execute_data(zend_execute_data *execute_data, zend_op_array *op_array, zval *return_value);
__attribute__ ((visibility("default"))) void zend_init_code_execute_data(zend_execute_data *execute_data, zend_op_array *op_array, zval *return_value);
__attribute__ ((visibility("default"))) void zend_execute(zend_op_array *op_array, zval *return_value);
__attribute__ ((visibility("default"))) void execute_ex(zend_execute_data *execute_data);
__attribute__ ((visibility("default"))) void execute_internal(zend_execute_data *execute_data, zval *return_value);
__attribute__ ((visibility("default"))) zend_bool zend_is_valid_class_name(zend_string *name);
__attribute__ ((visibility("default"))) zend_class_entry *zend_lookup_class(zend_string *name);
__attribute__ ((visibility("default"))) zend_class_entry *zend_lookup_class_ex(zend_string *name, zend_string *lcname, uint32_t flags);
__attribute__ ((visibility("default"))) zend_class_entry *zend_get_called_scope(zend_execute_data *ex);
__attribute__ ((visibility("default"))) zend_object *zend_get_this_object(zend_execute_data *ex);
__attribute__ ((visibility("default"))) zend_result zend_eval_string(const char *str, zval *retval_ptr, const char *string_name);
__attribute__ ((visibility("default"))) zend_result zend_eval_stringl(const char *str, size_t str_len, zval *retval_ptr, const char *string_name);
__attribute__ ((visibility("default"))) zend_result zend_eval_string_ex(const char *str, zval *retval_ptr, const char *string_name, _Bool handle_exceptions);
__attribute__ ((visibility("default"))) zend_result zend_eval_stringl_ex(const char *str, size_t str_len, zval *retval_ptr, const char *string_name, _Bool handle_exceptions);


extern __attribute__ ((visibility("default"))) const zend_internal_function zend_pass_function;

__attribute__ ((visibility("default"))) void zend_missing_arg_error(zend_execute_data *execute_data);
__attribute__ ((visibility("default"))) void zend_deprecated_function(const zend_function *fbc);
          void zend_param_must_be_ref(const zend_function *func, uint32_t arg_num);

__attribute__ ((visibility("default"))) zend_bool zend_verify_ref_assignable_zval(zend_reference *ref, zval *zv, zend_bool strict);
__attribute__ ((visibility("default"))) zend_bool zend_verify_prop_assignable_by_ref(zend_property_info *prop_info, zval *orig_val, zend_bool strict);

__attribute__ ((visibility("default"))) void zend_throw_ref_type_error_zval(zend_property_info *prop, zval *zv);
__attribute__ ((visibility("default"))) void zend_throw_ref_type_error_type(zend_property_info *prop1, zend_property_info *prop2, zval *zv);
__attribute__ ((visibility("default"))) zend_result zend_undefined_offset_write(HashTable *ht, zend_long lval);
__attribute__ ((visibility("default"))) zend_result zend_undefined_index_write(HashTable *ht, zend_string *offset);

__attribute__ ((visibility("default"))) zend_bool zend_verify_scalar_type_hint(uint32_t type_mask, zval *arg, zend_bool strict, zend_bool is_internal_arg);
__attribute__ ((visibility("default"))) void zend_verify_arg_error(
  const zend_function *zf, const zend_arg_info *arg_info, int arg_num, zval *value);
__attribute__ ((visibility("default"))) void zend_verify_return_error(
  const zend_function *zf, zval *value);
__attribute__ ((visibility("default"))) zend_bool zend_verify_ref_array_assignable(zend_reference *ref);
__attribute__ ((visibility("default"))) zend_bool zend_value_instanceof_static(zval *zv);
# 92 "Zend/zend_execute.h"
__attribute__ ((visibility("default"))) void zend_ref_add_type_source(zend_property_info_source_list *source_list, zend_property_info *prop);
__attribute__ ((visibility("default"))) void zend_ref_del_type_source(zend_property_info_source_list *source_list, zend_property_info *prop);

__attribute__ ((visibility("default"))) zval* zend_assign_to_typed_ref(zval *variable_ptr, zval *value, zend_uchar value_type, zend_bool strict);

static inline __attribute__((always_inline)) void zend_copy_to_variable(zval *variable_ptr, zval *value, zend_uchar value_type)
{
 zend_refcounted *ref = ((void*)0);

 if ((__builtin_constant_p(value_type & ((1<<2)|(1<<3))) ? (value_type & ((1<<2)|(1<<3))) : (1)) && (zval_get_type(&(*(value))) == 10)) {
  ref = (*(value)).value.counted;
  value = &(*(value)).value.ref->val;
 }

 do { zval *_z1 = (variable_ptr); const zval *_z2 = (value); zend_refcounted *_gc = (*(_z2)).value.counted; uint32_t _t = (*(_z2)).u1.type_info; do { uint32_t _w2 = _z2->value.ww.w2; (*(_z1)).value.counted = _gc; _z1->value.ww.w2 = _w2; (*(_z1)).u1.type_info = _t; } while (0); } while (0);
 if ((__builtin_constant_p(value_type == (1<<0)) ? (value_type == (1<<0)) : (0))) {
  if (__builtin_expect(!!(((((*(variable_ptr)).u1.type_info) & 0xff00) != 0)), 0)) {
   zval_addref_p(variable_ptr);
  }
 } else if (value_type & ((1<<0)|(1<<3))) {
  if (((((*(variable_ptr)).u1.type_info) & 0xff00) != 0)) {
   zval_addref_p(variable_ptr);
  }
 } else if ((__builtin_constant_p(value_type == (1<<2)) ? (value_type == (1<<2)) : (1)) && __builtin_expect(!!(ref), 0)) {
  if (__builtin_expect(!!(zend_gc_delref(&(ref)->gc) == 0), 0)) {
   do { if (__builtin_constant_p(sizeof(zend_reference))) { if (sizeof(zend_reference) <= 8) { _efree_8(ref); } else if (sizeof(zend_reference) <= 16) { _efree_16(ref); } else if (sizeof(zend_reference) <= 24) { _efree_24(ref); } else if (sizeof(zend_reference) <= 32) { _efree_32(ref); } else if (sizeof(zend_reference) <= 40) { _efree_40(ref); } else if (sizeof(zend_reference) <= 48) { _efree_48(ref); } else if (sizeof(zend_reference) <= 56) { _efree_56(ref); } else if (sizeof(zend_reference) <= 64) { _efree_64(ref); } else if (sizeof(zend_reference) <= 80) { _efree_80(ref); } else if (sizeof(zend_reference) <= 96) { _efree_96(ref); } else if (sizeof(zend_reference) <= 112) { _efree_112(ref); } else if (sizeof(zend_reference) <= 128) { _efree_128(ref); } else if (sizeof(zend_reference) <= 160) { _efree_160(ref); } else if (sizeof(zend_reference) <= 192) { _efree_192(ref); } else if (sizeof(zend_reference) <= 224) { _efree_224(ref); } else if (sizeof(zend_reference) <= 256) { _efree_256(ref); } else if (sizeof(zend_reference) <= 320) { _efree_320(ref); } else if (sizeof(zend_reference) <= 384) { _efree_384(ref); } else if (sizeof(zend_reference) <= 448) { _efree_448(ref); } else if (sizeof(zend_reference) <= 512) { _efree_512(ref); } else if (sizeof(zend_reference) <= 640) { _efree_640(ref); } else if (sizeof(zend_reference) <= 768) { _efree_768(ref); } else if (sizeof(zend_reference) <= 896) { _efree_896(ref); } else if (sizeof(zend_reference) <= 1024) { _efree_1024(ref); } else if (sizeof(zend_reference) <= 1280) { _efree_1280(ref); } else if (sizeof(zend_reference) <= 1536) { _efree_1536(ref); } else if (sizeof(zend_reference) <= 1792) { _efree_1792(ref); } else if (sizeof(zend_reference) <= 2048) { _efree_2048(ref); } else if (sizeof(zend_reference) <= 2560) { _efree_2560(ref); } else if (sizeof(zend_reference) <= 3072) { _efree_3072(ref); } else if (sizeof(zend_reference) <= (((size_t) (2 * 1024 * 1024)) - ((4 * 1024) * (1)))) { _efree_large(ref, sizeof(zend_reference)); } else { _efree_huge(ref, sizeof(zend_reference)); } } else { _efree(ref); } } while (0);
  } else if (((((*(variable_ptr)).u1.type_info) & 0xff00) != 0)) {
   zval_addref_p(variable_ptr);
  }
 }
}

static inline __attribute__((always_inline)) zval* zend_assign_to_variable(zval *variable_ptr, zval *value, zend_uchar value_type, zend_bool strict)
{
 do {
  if (__builtin_expect(!!(((*(variable_ptr)).u1.v.type_flags != 0)), 0)) {
   zend_refcounted *garbage;

   if ((zval_get_type(&(*(variable_ptr))) == 10)) {
    if (__builtin_expect(!!((((*(variable_ptr)).value.ref)->sources.ptr != ((void*)0))), 0)) {
     return zend_assign_to_typed_ref(variable_ptr, value, value_type, strict);
    }

    variable_ptr = &(*(variable_ptr)).value.ref->val;
    if (__builtin_expect(!!(!((*(variable_ptr)).u1.v.type_flags != 0)), 1)) {
     break;
    }
   }
   garbage = (*(variable_ptr)).value.counted;
   zend_copy_to_variable(variable_ptr, value, value_type);
   if (zend_gc_delref(&(garbage)->gc) == 0) {
    rc_dtor_func(garbage);
   } else {

    if (__builtin_expect(!!((((garbage)->gc.u.type_info & (0xfffffc00 | ((1<<4) << 0))) == 0)), 0)) {
     gc_possible_root(garbage);
    }
   }
   return variable_ptr;
  }
 } while (0);

 zend_copy_to_variable(variable_ptr, value, value_type);
 return variable_ptr;
}

__attribute__ ((visibility("default"))) zend_result zval_update_constant(zval *pp);
__attribute__ ((visibility("default"))) zend_result zval_update_constant_ex(zval *pp, zend_class_entry *scope);


struct _zend_vm_stack {
 zval *top;
 zval *end;
 zend_vm_stack prev;
};
# 189 "Zend/zend_execute.h"
__attribute__ ((visibility("default"))) void zend_vm_stack_init(void);
__attribute__ ((visibility("default"))) void zend_vm_stack_init_ex(size_t page_size);
__attribute__ ((visibility("default"))) void zend_vm_stack_destroy(void);
__attribute__ ((visibility("default"))) void* zend_vm_stack_extend(size_t size);

static inline __attribute__((always_inline)) void zend_vm_init_call_frame(zend_execute_data *call, uint32_t call_info, zend_function *func, uint32_t num_args, void *object_or_called_scope)
{
 call->func = func;
 (call->This).value.ptr = object_or_called_scope;
 ((call)->This).u1.type_info = call_info;
 (call)->This.u2.num_args = num_args;
}

static inline __attribute__((always_inline)) zend_execute_data *zend_vm_stack_push_call_frame_ex(uint32_t used_stack, uint32_t call_info, zend_function *func, uint32_t num_args, void *object_or_called_scope)
{
 zend_execute_data *call = (zend_execute_data*)(executor_globals.vm_stack_top);

                            ;

 if (__builtin_expect(!!(used_stack > (size_t)(((char*)(executor_globals.vm_stack_end)) - (char*)call)), 0)) {
  call = (zend_execute_data*)zend_vm_stack_extend(used_stack);
                             ;
  zend_vm_init_call_frame(call, call_info | (1 << 18), func, num_args, object_or_called_scope);
  return call;
 } else {
  (executor_globals.vm_stack_top) = (zval*)((char*)call + used_stack);
  zend_vm_init_call_frame(call, call_info, func, num_args, object_or_called_scope);
  return call;
 }
}

static inline __attribute__((always_inline)) uint32_t zend_vm_calc_used_stack(uint32_t num_args, zend_function *func)
{
 uint32_t used_stack = ((int)(((((sizeof(zend_execute_data)) + 8 - 1) & ~(8 - 1)) + (((sizeof(zval)) + 8 - 1) & ~(8 - 1)) - 1) / (((sizeof(zval)) + 8 - 1) & ~(8 - 1)))) + num_args;

 if (__builtin_expect(!!(((func->type) != 1)), 1)) {
  used_stack += func->op_array.last_var + func->op_array.T - (((func->op_array.num_args)<(num_args))?(func->op_array.num_args):(num_args));
 }
 return used_stack * sizeof(zval);
}

static inline __attribute__((always_inline)) zend_execute_data *zend_vm_stack_push_call_frame(uint32_t call_info, zend_function *func, uint32_t num_args, void *object_or_called_scope)
{
 uint32_t used_stack = zend_vm_calc_used_stack(num_args, func);

 return zend_vm_stack_push_call_frame_ex(used_stack, call_info,
  func, num_args, object_or_called_scope);
}

static inline __attribute__((always_inline)) void zend_vm_stack_free_extra_args_ex(uint32_t call_info, zend_execute_data *call)
{
 if (__builtin_expect(!!(call_info & (1 << 19)), 0)) {
  uint32_t count = (call)->This.u2.num_args - call->func->op_array.num_args;
  zval *p = (((zval*)(call)) + (((int)(((((sizeof(zend_execute_data)) + 8 - 1) & ~(8 - 1)) + (((sizeof(zval)) + 8 - 1) & ~(8 - 1)) - 1) / (((sizeof(zval)) + 8 - 1) & ~(8 - 1)))) + ((int)(call->func->op_array.last_var + call->func->op_array.T))));
  do {
   i_zval_ptr_dtor(p);
   p++;
  } while (--count);
  }
}

static inline __attribute__((always_inline)) void zend_vm_stack_free_extra_args(zend_execute_data *call)
{
 zend_vm_stack_free_extra_args_ex(((call)->This).u1.type_info, call);
}

static inline __attribute__((always_inline)) void zend_vm_stack_free_args(zend_execute_data *call)
{
 uint32_t num_args = (call)->This.u2.num_args;

 if (__builtin_expect(!!(num_args > 0), 1)) {
  zval *p = (((zval*)(call)) + (((int)(((((sizeof(zend_execute_data)) + 8 - 1) & ~(8 - 1)) + (((sizeof(zval)) + 8 - 1) & ~(8 - 1)) - 1) / (((sizeof(zval)) + 8 - 1) & ~(8 - 1)))) + ((int)(((int)(1)) - 1))));

  do {
   zval_ptr_dtor_nogc(p);
   p++;
  } while (--num_args);
 }
}

static inline __attribute__((always_inline)) void zend_vm_stack_free_call_frame_ex(uint32_t call_info, zend_execute_data *call)
{
                            ;

 if (__builtin_expect(!!(call_info & (1 << 18)), 0)) {
  zend_vm_stack p = (executor_globals.vm_stack);
  zend_vm_stack prev = p->prev;

  do { if (__builtin_expect(!(call == (zend_execute_data*)(((zval*)((executor_globals.vm_stack))) + (((((sizeof(struct _zend_vm_stack)) + 8 - 1) & ~(8 - 1)) + (((sizeof(zval)) + 8 - 1) & ~(8 - 1)) - 1) / (((sizeof(zval)) + 8 - 1) & ~(8 - 1))))), 0)) __builtin_unreachable(); } while (0);
  (executor_globals.vm_stack_top) = prev->top;
  (executor_globals.vm_stack_end) = prev->end;
  (executor_globals.vm_stack) = prev;
  _efree((p) );
 } else {
  (executor_globals.vm_stack_top) = (zval*)call;
 }

                            ;
}

static inline __attribute__((always_inline)) void zend_vm_stack_free_call_frame(zend_execute_data *call)
{
 zend_vm_stack_free_call_frame_ex(((call)->This).u1.type_info, call);
}

zend_execute_data *zend_vm_stack_copy_call_frame(
 zend_execute_data *call, uint32_t passed_args, uint32_t additional_args);

static inline __attribute__((always_inline)) void zend_vm_stack_extend_call_frame(
 zend_execute_data **call, uint32_t passed_args, uint32_t additional_args)
{
 if (__builtin_expect(!!((uint32_t)((executor_globals.vm_stack_end) - (executor_globals.vm_stack_top)) > additional_args), 1)) {
  (executor_globals.vm_stack_top) += additional_args;
 } else {
  *call = zend_vm_stack_copy_call_frame(*call, passed_args, additional_args);
 }
}

__attribute__ ((visibility("default"))) void zend_free_extra_named_params(zend_array *extra_named_params);


__attribute__ ((visibility("default"))) const char *get_active_class_name(const char **space);
__attribute__ ((visibility("default"))) const char *get_active_function_name(void);
__attribute__ ((visibility("default"))) const char *get_active_function_arg_name(uint32_t arg_num);
__attribute__ ((visibility("default"))) const char *get_function_arg_name(const zend_function *func, uint32_t arg_num);
__attribute__ ((visibility("default"))) zend_string *get_active_function_or_method_name(void);
__attribute__ ((visibility("default"))) zend_string *get_function_or_method_name(const zend_function *func);
__attribute__ ((visibility("default"))) const char *zend_get_executed_filename(void);
__attribute__ ((visibility("default"))) zend_string *zend_get_executed_filename_ex(void);
__attribute__ ((visibility("default"))) uint32_t zend_get_executed_lineno(void);
__attribute__ ((visibility("default"))) zend_class_entry *zend_get_executed_scope(void);
__attribute__ ((visibility("default"))) zend_bool zend_is_executing(void);
__attribute__ ((visibility("default"))) void zend_cannot_pass_by_reference(uint32_t arg_num);

__attribute__ ((visibility("default"))) void zend_set_timeout(zend_long seconds, _Bool reset_signals);
__attribute__ ((visibility("default"))) void zend_unset_timeout(void);
__attribute__ ((visibility("default"))) __attribute__((noreturn)) void zend_timeout(void);
__attribute__ ((visibility("default"))) zend_class_entry *zend_fetch_class(zend_string *class_name, int fetch_type);
__attribute__ ((visibility("default"))) zend_class_entry *zend_fetch_class_by_name(zend_string *class_name, zend_string *lcname, int fetch_type);

__attribute__ ((visibility("default"))) zend_function * zend_fetch_function(zend_string *name);
__attribute__ ((visibility("default"))) zend_function * zend_fetch_function_str(const char *name, size_t len);
__attribute__ ((visibility("default"))) void zend_init_func_run_time_cache(zend_op_array *op_array);

__attribute__ ((visibility("default"))) void zend_fetch_dimension_const(zval *result, zval *container, zval *dim, int type);

__attribute__ ((visibility("default"))) zval* zend_get_compiled_variable_value(const zend_execute_data *execute_data_ptr, uint32_t var);
# 345 "Zend/zend_execute.h"
__attribute__ ((visibility("default"))) int zend_set_user_opcode_handler(zend_uchar opcode, user_opcode_handler_t handler);
__attribute__ ((visibility("default"))) user_opcode_handler_t zend_get_user_opcode_handler(zend_uchar opcode);

__attribute__ ((visibility("default"))) zval *zend_get_zval_ptr(const zend_op *opline, int op_type, const znode_op *node, const zend_execute_data *execute_data);

__attribute__ ((visibility("default"))) void zend_clean_and_cache_symbol_table(zend_array *symbol_table);
__attribute__ ((visibility("default"))) void zend_free_compiled_variables(zend_execute_data *execute_data);
__attribute__ ((visibility("default"))) void zend_cleanup_unfinished_execution(zend_execute_data *execute_data, uint32_t op_num, uint32_t catch_op_num);

zval * zend_handle_named_arg(
  zend_execute_data **call_ptr, zend_string *arg_name,
  uint32_t *arg_num_ptr, void **cache_slot);
__attribute__ ((visibility("default"))) int zend_handle_undef_args(zend_execute_data *call);
# 421 "Zend/zend_execute.h"
__attribute__ ((visibility("default"))) zend_bool zend_verify_property_type(zend_property_info *info, zval *property, zend_bool strict);
          void zend_verify_property_type_error(zend_property_info *info, zval *property);
# 11 "/root/pib_eval.c" 2
# 1 "Zend/zend_API.h" 1
# 26 "Zend/zend_API.h"
# 1 "Zend/zend_list.h" 1
# 28 "Zend/zend_list.h"
typedef void (*rsrc_dtor_func_t)(zend_resource *res);


typedef struct _zend_rsrc_list_dtors_entry {
 rsrc_dtor_func_t list_dtor_ex;
 rsrc_dtor_func_t plist_dtor_ex;

 const char *type_name;

 int module_number;
 int resource_id;
} zend_rsrc_list_dtors_entry;


__attribute__ ((visibility("default"))) int zend_register_list_destructors_ex(rsrc_dtor_func_t ld, rsrc_dtor_func_t pld, const char *type_name, int module_number);

void list_entry_destructor(zval *ptr);
void plist_entry_destructor(zval *ptr);

void zend_clean_module_rsrc_dtors(int module_number);
__attribute__ ((visibility("default"))) void zend_init_rsrc_list(void);
void zend_init_rsrc_plist(void);
void zend_close_rsrc_list(HashTable *ht);
void zend_destroy_rsrc_list(HashTable *ht);
void zend_init_rsrc_list_dtors(void);
void zend_destroy_rsrc_list_dtors(void);

__attribute__ ((visibility("default"))) zval* zend_list_insert(void *ptr, int type);
__attribute__ ((visibility("default"))) void zend_list_free(zend_resource *res);
__attribute__ ((visibility("default"))) int zend_list_delete(zend_resource *res);
__attribute__ ((visibility("default"))) void zend_list_close(zend_resource *res);

__attribute__ ((visibility("default"))) zend_resource *zend_register_resource(void *rsrc_pointer, int rsrc_type);
__attribute__ ((visibility("default"))) void *zend_fetch_resource(zend_resource *res, const char *resource_type_name, int resource_type);
__attribute__ ((visibility("default"))) void *zend_fetch_resource2(zend_resource *res, const char *resource_type_name, int resource_type, int resource_type2);
__attribute__ ((visibility("default"))) void *zend_fetch_resource_ex(zval *res, const char *resource_type_name, int resource_type);
__attribute__ ((visibility("default"))) void *zend_fetch_resource2_ex(zval *res, const char *resource_type_name, int resource_type, int resource_type2);

__attribute__ ((visibility("default"))) const char *zend_rsrc_list_get_rsrc_type(zend_resource *res);
__attribute__ ((visibility("default"))) int zend_fetch_list_dtor_id(const char *type_name);

__attribute__ ((visibility("default"))) zend_resource* zend_register_persistent_resource(const char *key, size_t key_len, void *rsrc_pointer, int rsrc_type);
__attribute__ ((visibility("default"))) zend_resource* zend_register_persistent_resource_ex(zend_string *key, void *rsrc_pointer, int rsrc_type);

extern __attribute__ ((visibility("default"))) int le_index_ptr;
# 27 "Zend/zend_API.h" 2



# 1 "Zend/zend_type_info.h" 1
# 31 "Zend/zend_API.h" 2




typedef struct _zend_function_entry {
 const char *fname;
 zif_handler handler;
 const struct _zend_internal_arg_info *arg_info;
 uint32_t num_args;
 uint32_t flags;
} zend_function_entry;

typedef struct _zend_fcall_info {
 size_t size;
 zval function_name;
 zval *retval;
 zval *params;
 zend_object *object;
 uint32_t param_count;




 HashTable *named_params;
} zend_fcall_info;

typedef struct _zend_fcall_info_cache {
 zend_function *function_handler;
 zend_class_entry *calling_scope;
 zend_class_entry *called_scope;
 zend_object *object;
} zend_fcall_info_cache;
# 283 "Zend/zend_API.h"
__attribute__ ((visibility("default"))) int zend_next_free_module(void);


__attribute__ ((visibility("default"))) zend_result _zend_get_parameters_array_ex(uint32_t param_count, zval *argument_array);


__attribute__ ((visibility("default"))) zend_result zend_copy_parameters_array(uint32_t param_count, zval *argument_array);
# 304 "Zend/zend_API.h"
__attribute__ ((visibility("default"))) zend_result zend_parse_parameters(uint32_t num_args, const char *type_spec, ...);
__attribute__ ((visibility("default"))) zend_result zend_parse_parameters_ex(int flags, uint32_t num_args, const char *type_spec, ...);



__attribute__ ((visibility("default"))) const char *zend_zval_type_name(const zval *arg);
__attribute__ ((visibility("default"))) zend_string *zend_zval_get_legacy_type(const zval *arg);

__attribute__ ((visibility("default"))) zend_result zend_parse_method_parameters(uint32_t num_args, zval *this_ptr, const char *type_spec, ...);
__attribute__ ((visibility("default"))) zend_result zend_parse_method_parameters_ex(int flags, uint32_t num_args, zval *this_ptr, const char *type_spec, ...);

__attribute__ ((visibility("default"))) zend_result zend_parse_parameter(int flags, uint32_t arg_num, zval *arg, const char *spec, ...);



__attribute__ ((visibility("default"))) zend_result zend_register_functions(zend_class_entry *scope, const zend_function_entry *functions, HashTable *function_table, int type);
__attribute__ ((visibility("default"))) void zend_unregister_functions(const zend_function_entry *functions, int count, HashTable *function_table);
__attribute__ ((visibility("default"))) zend_result zend_startup_module(zend_module_entry *module_entry);
__attribute__ ((visibility("default"))) zend_module_entry* zend_register_internal_module(zend_module_entry *module_entry);
__attribute__ ((visibility("default"))) zend_module_entry* zend_register_module_ex(zend_module_entry *module);
__attribute__ ((visibility("default"))) zend_result zend_startup_module_ex(zend_module_entry *module);
__attribute__ ((visibility("default"))) void zend_startup_modules(void);
__attribute__ ((visibility("default"))) void zend_collect_module_handlers(void);
__attribute__ ((visibility("default"))) void zend_destroy_modules(void);
__attribute__ ((visibility("default"))) void zend_check_magic_method_implementation(
  const zend_class_entry *ce, const zend_function *fptr, zend_string *lcname, int error_type);
__attribute__ ((visibility("default"))) void zend_add_magic_method(zend_class_entry *ce, zend_function *fptr, zend_string *lcname);

__attribute__ ((visibility("default"))) zend_class_entry *zend_register_internal_class(zend_class_entry *class_entry);
__attribute__ ((visibility("default"))) zend_class_entry *zend_register_internal_class_ex(zend_class_entry *class_entry, zend_class_entry *parent_ce);
__attribute__ ((visibility("default"))) zend_class_entry *zend_register_internal_interface(zend_class_entry *orig_class_entry);
__attribute__ ((visibility("default"))) void zend_class_implements(zend_class_entry *class_entry, int num_interfaces, ...);

__attribute__ ((visibility("default"))) zend_result zend_register_class_alias_ex(const char *name, size_t name_len, zend_class_entry *ce, _Bool persistent);






__attribute__ ((visibility("default"))) void zend_disable_functions(const char *function_list);
__attribute__ ((visibility("default"))) zend_result zend_disable_class(const char *class_name, size_t class_name_length);

__attribute__ ((visibility("default"))) void zend_wrong_param_count(void);




__attribute__ ((visibility("default"))) void zend_release_fcall_info_cache(zend_fcall_info_cache *fcc);
__attribute__ ((visibility("default"))) zend_string *zend_get_callable_name_ex(zval *callable, zend_object *object);
__attribute__ ((visibility("default"))) zend_string *zend_get_callable_name(zval *callable);
__attribute__ ((visibility("default"))) zend_bool zend_is_callable_at_frame(
  zval *callable, zend_object *object, zend_execute_data *frame,
  uint32_t check_flags, zend_fcall_info_cache *fcc, char **error);
__attribute__ ((visibility("default"))) zend_bool zend_is_callable_ex(zval *callable, zend_object *object, uint32_t check_flags, zend_string **callable_name, zend_fcall_info_cache *fcc, char **error);
__attribute__ ((visibility("default"))) zend_bool zend_is_callable(zval *callable, uint32_t check_flags, zend_string **callable_name);
__attribute__ ((visibility("default"))) zend_bool zend_make_callable(zval *callable, zend_string **callable_name);
__attribute__ ((visibility("default"))) const char *zend_get_module_version(const char *module_name);
__attribute__ ((visibility("default"))) int zend_get_module_started(const char *module_name);

__attribute__ ((visibility("default"))) zend_property_info *zend_declare_typed_property(zend_class_entry *ce, zend_string *name, zval *property, int access_type, zend_string *doc_comment, zend_type type);

__attribute__ ((visibility("default"))) void zend_declare_property_ex(zend_class_entry *ce, zend_string *name, zval *property, int access_type, zend_string *doc_comment);
__attribute__ ((visibility("default"))) void zend_declare_property(zend_class_entry *ce, const char *name, size_t name_length, zval *property, int access_type);
__attribute__ ((visibility("default"))) void zend_declare_property_null(zend_class_entry *ce, const char *name, size_t name_length, int access_type);
__attribute__ ((visibility("default"))) void zend_declare_property_bool(zend_class_entry *ce, const char *name, size_t name_length, zend_long value, int access_type);
__attribute__ ((visibility("default"))) void zend_declare_property_long(zend_class_entry *ce, const char *name, size_t name_length, zend_long value, int access_type);
__attribute__ ((visibility("default"))) void zend_declare_property_double(zend_class_entry *ce, const char *name, size_t name_length, double value, int access_type);
__attribute__ ((visibility("default"))) void zend_declare_property_string(zend_class_entry *ce, const char *name, size_t name_length, const char *value, int access_type);
__attribute__ ((visibility("default"))) void zend_declare_property_stringl(zend_class_entry *ce, const char *name, size_t name_length, const char *value, size_t value_len, int access_type);

__attribute__ ((visibility("default"))) zend_class_constant *zend_declare_class_constant_ex(zend_class_entry *ce, zend_string *name, zval *value, int access_type, zend_string *doc_comment);
__attribute__ ((visibility("default"))) void zend_declare_class_constant(zend_class_entry *ce, const char *name, size_t name_length, zval *value);
__attribute__ ((visibility("default"))) void zend_declare_class_constant_null(zend_class_entry *ce, const char *name, size_t name_length);
__attribute__ ((visibility("default"))) void zend_declare_class_constant_long(zend_class_entry *ce, const char *name, size_t name_length, zend_long value);
__attribute__ ((visibility("default"))) void zend_declare_class_constant_bool(zend_class_entry *ce, const char *name, size_t name_length, zend_bool value);
__attribute__ ((visibility("default"))) void zend_declare_class_constant_double(zend_class_entry *ce, const char *name, size_t name_length, double value);
__attribute__ ((visibility("default"))) void zend_declare_class_constant_stringl(zend_class_entry *ce, const char *name, size_t name_length, const char *value, size_t value_length);
__attribute__ ((visibility("default"))) void zend_declare_class_constant_string(zend_class_entry *ce, const char *name, size_t name_length, const char *value);

__attribute__ ((visibility("default"))) zend_result zend_update_class_constants(zend_class_entry *class_type);

__attribute__ ((visibility("default"))) void zend_update_property_ex(zend_class_entry *scope, zend_object *object, zend_string *name, zval *value);
__attribute__ ((visibility("default"))) void zend_update_property(zend_class_entry *scope, zend_object *object, const char *name, size_t name_length, zval *value);
__attribute__ ((visibility("default"))) void zend_update_property_null(zend_class_entry *scope, zend_object *object, const char *name, size_t name_length);
__attribute__ ((visibility("default"))) void zend_update_property_bool(zend_class_entry *scope, zend_object *object, const char *name, size_t name_length, zend_long value);
__attribute__ ((visibility("default"))) void zend_update_property_long(zend_class_entry *scope, zend_object *object, const char *name, size_t name_length, zend_long value);
__attribute__ ((visibility("default"))) void zend_update_property_double(zend_class_entry *scope, zend_object *object, const char *name, size_t name_length, double value);
__attribute__ ((visibility("default"))) void zend_update_property_str(zend_class_entry *scope, zend_object *object, const char *name, size_t name_length, zend_string *value);
__attribute__ ((visibility("default"))) void zend_update_property_string(zend_class_entry *scope, zend_object *object, const char *name, size_t name_length, const char *value);
__attribute__ ((visibility("default"))) void zend_update_property_stringl(zend_class_entry *scope, zend_object *object, const char *name, size_t name_length, const char *value, size_t value_length);
__attribute__ ((visibility("default"))) void zend_unset_property(zend_class_entry *scope, zend_object *object, const char *name, size_t name_length);

__attribute__ ((visibility("default"))) zend_result zend_update_static_property_ex(zend_class_entry *scope, zend_string *name, zval *value);
__attribute__ ((visibility("default"))) zend_result zend_update_static_property(zend_class_entry *scope, const char *name, size_t name_length, zval *value);
__attribute__ ((visibility("default"))) zend_result zend_update_static_property_null(zend_class_entry *scope, const char *name, size_t name_length);
__attribute__ ((visibility("default"))) zend_result zend_update_static_property_bool(zend_class_entry *scope, const char *name, size_t name_length, zend_long value);
__attribute__ ((visibility("default"))) zend_result zend_update_static_property_long(zend_class_entry *scope, const char *name, size_t name_length, zend_long value);
__attribute__ ((visibility("default"))) zend_result zend_update_static_property_double(zend_class_entry *scope, const char *name, size_t name_length, double value);
__attribute__ ((visibility("default"))) zend_result zend_update_static_property_string(zend_class_entry *scope, const char *name, size_t name_length, const char *value);
__attribute__ ((visibility("default"))) zend_result zend_update_static_property_stringl(zend_class_entry *scope, const char *name, size_t name_length, const char *value, size_t value_length);

__attribute__ ((visibility("default"))) zval *zend_read_property_ex(zend_class_entry *scope, zend_object *object, zend_string *name, zend_bool silent, zval *rv);
__attribute__ ((visibility("default"))) zval *zend_read_property(zend_class_entry *scope, zend_object *object, const char *name, size_t name_length, zend_bool silent, zval *rv);

__attribute__ ((visibility("default"))) zval *zend_read_static_property_ex(zend_class_entry *scope, zend_string *name, zend_bool silent);
__attribute__ ((visibility("default"))) zval *zend_read_static_property(zend_class_entry *scope, const char *name, size_t name_length, zend_bool silent);

__attribute__ ((visibility("default"))) const char *zend_get_type_by_const(int type);
# 431 "Zend/zend_API.h"
__attribute__ ((visibility("default"))) void object_init(zval *arg);
__attribute__ ((visibility("default"))) zend_result object_init_ex(zval *arg, zend_class_entry *ce);
__attribute__ ((visibility("default"))) zend_result object_and_properties_init(zval *arg, zend_class_entry *ce, HashTable *properties);
__attribute__ ((visibility("default"))) void object_properties_init(zend_object *object, zend_class_entry *class_type);
__attribute__ ((visibility("default"))) void object_properties_init_ex(zend_object *object, HashTable *properties);
__attribute__ ((visibility("default"))) void object_properties_load(zend_object *object, HashTable *properties);

__attribute__ ((visibility("default"))) void zend_merge_properties(zval *obj, HashTable *properties);

__attribute__ ((visibility("default"))) void add_assoc_long_ex(zval *arg, const char *key, size_t key_len, zend_long n);
__attribute__ ((visibility("default"))) void add_assoc_null_ex(zval *arg, const char *key, size_t key_len);
__attribute__ ((visibility("default"))) void add_assoc_bool_ex(zval *arg, const char *key, size_t key_len, _Bool b);
__attribute__ ((visibility("default"))) void add_assoc_resource_ex(zval *arg, const char *key, size_t key_len, zend_resource *r);
__attribute__ ((visibility("default"))) void add_assoc_double_ex(zval *arg, const char *key, size_t key_len, double d);
__attribute__ ((visibility("default"))) void add_assoc_str_ex(zval *arg, const char *key, size_t key_len, zend_string *str);
__attribute__ ((visibility("default"))) void add_assoc_string_ex(zval *arg, const char *key, size_t key_len, const char *str);
__attribute__ ((visibility("default"))) void add_assoc_stringl_ex(zval *arg, const char *key, size_t key_len, const char *str, size_t length);
__attribute__ ((visibility("default"))) void add_assoc_zval_ex(zval *arg, const char *key, size_t key_len, zval *value);
# 460 "Zend/zend_API.h"
__attribute__ ((visibility("default"))) void add_index_long(zval *arg, zend_ulong index, zend_long n);
__attribute__ ((visibility("default"))) void add_index_null(zval *arg, zend_ulong index);
__attribute__ ((visibility("default"))) void add_index_bool(zval *arg, zend_ulong index, _Bool b);
__attribute__ ((visibility("default"))) void add_index_resource(zval *arg, zend_ulong index, zend_resource *r);
__attribute__ ((visibility("default"))) void add_index_double(zval *arg, zend_ulong index, double d);
__attribute__ ((visibility("default"))) void add_index_str(zval *arg, zend_ulong index, zend_string *str);
__attribute__ ((visibility("default"))) void add_index_string(zval *arg, zend_ulong index, const char *str);
__attribute__ ((visibility("default"))) void add_index_stringl(zval *arg, zend_ulong index, const char *str, size_t length);

static inline __attribute__((always_inline)) zend_result add_index_zval(zval *arg, zend_ulong index, zval *value)
{
 return zend_hash_index_update((*(arg)).value.arr, index, value) ? SUCCESS : FAILURE;
}

__attribute__ ((visibility("default"))) zend_result add_next_index_long(zval *arg, zend_long n);
__attribute__ ((visibility("default"))) zend_result add_next_index_null(zval *arg);
__attribute__ ((visibility("default"))) zend_result add_next_index_bool(zval *arg, zend_bool b);
__attribute__ ((visibility("default"))) zend_result add_next_index_resource(zval *arg, zend_resource *r);
__attribute__ ((visibility("default"))) zend_result add_next_index_double(zval *arg, double d);
__attribute__ ((visibility("default"))) zend_result add_next_index_str(zval *arg, zend_string *str);
__attribute__ ((visibility("default"))) zend_result add_next_index_string(zval *arg, const char *str);
__attribute__ ((visibility("default"))) zend_result add_next_index_stringl(zval *arg, const char *str, size_t length);

static inline __attribute__((always_inline)) zend_result add_next_index_zval(zval *arg, zval *value)
{
 return zend_hash_next_index_insert((*(arg)).value.arr, value) ? SUCCESS : FAILURE;
}

__attribute__ ((visibility("default"))) zend_result array_set_zval_key(HashTable *ht, zval *key, zval *value);

__attribute__ ((visibility("default"))) void add_property_long_ex(zval *arg, const char *key, size_t key_len, zend_long l);
__attribute__ ((visibility("default"))) void add_property_null_ex(zval *arg, const char *key, size_t key_len);
__attribute__ ((visibility("default"))) void add_property_bool_ex(zval *arg, const char *key, size_t key_len, zend_long b);
__attribute__ ((visibility("default"))) void add_property_resource_ex(zval *arg, const char *key, size_t key_len, zend_resource *r);
__attribute__ ((visibility("default"))) void add_property_double_ex(zval *arg, const char *key, size_t key_len, double d);
__attribute__ ((visibility("default"))) void add_property_str_ex(zval *arg, const char *key, size_t key_len, zend_string *str);
__attribute__ ((visibility("default"))) void add_property_string_ex(zval *arg, const char *key, size_t key_len, const char *str);
__attribute__ ((visibility("default"))) void add_property_stringl_ex(zval *arg, const char *key, size_t key_len, const char *str, size_t length);
__attribute__ ((visibility("default"))) void add_property_zval_ex(zval *arg, const char *key, size_t key_len, zval *value);
# 511 "Zend/zend_API.h"
__attribute__ ((visibility("default"))) zend_result _call_user_function_impl(zval *object, zval *function_name, zval *retval_ptr, uint32_t param_count, zval params[], HashTable *named_params);







__attribute__ ((visibility("default"))) extern const zend_fcall_info empty_fcall_info;
__attribute__ ((visibility("default"))) extern const zend_fcall_info_cache empty_fcall_info_cache;
# 530 "Zend/zend_API.h"
__attribute__ ((visibility("default"))) zend_result zend_fcall_info_init(zval *callable, uint32_t check_flags, zend_fcall_info *fci, zend_fcall_info_cache *fcc, zend_string **callable_name, char **error);




__attribute__ ((visibility("default"))) void zend_fcall_info_args_clear(zend_fcall_info *fci, _Bool free_mem);




__attribute__ ((visibility("default"))) void zend_fcall_info_args_save(zend_fcall_info *fci, uint32_t *param_count, zval **params);



__attribute__ ((visibility("default"))) void zend_fcall_info_args_restore(zend_fcall_info *fci, uint32_t param_count, zval *params);




__attribute__ ((visibility("default"))) zend_result zend_fcall_info_args(zend_fcall_info *fci, zval *args);
__attribute__ ((visibility("default"))) zend_result zend_fcall_info_args_ex(zend_fcall_info *fci, zend_function *func, zval *args);





__attribute__ ((visibility("default"))) void zend_fcall_info_argp(zend_fcall_info *fci, uint32_t argc, zval *argv);





__attribute__ ((visibility("default"))) void zend_fcall_info_argv(zend_fcall_info *fci, uint32_t argc, va_list *argv);





__attribute__ ((visibility("default"))) void zend_fcall_info_argn(zend_fcall_info *fci, uint32_t argc, ...);




__attribute__ ((visibility("default"))) zend_result zend_fcall_info_call(zend_fcall_info *fci, zend_fcall_info_cache *fcc, zval *retval, zval *args);

__attribute__ ((visibility("default"))) zend_result zend_call_function(zend_fcall_info *fci, zend_fcall_info_cache *fci_cache);





__attribute__ ((visibility("default"))) void zend_call_known_function(
  zend_function *fn, zend_object *object, zend_class_entry *called_scope, zval *retval_ptr,
  uint32_t param_count, zval *params, HashTable *named_params);


static inline __attribute__((always_inline)) void zend_call_known_instance_method(
  zend_function *fn, zend_object *object, zval *retval_ptr,
  uint32_t param_count, zval *params)
{
 zend_call_known_function(fn, object, object->ce, retval_ptr, param_count, params, ((void*)0));
}

static inline __attribute__((always_inline)) void zend_call_known_instance_method_with_0_params(
  zend_function *fn, zend_object *object, zval *retval_ptr)
{
 zend_call_known_instance_method(fn, object, retval_ptr, 0, ((void*)0));
}

static inline __attribute__((always_inline)) void zend_call_known_instance_method_with_1_params(
  zend_function *fn, zend_object *object, zval *retval_ptr, zval *param)
{
 zend_call_known_instance_method(fn, object, retval_ptr, 1, param);
}

__attribute__ ((visibility("default"))) void zend_call_known_instance_method_with_2_params(
  zend_function *fn, zend_object *object, zval *retval_ptr, zval *param1, zval *param2);

__attribute__ ((visibility("default"))) zend_result zend_set_hash_symbol(zval *symbol, const char *name, size_t name_length, zend_bool is_ref, int num_symbol_tables, ...);

__attribute__ ((visibility("default"))) zend_result zend_delete_global_variable(zend_string *name);

__attribute__ ((visibility("default"))) zend_array *zend_rebuild_symbol_table(void);
__attribute__ ((visibility("default"))) void zend_attach_symbol_table(zend_execute_data *execute_data);
__attribute__ ((visibility("default"))) void zend_detach_symbol_table(zend_execute_data *execute_data);
__attribute__ ((visibility("default"))) zend_result zend_set_local_var(zend_string *name, zval *value, _Bool force);
__attribute__ ((visibility("default"))) zend_result zend_set_local_var_str(const char *name, size_t len, zval *value, _Bool force);

static inline __attribute__((always_inline)) zend_result zend_forbid_dynamic_call(const char *func_name)
{
 zend_execute_data *ex = (executor_globals.current_execute_data);
 do { if (__builtin_expect(!(ex != ((void*)0) && ex->func != ((void*)0)), 0)) __builtin_unreachable(); } while (0);

 if (((ex)->This).u1.type_info & (1 << 25)) {
  zend_throw_error(((void*)0), "Cannot call %s dynamically", func_name);
  return FAILURE;
 }

 return SUCCESS;
}

__attribute__ ((visibility("default"))) const char *zend_get_object_type(const zend_class_entry *ce);

__attribute__ ((visibility("default"))) zend_bool zend_is_iterable(zval *iterable);

__attribute__ ((visibility("default"))) zend_bool zend_is_countable(zval *countable);

__attribute__ ((visibility("default"))) zend_result zend_get_default_from_internal_arg_info(
  zval *default_value_zval, zend_internal_arg_info *arg_info);
# 782 "Zend/zend_API.h"
__attribute__ ((visibility("default"))) zend_result zend_try_assign_typed_ref_ex(zend_reference *ref, zval *zv, zend_bool strict);
__attribute__ ((visibility("default"))) zend_result zend_try_assign_typed_ref(zend_reference *ref, zval *zv);

__attribute__ ((visibility("default"))) zend_result zend_try_assign_typed_ref_null(zend_reference *ref);
__attribute__ ((visibility("default"))) zend_result zend_try_assign_typed_ref_bool(zend_reference *ref, zend_bool val);
__attribute__ ((visibility("default"))) zend_result zend_try_assign_typed_ref_long(zend_reference *ref, zend_long lval);
__attribute__ ((visibility("default"))) zend_result zend_try_assign_typed_ref_double(zend_reference *ref, double dval);
__attribute__ ((visibility("default"))) zend_result zend_try_assign_typed_ref_empty_string(zend_reference *ref);
__attribute__ ((visibility("default"))) zend_result zend_try_assign_typed_ref_str(zend_reference *ref, zend_string *str);
__attribute__ ((visibility("default"))) zend_result zend_try_assign_typed_ref_string(zend_reference *ref, const char *string);
__attribute__ ((visibility("default"))) zend_result zend_try_assign_typed_ref_stringl(zend_reference *ref, const char *string, size_t len);
__attribute__ ((visibility("default"))) zend_result zend_try_assign_typed_ref_arr(zend_reference *ref, zend_array *arr);
__attribute__ ((visibility("default"))) zend_result zend_try_assign_typed_ref_res(zend_reference *ref, zend_resource *res);
__attribute__ ((visibility("default"))) zend_result zend_try_assign_typed_ref_zval(zend_reference *ref, zval *zv);
__attribute__ ((visibility("default"))) zend_result zend_try_assign_typed_ref_zval_ex(zend_reference *ref, zval *zv, zend_bool strict);
# 1172 "Zend/zend_API.h"
static inline __attribute__((always_inline)) zval *zend_try_array_init_size(zval *zv, uint32_t size)
{
 zend_array *arr = (__builtin_constant_p(size) ? ((((uint32_t)(size)) <= 8) ? _zend_new_array_0() : _zend_new_array((size)) ) : _zend_new_array((size)) );

 if (__builtin_expect(!!((zval_get_type(&(*(zv))) == 10)), 1)) {
  zend_reference *ref = (*(zv)).value.ref;
  if (__builtin_expect(!!(((ref)->sources.ptr != ((void*)0))), 0)) {
   if (zend_try_assign_typed_ref_arr(ref, arr) == FAILURE) {
    return ((void*)0);
   }
   return &ref->val;
  }
  zv = &ref->val;
 }
 zval_ptr_dtor(zv);
 do { zend_array *__arr = (arr); zval *__z = (zv); (*(__z)).value.arr = __arr; (*(__z)).u1.type_info = (7 | ((1<<0) << 8) | ((1<<1) << 8)); } while (0);
 return zv;
}

static inline __attribute__((always_inline)) zval *zend_try_array_init(zval *zv)
{
 return zend_try_array_init_size(zv, 0);
}
# 1242 "Zend/zend_API.h"
typedef enum _zend_expected_type {
 Z_EXPECTED_LONG, Z_EXPECTED_LONG_OR_NULL, Z_EXPECTED_BOOL, Z_EXPECTED_BOOL_OR_NULL, Z_EXPECTED_STRING, Z_EXPECTED_STRING_OR_NULL, Z_EXPECTED_ARRAY, Z_EXPECTED_ARRAY_OR_NULL, Z_EXPECTED_ARRAY_OR_LONG, Z_EXPECTED_ARRAY_OR_LONG_OR_NULL, Z_EXPECTED_ITERABLE, Z_EXPECTED_ITERABLE_OR_NULL, Z_EXPECTED_FUNC, Z_EXPECTED_FUNC_OR_NULL, Z_EXPECTED_RESOURCE, Z_EXPECTED_RESOURCE_OR_NULL, Z_EXPECTED_PATH, Z_EXPECTED_PATH_OR_NULL, Z_EXPECTED_OBJECT, Z_EXPECTED_OBJECT_OR_NULL, Z_EXPECTED_DOUBLE, Z_EXPECTED_DOUBLE_OR_NULL, Z_EXPECTED_NUMBER, Z_EXPECTED_NUMBER_OR_NULL, Z_EXPECTED_ARRAY_OR_STRING, Z_EXPECTED_ARRAY_OR_STRING_OR_NULL, Z_EXPECTED_STRING_OR_LONG, Z_EXPECTED_STRING_OR_LONG_OR_NULL, Z_EXPECTED_OBJECT_OR_CLASS_NAME, Z_EXPECTED_OBJECT_OR_CLASS_NAME_OR_NULL, Z_EXPECTED_OBJECT_OR_STRING, Z_EXPECTED_OBJECT_OR_STRING_OR_NULL,
 Z_EXPECTED_LAST
} zend_expected_type;

__attribute__ ((visibility("default"))) void zend_wrong_parameters_none_error(void);
__attribute__ ((visibility("default"))) void zend_wrong_parameters_count_error(uint32_t min_num_args, uint32_t max_num_args);
__attribute__ ((visibility("default"))) void zend_wrong_parameter_error(int error_code, uint32_t num, char *name, zend_expected_type expected_type, zval *arg);
__attribute__ ((visibility("default"))) void zend_wrong_parameter_type_error(uint32_t num, zend_expected_type expected_type, zval *arg);
__attribute__ ((visibility("default"))) void zend_wrong_parameter_class_error(uint32_t num, const char *name, zval *arg);
__attribute__ ((visibility("default"))) void zend_wrong_parameter_class_or_null_error(uint32_t num, const char *name, zval *arg);
__attribute__ ((visibility("default"))) void zend_wrong_parameter_class_or_long_error(uint32_t num, const char *name, zval *arg);
__attribute__ ((visibility("default"))) void zend_wrong_parameter_class_or_long_or_null_error(uint32_t num, const char *name, zval *arg);
__attribute__ ((visibility("default"))) void zend_wrong_parameter_class_or_string_error(uint32_t num, const char *name, zval *arg);
__attribute__ ((visibility("default"))) void zend_wrong_parameter_class_or_string_or_null_error(uint32_t num, const char *name, zval *arg);
__attribute__ ((visibility("default"))) void zend_wrong_callback_error(uint32_t num, char *error);
__attribute__ ((visibility("default"))) void zend_unexpected_extra_named_error(void);
__attribute__ ((visibility("default"))) void zend_argument_error_variadic(zend_class_entry *error_ce, uint32_t arg_num, const char *format, va_list va);
__attribute__ ((visibility("default"))) void zend_argument_error(zend_class_entry *error_ce, uint32_t arg_num, const char *format, ...);
__attribute__ ((visibility("default"))) void zend_argument_type_error(uint32_t arg_num, const char *format, ...);
__attribute__ ((visibility("default"))) void zend_argument_value_error(uint32_t arg_num, const char *format, ...);
# 1874 "Zend/zend_API.h"
__attribute__ ((visibility("default"))) _Bool zend_parse_arg_class(zval *arg, zend_class_entry **pce, uint32_t num, _Bool check_null);
__attribute__ ((visibility("default"))) _Bool zend_parse_arg_bool_slow(zval *arg, zend_bool *dest);
__attribute__ ((visibility("default"))) _Bool zend_parse_arg_bool_weak(zval *arg, zend_bool *dest);
__attribute__ ((visibility("default"))) _Bool zend_parse_arg_long_slow(zval *arg, zend_long *dest);
__attribute__ ((visibility("default"))) _Bool zend_parse_arg_long_weak(zval *arg, zend_long *dest);
__attribute__ ((visibility("default"))) _Bool zend_parse_arg_double_slow(zval *arg, double *dest);
__attribute__ ((visibility("default"))) _Bool zend_parse_arg_double_weak(zval *arg, double *dest);
__attribute__ ((visibility("default"))) _Bool zend_parse_arg_str_slow(zval *arg, zend_string **dest);
__attribute__ ((visibility("default"))) _Bool zend_parse_arg_str_weak(zval *arg, zend_string **dest);
__attribute__ ((visibility("default"))) _Bool zend_parse_arg_number_slow(zval *arg, zval **dest);
__attribute__ ((visibility("default"))) _Bool zend_parse_arg_str_or_long_slow(zval *arg, zend_string **dest_str, zend_long *dest_long);

static inline __attribute__((always_inline)) _Bool zend_parse_arg_bool(zval *arg, zend_bool *dest, zend_bool *is_null, _Bool check_null)
{
 if (check_null) {
  *is_null = 0;
 }
 if (__builtin_expect(!!(zval_get_type(&(*(arg))) == 3), 1)) {
  *dest = 1;
 } else if (__builtin_expect(!!(zval_get_type(&(*(arg))) == 2), 1)) {
  *dest = 0;
 } else if (check_null && zval_get_type(&(*(arg))) == 1) {
  *is_null = 1;
  *dest = 0;
 } else {
  return zend_parse_arg_bool_slow(arg, dest);
 }
 return 1;
}

static inline __attribute__((always_inline)) _Bool zend_parse_arg_long(zval *arg, zend_long *dest, zend_bool *is_null, _Bool check_null)
{
 if (check_null) {
  *is_null = 0;
 }
 if (__builtin_expect(!!(zval_get_type(&(*(arg))) == 4), 1)) {
  *dest = (*(arg)).value.lval;
 } else if (check_null && zval_get_type(&(*(arg))) == 1) {
  *is_null = 1;
  *dest = 0;
 } else {
  return zend_parse_arg_long_slow(arg, dest);
 }
 return 1;
}

static inline __attribute__((always_inline)) _Bool zend_parse_arg_double(zval *arg, double *dest, zend_bool *is_null, _Bool check_null)
{
 if (check_null) {
  *is_null = 0;
 }
 if (__builtin_expect(!!(zval_get_type(&(*(arg))) == 5), 1)) {
  *dest = (*(arg)).value.dval;
 } else if (check_null && zval_get_type(&(*(arg))) == 1) {
  *is_null = 1;
  *dest = 0.0;
 } else {
  return zend_parse_arg_double_slow(arg, dest);
 }
 return 1;
}

static inline __attribute__((always_inline)) _Bool zend_parse_arg_number(zval *arg, zval **dest, _Bool check_null)
{
 if (__builtin_expect(!!(zval_get_type(&(*(arg))) == 4 || zval_get_type(&(*(arg))) == 5), 1)) {
  *dest = arg;
 } else if (check_null && __builtin_expect(!!(zval_get_type(&(*(arg))) == 1), 1)) {
  *dest = ((void*)0);
 } else {
  return zend_parse_arg_number_slow(arg, dest);
 }
 return 1;
}

static inline __attribute__((always_inline)) _Bool zend_parse_arg_str(zval *arg, zend_string **dest, _Bool check_null)
{
 if (__builtin_expect(!!(zval_get_type(&(*(arg))) == 6), 1)) {
  *dest = (*(arg)).value.str;
 } else if (check_null && zval_get_type(&(*(arg))) == 1) {
  *dest = ((void*)0);
 } else {
  return zend_parse_arg_str_slow(arg, dest);
 }
 return 1;
}

static inline __attribute__((always_inline)) _Bool zend_parse_arg_string(zval *arg, char **dest, size_t *dest_len, _Bool check_null)
{
 zend_string *str;

 if (!zend_parse_arg_str(arg, &str, check_null)) {
  return 0;
 }
 if (check_null && __builtin_expect(!!(!str), 0)) {
  *dest = ((void*)0);
  *dest_len = 0;
 } else {
  *dest = (str)->val;
  *dest_len = (str)->len;
 }
 return 1;
}

static inline __attribute__((always_inline)) _Bool zend_parse_arg_path_str(zval *arg, zend_string **dest, _Bool check_null)
{
 if (!zend_parse_arg_str(arg, dest, check_null) ||
     (*dest && __builtin_expect(!!((strlen((*dest)->val) != (size_t)((*dest)->len))), 0))) {
  return 0;
 }
 return 1;
}

static inline __attribute__((always_inline)) _Bool zend_parse_arg_path(zval *arg, char **dest, size_t *dest_len, _Bool check_null)
{
 zend_string *str;

 if (!zend_parse_arg_path_str(arg, &str, check_null)) {
  return 0;
 }
 if (check_null && __builtin_expect(!!(!str), 0)) {
  *dest = ((void*)0);
  *dest_len = 0;
 } else {
  *dest = (str)->val;
  *dest_len = (str)->len;
 }
 return 1;
}

static inline __attribute__((always_inline)) _Bool zend_parse_arg_iterable(zval *arg, zval **dest, _Bool check_null)
{
 if (__builtin_expect(!!(zend_is_iterable(arg)), 1)) {
  *dest = arg;
  return 1;
 }

 if (check_null && __builtin_expect(!!(zval_get_type(&(*(arg))) == 1), 1)) {
  *dest = ((void*)0);
  return 1;
 }

 return 0;
}

static inline __attribute__((always_inline)) _Bool zend_parse_arg_array(zval *arg, zval **dest, _Bool check_null, _Bool or_object)
{
 if (__builtin_expect(!!(zval_get_type(&(*(arg))) == 7), 1) ||
  (or_object && __builtin_expect(!!(zval_get_type(&(*(arg))) == 8), 1))) {
  *dest = arg;
 } else if (check_null && __builtin_expect(!!(zval_get_type(&(*(arg))) == 1), 1)) {
  *dest = ((void*)0);
 } else {
  return 0;
 }
 return 1;
}

static inline __attribute__((always_inline)) _Bool zend_parse_arg_array_ht(zval *arg, HashTable **dest, _Bool check_null, _Bool or_object, _Bool separate)
{
 if (__builtin_expect(!!(zval_get_type(&(*(arg))) == 7), 1)) {
  *dest = (*(arg)).value.arr;
 } else if (or_object && __builtin_expect(!!(zval_get_type(&(*(arg))) == 8), 1)) {
  zend_object *zobj = (*(arg)).value.obj;
  if (separate
   && zobj->properties
   && __builtin_expect(!!(zend_gc_refcount(&(zobj->properties)->gc) > 1), 0)) {
   if (__builtin_expect(!!(!(zval_gc_flags((zobj->properties)->gc.u.type_info) & (1<<6))), 1)) {
    zend_gc_delref(&(zobj->properties)->gc);
   }
   zobj->properties = zend_array_dup(zobj->properties);
  }
  *dest = zobj->handlers->get_properties(zobj);
 } else if (check_null && __builtin_expect(!!(zval_get_type(&(*(arg))) == 1), 1)) {
  *dest = ((void*)0);
 } else {
  return 0;
 }
 return 1;
}

static inline __attribute__((always_inline)) _Bool zend_parse_arg_array_ht_or_long(
 zval *arg, HashTable **dest_ht, zend_long *dest_long, zend_bool *is_null, _Bool allow_null
) {
 if (allow_null) {
  *is_null = 0;
 }

 if (__builtin_expect(!!(zval_get_type(&(*(arg))) == 7), 1)) {
  *dest_ht = (*(arg)).value.arr;
 } else if (__builtin_expect(!!(zval_get_type(&(*(arg))) == 4), 1)) {
  *dest_ht = ((void*)0);
  *dest_long = (*(arg)).value.lval;
 } else if (allow_null && __builtin_expect(!!(zval_get_type(&(*(arg))) == 1), 1)) {
  *dest_ht = ((void*)0);
  *is_null = 1;
 } else {
  *dest_ht = ((void*)0);
  return zend_parse_arg_long_slow(arg, dest_long);
 }

 return 1;
}

static inline __attribute__((always_inline)) _Bool zend_parse_arg_object(zval *arg, zval **dest, zend_class_entry *ce, _Bool check_null)
{
 if (__builtin_expect(!!(zval_get_type(&(*(arg))) == 8), 1) &&
     (!ce || __builtin_expect(!!(instanceof_function(((*(arg)).value.obj->ce), ce) != 0), 1))) {
  *dest = arg;
 } else if (check_null && __builtin_expect(!!(zval_get_type(&(*(arg))) == 1), 1)) {
  *dest = ((void*)0);
 } else {
  return 0;
 }
 return 1;
}

static inline __attribute__((always_inline)) _Bool zend_parse_arg_obj(zval *arg, zend_object **dest, zend_class_entry *ce, _Bool check_null)
{
 if (__builtin_expect(!!(zval_get_type(&(*(arg))) == 8), 1) &&
     (!ce || __builtin_expect(!!(instanceof_function(((*(arg)).value.obj->ce), ce) != 0), 1))) {
  *dest = (*(arg)).value.obj;
 } else if (check_null && __builtin_expect(!!(zval_get_type(&(*(arg))) == 1), 1)) {
  *dest = ((void*)0);
 } else {
  return 0;
 }
 return 1;
}

static inline __attribute__((always_inline)) _Bool zend_parse_arg_obj_or_long(
 zval *arg, zend_object **dest_obj, zend_class_entry *ce, zend_long *dest_long, zend_bool *is_null, _Bool allow_null
) {
 if (allow_null) {
  *is_null = 0;
 }

 if (__builtin_expect(!!(zval_get_type(&(*(arg))) == 8), 1) && __builtin_expect(!!(instanceof_function(((*(arg)).value.obj->ce), ce) != 0), 1)) {
  *dest_obj = (*(arg)).value.obj;
 } else if (__builtin_expect(!!(zval_get_type(&(*(arg))) == 4), 1)) {
  *dest_obj = ((void*)0);
  *dest_long = (*(arg)).value.lval;
 } else if (allow_null && __builtin_expect(!!(zval_get_type(&(*(arg))) == 1), 1)) {
  *dest_obj = ((void*)0);
  *is_null = 1;
 } else {
  *dest_obj = ((void*)0);
  return zend_parse_arg_long_slow(arg, dest_long);
 }

 return 1;
}

static inline __attribute__((always_inline)) _Bool zend_parse_arg_resource(zval *arg, zval **dest, _Bool check_null)
{
 if (__builtin_expect(!!(zval_get_type(&(*(arg))) == 9), 1)) {
  *dest = arg;
 } else if (check_null && __builtin_expect(!!(zval_get_type(&(*(arg))) == 1), 1)) {
  *dest = ((void*)0);
 } else {
  return 0;
 }
 return 1;
}

static inline __attribute__((always_inline)) _Bool zend_parse_arg_func(zval *arg, zend_fcall_info *dest_fci, zend_fcall_info_cache *dest_fcc, _Bool check_null, char **error)
{
 if (check_null && __builtin_expect(!!(zval_get_type(&(*(arg))) == 1), 0)) {
  dest_fci->size = 0;
  dest_fcc->function_handler = ((void*)0);
  *error = ((void*)0);
 } else if (__builtin_expect(!!(zend_fcall_info_init(arg, 0, dest_fci, dest_fcc, ((void*)0), error) != SUCCESS), 0)) {
  return 0;
 }



 zend_release_fcall_info_cache(dest_fcc);
 return 1;
}

static inline __attribute__((always_inline)) void zend_parse_arg_zval(zval *arg, zval **dest, _Bool check_null)
{
 *dest = (check_null &&
     (__builtin_expect(!!(zval_get_type(&(*(arg))) == 1), 0) ||
      (__builtin_expect(!!((zval_get_type(&(*(arg))) == 10)), 0) &&
       __builtin_expect(!!(zval_get_type(&(*(&(*(arg)).value.ref->val))) == 1), 0)))) ? ((void*)0) : arg;
}

static inline __attribute__((always_inline)) void zend_parse_arg_zval_deref(zval *arg, zval **dest, _Bool check_null)
{
 *dest = (check_null && __builtin_expect(!!(zval_get_type(&(*(arg))) == 1), 0)) ? ((void*)0) : arg;
}

static inline __attribute__((always_inline)) _Bool zend_parse_arg_array_ht_or_str(
  zval *arg, HashTable **dest_ht, zend_string **dest_str, _Bool allow_null)
{
 if (__builtin_expect(!!(zval_get_type(&(*(arg))) == 6), 1)) {
  *dest_ht = ((void*)0);
  *dest_str = (*(arg)).value.str;
 } else if (__builtin_expect(!!(zval_get_type(&(*(arg))) == 7), 1)) {
  *dest_ht = (*(arg)).value.arr;
  *dest_str = ((void*)0);
 } else if (allow_null && __builtin_expect(!!(zval_get_type(&(*(arg))) == 1), 1)) {
  *dest_ht = ((void*)0);
  *dest_str = ((void*)0);
 } else {
  *dest_ht = ((void*)0);
  return zend_parse_arg_str_slow(arg, dest_str);
 }
 return 1;
}

static inline __attribute__((always_inline)) _Bool zend_parse_arg_str_or_long(zval *arg, zend_string **dest_str, zend_long *dest_long,
 zend_bool *is_null, _Bool allow_null)
{
 if (allow_null) {
  *is_null = 0;
 }
 if (__builtin_expect(!!(zval_get_type(&(*(arg))) == 6), 1)) {
  *dest_str = (*(arg)).value.str;
 } else if (__builtin_expect(!!(zval_get_type(&(*(arg))) == 4), 1)) {
  *dest_str = ((void*)0);
  *dest_long = (*(arg)).value.lval;
 } else if (allow_null && __builtin_expect(!!(zval_get_type(&(*(arg))) == 1), 1)) {
  *dest_str = ((void*)0);
  *is_null = 1;
 } else {
  return zend_parse_arg_str_or_long_slow(arg, dest_str, dest_long);
 }
 return 1;
}

static inline __attribute__((always_inline)) _Bool zend_parse_arg_obj_or_class_name(
 zval *arg, zend_class_entry **destination, _Bool allow_null
) {
 if (__builtin_expect(!!(zval_get_type(&(*(arg))) == 6), 1)) {
  *destination = zend_lookup_class((*(arg)).value.str);

  return *destination != ((void*)0);
 } else if (__builtin_expect(!!(zval_get_type(&(*(arg))) == 8), 1)) {
  *destination = (*(arg)).value.obj->ce;
 } else if (allow_null && __builtin_expect(!!(zval_get_type(&(*(arg))) == 1), 1)) {
  *destination = ((void*)0);
 } else {
  return 0;
 }

 return 1;
}

static inline __attribute__((always_inline)) _Bool zend_parse_arg_obj_or_str(
 zval *arg, zend_object **destination_object, zend_class_entry *base_ce, zend_string **destination_string, _Bool allow_null
) {
 if (__builtin_expect(!!(zval_get_type(&(*(arg))) == 8), 1)) {
  if (!base_ce || __builtin_expect(!!(instanceof_function(((*(arg)).value.obj->ce), base_ce)), 1)) {
   *destination_object = (*(arg)).value.obj;
   *destination_string = ((void*)0);
   return 1;
  }
 }

 *destination_object = ((void*)0);
 return zend_parse_arg_str(arg, destination_string, allow_null);
}
# 12 "/root/pib_eval.c" 2


# 1 "Zend/zend_constants.h" 1
# 32 "Zend/zend_constants.h"
typedef struct _zend_constant {
 zval value;
 zend_string *name;
} zend_constant;
# 70 "Zend/zend_constants.h"
void clean_module_constants(int module_number);
void free_zend_constant(zval *zv);
void zend_startup_constants(void);
void zend_shutdown_constants(void);
void zend_register_standard_constants(void);
__attribute__ ((visibility("default"))) _Bool zend_verify_const_access(zend_class_constant *c, zend_class_entry *ce);
__attribute__ ((visibility("default"))) zval *zend_get_constant(zend_string *name);
__attribute__ ((visibility("default"))) zval *zend_get_constant_str(const char *name, size_t name_len);
__attribute__ ((visibility("default"))) zval *zend_get_constant_ex(zend_string *name, zend_class_entry *scope, uint32_t flags);
__attribute__ ((visibility("default"))) void zend_register_bool_constant(const char *name, size_t name_len, zend_bool bval, int flags, int module_number);
__attribute__ ((visibility("default"))) void zend_register_null_constant(const char *name, size_t name_len, int flags, int module_number);
__attribute__ ((visibility("default"))) void zend_register_long_constant(const char *name, size_t name_len, zend_long lval, int flags, int module_number);
__attribute__ ((visibility("default"))) void zend_register_double_constant(const char *name, size_t name_len, double dval, int flags, int module_number);
__attribute__ ((visibility("default"))) void zend_register_string_constant(const char *name, size_t name_len, const char *strval, int flags, int module_number);
__attribute__ ((visibility("default"))) void zend_register_stringl_constant(const char *name, size_t name_len, const char *strval, size_t strlen, int flags, int module_number);
__attribute__ ((visibility("default"))) zend_result zend_register_constant(zend_constant *c);




__attribute__ ((visibility("default"))) zend_constant *_zend_get_special_const(const char *name, size_t name_len);

static inline __attribute__((always_inline)) zend_constant *zend_get_special_const(
  const char *name, size_t name_len) {
 if (name_len == 4 || name_len == 5) {
  return _zend_get_special_const(name, name_len);
 }
 return ((void*)0);
}
# 15 "/root/pib_eval.c" 2



# 1 "Zend/zend_extensions.h" 1
# 49 "Zend/zend_extensions.h"
typedef struct _zend_extension_version_info {
 int zend_extension_api_no;
 char *build_id;
} zend_extension_version_info;



typedef struct _zend_extension zend_extension;


typedef int (*startup_func_t)(zend_extension *extension);
typedef void (*shutdown_func_t)(zend_extension *extension);
typedef void (*activate_func_t)(void);
typedef void (*deactivate_func_t)(void);

typedef void (*message_handler_func_t)(int message, void *arg);

typedef void (*op_array_handler_func_t)(zend_op_array *op_array);

typedef void (*statement_handler_func_t)(zend_execute_data *frame);
typedef void (*fcall_begin_handler_func_t)(zend_execute_data *frame);
typedef void (*fcall_end_handler_func_t)(zend_execute_data *frame);

typedef void (*op_array_ctor_func_t)(zend_op_array *op_array);
typedef void (*op_array_dtor_func_t)(zend_op_array *op_array);
typedef size_t (*op_array_persist_calc_func_t)(zend_op_array *op_array);
typedef size_t (*op_array_persist_func_t)(zend_op_array *op_array, void *mem);

struct _zend_extension {
 char *name;
 char *version;
 char *author;
 char *URL;
 char *copyright;

 startup_func_t startup;
 shutdown_func_t shutdown;
 activate_func_t activate;
 deactivate_func_t deactivate;

 message_handler_func_t message_handler;

 op_array_handler_func_t op_array_handler;

 statement_handler_func_t statement_handler;
 fcall_begin_handler_func_t fcall_begin_handler;
 fcall_end_handler_func_t fcall_end_handler;

 op_array_ctor_func_t op_array_ctor;
 op_array_dtor_func_t op_array_dtor;

 int (*api_no_check)(int api_no);
 int (*build_id_check)(const char* build_id);
 op_array_persist_calc_func_t op_array_persist_calc;
 op_array_persist_func_t op_array_persist;
 void *reserved5;
 void *reserved6;
 void *reserved7;
 void *reserved8;

 void * handle;
 int resource_number;
};


extern __attribute__ ((visibility("default"))) int zend_op_array_extension_handles;

__attribute__ ((visibility("default"))) int zend_get_resource_handle(const char *module_name);
__attribute__ ((visibility("default"))) int zend_get_op_array_extension_handle(const char *module_name);
__attribute__ ((visibility("default"))) int zend_get_op_array_extension_handles(const char *module_name, int handles);
__attribute__ ((visibility("default"))) void zend_extension_dispatch_message(int message, void *arg);
# 133 "Zend/zend_extensions.h"
__attribute__ ((visibility("default"))) extern zend_llist zend_extensions;
__attribute__ ((visibility("default"))) extern uint32_t zend_extension_flags;







void zend_extension_dtor(zend_extension *extension);
__attribute__ ((visibility("default"))) void zend_append_version_info(const zend_extension *extension);
void zend_startup_extensions_mechanism(void);
void zend_startup_extensions(void);
void zend_shutdown_extensions(void);


__attribute__ ((visibility("default"))) zend_result zend_load_extension(const char *path);
__attribute__ ((visibility("default"))) zend_result zend_load_extension_handle(void * handle, const char *path);
__attribute__ ((visibility("default"))) void zend_register_extension(zend_extension *new_extension, void * handle);
__attribute__ ((visibility("default"))) zend_extension *zend_get_extension(const char *extension_name);
__attribute__ ((visibility("default"))) size_t zend_extensions_op_array_persist_calc(zend_op_array *op_array);
__attribute__ ((visibility("default"))) size_t zend_extensions_op_array_persist(zend_op_array *op_array, void *mem);
# 19 "/root/pib_eval.c" 2

# 1 "Zend/zend_exceptions.h" 1
# 27 "Zend/zend_exceptions.h"
extern __attribute__ ((visibility("default"))) zend_class_entry *zend_ce_throwable;
extern __attribute__ ((visibility("default"))) zend_class_entry *zend_ce_exception;
extern __attribute__ ((visibility("default"))) zend_class_entry *zend_ce_error_exception;
extern __attribute__ ((visibility("default"))) zend_class_entry *zend_ce_error;
extern __attribute__ ((visibility("default"))) zend_class_entry *zend_ce_compile_error;
extern __attribute__ ((visibility("default"))) zend_class_entry *zend_ce_parse_error;
extern __attribute__ ((visibility("default"))) zend_class_entry *zend_ce_type_error;
extern __attribute__ ((visibility("default"))) zend_class_entry *zend_ce_argument_count_error;
extern __attribute__ ((visibility("default"))) zend_class_entry *zend_ce_value_error;
extern __attribute__ ((visibility("default"))) zend_class_entry *zend_ce_arithmetic_error;
extern __attribute__ ((visibility("default"))) zend_class_entry *zend_ce_division_by_zero_error;
extern __attribute__ ((visibility("default"))) zend_class_entry *zend_ce_unhandled_match_error;

__attribute__ ((visibility("default"))) void zend_exception_set_previous(zend_object *exception, zend_object *add_previous);
__attribute__ ((visibility("default"))) void zend_exception_save(void);
__attribute__ ((visibility("default"))) void zend_exception_restore(void);

__attribute__ ((visibility("default"))) void zend_throw_exception_internal(zend_object *exception);

void zend_register_default_exception(void);

__attribute__ ((visibility("default"))) zend_class_entry *zend_get_exception_base(zend_object *object);


__attribute__ ((visibility("default"))) zend_class_entry *zend_exception_get_default(void);


__attribute__ ((visibility("default"))) zend_class_entry *zend_get_error_exception(void);

__attribute__ ((visibility("default"))) void zend_register_default_classes(void);



__attribute__ ((visibility("default"))) zend_object *zend_throw_exception(zend_class_entry *exception_ce, const char *message, zend_long code);
__attribute__ ((visibility("default"))) zend_object *zend_throw_exception_ex(zend_class_entry *exception_ce, zend_long code, const char *format, ...) __attribute__ ((format(printf, 3, 4)));
__attribute__ ((visibility("default"))) void zend_throw_exception_object(zval *exception);
__attribute__ ((visibility("default"))) void zend_clear_exception(void);

__attribute__ ((visibility("default"))) zend_object *zend_throw_error_exception(zend_class_entry *exception_ce, zend_string *message, zend_long code, int severity);

extern __attribute__ ((visibility("default"))) void (*zend_throw_exception_hook)(zend_object *ex);


__attribute__ ((visibility("default"))) zend_result zend_exception_error(zend_object *exception, int severity);

__attribute__ ((visibility("default"))) void zend_throw_unwind_exit(void);
__attribute__ ((visibility("default"))) zend_bool zend_is_unwind_exit(zend_object *ex);



static inline __attribute__((always_inline)) void zend_rethrow_exception(zend_execute_data *execute_data)
{
 if (((execute_data)->opline)->opcode != 149) {
  (executor_globals.opline_before_exception) = ((execute_data)->opline);
  ((execute_data)->opline) = (executor_globals.exception_op);
 }
}
# 21 "/root/pib_eval.c" 2
# 1 "Zend/zend_closures.h" 1
# 29 "Zend/zend_closures.h"
void zend_register_closure_ce(void);
void zend_closure_bind_var(zval *closure_zv, zend_string *var_name, zval *var);
void zend_closure_bind_var_ex(zval *closure_zv, uint32_t offset, zval *val);

extern __attribute__ ((visibility("default"))) zend_class_entry *zend_ce_closure;

__attribute__ ((visibility("default"))) void zend_create_closure(zval *res, zend_function *op_array, zend_class_entry *scope, zend_class_entry *called_scope, zval *this_ptr);
__attribute__ ((visibility("default"))) void zend_create_fake_closure(zval *res, zend_function *op_array, zend_class_entry *scope, zend_class_entry *called_scope, zval *this_ptr);
__attribute__ ((visibility("default"))) zend_function *zend_get_closure_invoke_method(zend_object *obj);
__attribute__ ((visibility("default"))) const zend_function *zend_get_closure_method_def(zend_object *obj);
__attribute__ ((visibility("default"))) zval* zend_get_closure_this_ptr(zval *obj);
# 22 "/root/pib_eval.c" 2
# 1 "Zend/zend_generators.h" 1
# 25 "Zend/zend_generators.h"
extern __attribute__ ((visibility("default"))) zend_class_entry *zend_ce_generator;
extern __attribute__ ((visibility("default"))) zend_class_entry *zend_ce_ClosedGeneratorException;

typedef struct _zend_generator_node zend_generator_node;
typedef struct _zend_generator zend_generator;
# 39 "Zend/zend_generators.h"
struct _zend_generator_node {
 zend_generator *parent;
 uint32_t children;
 union {
  HashTable *ht;
  struct {
   zend_generator *leaf;
   zend_generator *child;
  } single;
 } child;


 union {
  zend_generator *leaf;
  zend_generator *root;
 } ptr;
};

struct _zend_generator {
 zend_object std;


 zend_execute_data *execute_data;


 zend_execute_data *frozen_call_stack;


 zval value;

 zval key;

 zval retval;

 zval *send_target;

 zend_long largest_used_integer_key;





 zval values;



 zend_generator_node node;


 zend_execute_data execute_fake;


 zend_uchar flags;
};

static const zend_uchar ZEND_GENERATOR_CURRENTLY_RUNNING = 0x1;
static const zend_uchar ZEND_GENERATOR_FORCED_CLOSE = 0x2;
static const zend_uchar ZEND_GENERATOR_AT_FIRST_YIELD = 0x4;
static const zend_uchar ZEND_GENERATOR_DO_INIT = 0x8;

void zend_register_generator_ce(void);
__attribute__ ((visibility("default"))) void zend_generator_close(zend_generator *generator, zend_bool finished_execution);
__attribute__ ((visibility("default"))) void zend_generator_resume(zend_generator *generator);

__attribute__ ((visibility("default"))) void zend_generator_restore_call_stack(zend_generator *generator);
__attribute__ ((visibility("default"))) zend_execute_data* zend_generator_freeze_call_stack(zend_execute_data *execute_data);

void zend_generator_yield_from(zend_generator *generator, zend_generator *from);
__attribute__ ((visibility("default"))) zend_execute_data *zend_generator_check_placeholder_frame(zend_execute_data *ptr);

__attribute__ ((visibility("default"))) zend_generator *zend_generator_update_current(zend_generator *generator);
__attribute__ ((visibility("default"))) zend_generator *zend_generator_update_root(zend_generator *generator);
static inline __attribute__((always_inline)) zend_generator *zend_generator_get_current(zend_generator *generator)
{
 if (__builtin_expect(!!(generator->node.parent == ((void*)0)), 1)) {

  return generator;
 }

 zend_generator *root = generator->node.ptr.root;
 if (!root) {
  root = zend_generator_update_root(generator);
 }

 if (__builtin_expect(!!(root->execute_data), 1)) {

  return root;
 }

 return zend_generator_update_current(generator);
}
# 23 "/root/pib_eval.c" 2
# 1 "Zend/zend_vm.h" 1
# 24 "Zend/zend_vm.h"
__attribute__ ((visibility("default"))) void zend_vm_set_opcode_handler(zend_op* opcode);
__attribute__ ((visibility("default"))) void zend_vm_set_opcode_handler_ex(zend_op* opcode, uint32_t op1_info, uint32_t op2_info, uint32_t res_info);
__attribute__ ((visibility("default"))) void zend_serialize_opcode_handler(zend_op *op);
__attribute__ ((visibility("default"))) void zend_deserialize_opcode_handler(zend_op *op);
__attribute__ ((visibility("default"))) const void* zend_get_opcode_handler_func(const zend_op *op);
__attribute__ ((visibility("default"))) const zend_op *zend_get_halt_op(void);
__attribute__ ((visibility("default"))) int zend_vm_call_opcode_handler(zend_execute_data *ex);
__attribute__ ((visibility("default"))) int zend_vm_kind(void);

void zend_vm_init(void);
void zend_vm_dtor(void);
# 24 "/root/pib_eval.c" 2

# 1 "Zend/zend_weakrefs.h" 1
# 22 "Zend/zend_weakrefs.h"
extern __attribute__ ((visibility("default"))) zend_class_entry *zend_ce_weakref;

void zend_register_weakref_ce(void);

void zend_weakrefs_init(void);
void zend_weakrefs_shutdown(void);

__attribute__ ((visibility("default"))) void zend_weakrefs_notify(zend_object *object);

__attribute__ ((visibility("default"))) zval *zend_weakrefs_hash_add(HashTable *ht, zend_object *key, zval *pData);
__attribute__ ((visibility("default"))) zend_result zend_weakrefs_hash_del(HashTable *ht, zend_object *key);
static inline __attribute__((always_inline)) void *zend_weakrefs_hash_add_ptr(HashTable *ht, zend_object *key, void *ptr) {
 zval tmp, *zv;
 do { (*(&tmp)).value.ptr = (ptr); (*(&tmp)).u1.type_info = 13; } while (0);
 if ((zv = zend_weakrefs_hash_add(ht, key, &tmp))) {
  return (*(zv)).value.ptr;
 } else {
  return ((void*)0);
 }
}
# 26 "/root/pib_eval.c" 2
# 1 "Zend/zend_inheritance.h" 1
# 27 "Zend/zend_inheritance.h"
__attribute__ ((visibility("default"))) void zend_do_implement_interface(zend_class_entry *ce, zend_class_entry *iface);
__attribute__ ((visibility("default"))) void zend_do_inheritance_ex(zend_class_entry *ce, zend_class_entry *parent_ce, zend_bool checked);




__attribute__ ((visibility("default"))) zend_result zend_do_link_class(zend_class_entry *ce, zend_string *lc_parent_name);

void zend_verify_abstract_class(zend_class_entry *ce);
void zend_build_properties_info_table(zend_class_entry *ce);
zend_bool zend_try_early_bind(zend_class_entry *ce, zend_class_entry *parent_ce, zend_string *lcname, zval *delayed_early_binding);
# 27 "/root/pib_eval.c" 2
# 1 "Zend/zend_observer.h" 1
# 28 "Zend/zend_observer.h"
extern __attribute__ ((visibility("default"))) int zend_observer_fcall_op_array_extension;
# 44 "Zend/zend_observer.h"
typedef void (*zend_observer_fcall_begin_handler)(zend_execute_data *execute_data);
typedef void (*zend_observer_fcall_end_handler)(zend_execute_data *execute_data, zval *retval);

typedef struct _zend_observer_fcall_handlers {
 zend_observer_fcall_begin_handler begin;
 zend_observer_fcall_end_handler end;
} zend_observer_fcall_handlers;


typedef zend_observer_fcall_handlers (*zend_observer_fcall_init)(zend_execute_data *execute_data);


__attribute__ ((visibility("default"))) void zend_observer_fcall_register(zend_observer_fcall_init);

__attribute__ ((visibility("default"))) void zend_observer_startup(void);
__attribute__ ((visibility("default"))) void zend_observer_post_startup(void);
__attribute__ ((visibility("default"))) void zend_observer_activate(void);
__attribute__ ((visibility("default"))) void zend_observer_deactivate(void);
__attribute__ ((visibility("default"))) void zend_observer_shutdown(void);

__attribute__ ((visibility("default"))) void zend_observer_fcall_begin(
 zend_execute_data *execute_data);

__attribute__ ((visibility("default"))) void zend_observer_generator_resume(
 zend_execute_data *execute_data);

__attribute__ ((visibility("default"))) void zend_observer_fcall_end(
 zend_execute_data *execute_data,
 zval *return_value);

__attribute__ ((visibility("default"))) void zend_observer_fcall_end_all(void);

typedef void (*zend_observer_error_cb)(int type, const char *error_filename, uint32_t error_lineno, zend_string *message);

__attribute__ ((visibility("default"))) void zend_observer_error_register(zend_observer_error_cb callback);
void zend_observer_error_notify(int type, const char *error_filename, uint32_t error_lineno, zend_string *message);
# 28 "/root/pib_eval.c" 2


# 1 "/emsdk_portable/fastcomp/emscripten/system/include/libc/sys/time.h" 1 3
# 11 "/emsdk_portable/fastcomp/emscripten/system/include/libc/sys/time.h" 3
int gettimeofday (struct timeval *restrict, void *restrict);
# 20 "/emsdk_portable/fastcomp/emscripten/system/include/libc/sys/time.h" 3
struct itimerval {
 struct timeval it_interval;
 struct timeval it_value;
};

int getitimer (int, struct itimerval *);
int setitimer (int, const struct itimerval *restrict, struct itimerval *restrict);
int utimes (const char *, const struct timeval [2]);




struct timezone {
 int tz_minuteswest;
 int tz_dsttime;
};
int futimes(int, const struct timeval [2]);
int futimesat(int, const char *, const struct timeval [2]);
int lutimes(const char *, const struct timeval [2]);
int settimeofday(const struct timeval *, const struct timezone *);
int adjtime (const struct timeval *, struct timeval *);
# 31 "/root/pib_eval.c" 2


# 1 "/emsdk_portable/fastcomp/emscripten/system/include/libc/unistd.h" 1 3
# 43 "/emsdk_portable/fastcomp/emscripten/system/include/libc/unistd.h" 3
# 1 "/emsdk_portable/fastcomp/emscripten/system/lib/libc/musl/arch/emscripten/bits/alltypes.h" 1 3
# 44 "/emsdk_portable/fastcomp/emscripten/system/include/libc/unistd.h" 2 3

int pipe(int [2]);
int pipe2(int [2], int);
int close(int);
int posix_close(int, int);
int dup(int);
int dup2(int, int);
int dup3(int, int, int);
off_t lseek(int, off_t, int);
int fsync(int);
int fdatasync(int);

ssize_t read(int, void *, size_t);
ssize_t write(int, const void *, size_t);
ssize_t pread(int, void *, size_t, off_t);
ssize_t pwrite(int, const void *, size_t, off_t);

int chown(const char *, uid_t, gid_t);
int fchown(int, uid_t, gid_t);
int lchown(const char *, uid_t, gid_t);
int fchownat(int, const char *, uid_t, gid_t, int);

int link(const char *, const char *);
int linkat(int, const char *, int, const char *, int);
int symlink(const char *, const char *);
int symlinkat(const char *, int, const char *);
ssize_t readlink(const char *restrict, char *restrict, size_t);
ssize_t readlinkat(int, const char *restrict, char *restrict, size_t);
int unlink(const char *);
int unlinkat(int, const char *, int);
int rmdir(const char *);
int truncate(const char *, off_t);
int ftruncate(int, off_t);






int access(const char *, int);
int faccessat(int, const char *, int, int);

int chdir(const char *);
int fchdir(int);
char *getcwd(char *, size_t);

unsigned alarm(unsigned);
unsigned sleep(unsigned);
int pause(void);

pid_t fork(void);
int execve(const char *, char *const [], char *const []);
int execv(const char *, char *const []);
int execle(const char *, const char *, ...);
int execl(const char *, const char *, ...);
int execvp(const char *, char *const []);
int execlp(const char *, const char *, ...);
int fexecve(int, char *const [], char *const []);
_Noreturn void _exit(int);

pid_t getpid(void);
pid_t getppid(void);
pid_t getpgrp(void);
pid_t getpgid(pid_t);
int setpgid(pid_t, pid_t);
pid_t setsid(void);
pid_t getsid(pid_t);
char *ttyname(int);
int ttyname_r(int, char *, size_t);
int isatty(int);
pid_t tcgetpgrp(int);
int tcsetpgrp(int, pid_t);

uid_t getuid(void);
uid_t geteuid(void);
gid_t getgid(void);
gid_t getegid(void);
int getgroups(int, gid_t []);
int setuid(uid_t);
int setreuid(uid_t, uid_t);
int seteuid(uid_t);
int setgid(gid_t);
int setregid(gid_t, gid_t);
int setegid(gid_t);

char *getlogin(void);
int getlogin_r(char *, size_t);
int gethostname(char *, size_t);
char *ctermid(char *);

int getopt(int, char * const [], const char *);
extern char *optarg;
extern int optind, opterr, optopt;

long pathconf(const char *, int);
long fpathconf(int, int);
long sysconf(int);
size_t confstr(int, char *, size_t);







int lockf(int, int, off_t);
long gethostid(void);
int nice(int);
void sync(void);
pid_t setpgrp(void);
char *crypt(const char *, const char *);
void encrypt(char *, int);
void swab(const void *restrict, void *restrict, ssize_t);




int usleep(unsigned);
unsigned ualarm(unsigned, unsigned);






int brk(void *);
void *sbrk(intptr_t);
pid_t vfork(void);
int vhangup(void);
int chroot(const char *);
int getpagesize(void);
int getdtablesize(void);
int sethostname(const char *, size_t);
int getdomainname(char *, size_t);
int setdomainname(const char *, size_t);
int setgroups(size_t, const gid_t *);
char *getpass(const char *);
int daemon(int, int);
void setusershell(void);
void endusershell(void);
char *getusershell(void);
int acct(const char *);

int execvpe(const char *, char *const [], char *const []);
int issetugid(void);



extern char **environ;
int setresuid(uid_t, uid_t, uid_t);
int setresgid(gid_t, gid_t, gid_t);
int getresuid(uid_t *, uid_t *, uid_t *);
int getresgid(gid_t *, gid_t *, gid_t *);
char *get_current_dir_name(void);
int syncfs(int);
int euidaccess(const char *, int);
int eaccess(const char *, int);
# 276 "/emsdk_portable/fastcomp/emscripten/system/include/libc/unistd.h" 3
# 1 "/emsdk_portable/fastcomp/emscripten/system/lib/libc/musl/arch/emscripten/bits/posix.h" 1 3
# 277 "/emsdk_portable/fastcomp/emscripten/system/include/libc/unistd.h" 2 3
# 34 "/root/pib_eval.c" 2
# 59 "/root/pib_eval.c"
__attribute__ ((visibility("default"))) void rc_dtor_func2(zend_refcounted *p);
static inline __attribute__((always_inline)) void i_zval_ptr_dtor2(zval *zval_ptr)
{
 if (((*(zval_ptr)).u1.v.type_flags != 0)) {
  zend_refcounted *ref = (*(zval_ptr)).value.counted;
  if (!zend_gc_delref(&(ref)->gc)) {
   rc_dtor_func2(ref);
  } else {
   gc_check_possible_root(ref);
  }
 }
}

__attribute__ ((visibility("default"))) void zval_ptr_dtor2(zval *zval_ptr)
{
 i_zval_ptr_dtor2(zval_ptr);
}





static inline __attribute__((always_inline)) void zend_string_release2(zend_string *s)
{
 if (!(zval_gc_flags((s)->gc.u.type_info) & (1<<6))) {
  if (zend_gc_delref(&(s)->gc) == 0) {
   ((zval_gc_flags((s)->gc.u.type_info) & (1<<7))?free(s):_efree((s) ));
  }
 }
}

static __attribute__((noinline)) void _zend_hash_iterators_remove2(HashTable *ht)
{
 HashTableIterator *iter = (executor_globals.ht_iterators);
 HashTableIterator *end = iter + (executor_globals.ht_iterators_used);

 while (iter != end) {
  if (iter->ht == ht) {
   iter->ht = ((HashTable *) (intptr_t) -1);
  }
  iter++;
 }
}

static inline __attribute__((always_inline)) void zend_hash_iterators_remove2(HashTable *ht)
{
 if (__builtin_expect(!!(((ht)->u.v.nIteratorsCount != 0)), 0)) {
  _zend_hash_iterators_remove2(ht);
 }
}
extern __attribute__ ((visibility("default"))) const HashTable zend_empty_array2;






__attribute__ ((visibility("default"))) void zend_hash_destroy2(HashTable *ht)
{
 Bucket *p, *end;

                  ;
                                    ;

 if (ht->nNumUsed) {

  end = p + ht->nNumUsed;
  if (ht->pDestructor) {
                                     ;

   if ((((ht)->u.flags & ((1<<2)|(1<<4))) != 0)) {
    if (((ht)->nNumUsed == (ht)->nNumOfElements)) {
     do {
      ht->pDestructor(&p->val);
     } while (++p != end);
    } else {
     do {
      if (__builtin_expect(!!(zval_get_type(&(p->val)) != 0), 1)) {
       ht->pDestructor(&p->val);
      }
     } while (++p != end);
    }
   } else if (((ht)->nNumUsed == (ht)->nNumOfElements)) {
    do {
     ht->pDestructor(&p->val);
     if (__builtin_expect(!!(p->key), 1)) {
      zend_string_release2(p->key);
     }
    } while (++p != end);
   } else {
    do {
     if (__builtin_expect(!!(zval_get_type(&(p->val)) != 0), 1)) {
      ht->pDestructor(&p->val);
      if (__builtin_expect(!!(p->key), 1)) {
       zend_string_release2(p->key);
      }
     }
    } while (++p != end);
   }

                                 ;
  } else {
   if (!(((ht)->u.flags & ((1<<2)|(1<<4))) != 0)) {
    do {
     if (__builtin_expect(!!(zval_get_type(&(p->val)) != 0), 1)) {
      if (__builtin_expect(!!(p->key), 1)) {
       zend_string_release2(p->key);
      }
     }
    } while (++p != end);
   }
  }
  zend_hash_iterators_remove2(ht);
 }
    else if (__builtin_expect(!!((ht)->u.flags & (1<<3)), 1)) {
      return;
    }
 free(((char*)((ht)->arData) - (((size_t)(uint32_t)-(int32_t)((ht)->nTableMask)) * sizeof(uint32_t))));
}


__attribute__ ((visibility("default"))) void zend_array_destroy2(HashTable *ht)
{
 Bucket *p, *end;

                  ;
                                    ;


 do { zend_refcounted *_p = (zend_refcounted*)(ht); if ((_p)->gc.u.type_info & 0xfffffc00) { gc_remove_from_buffer(_p); } } while (0);
 (ht)->gc.u.type_info = (1 | ((1<<4) << 0)) ;

 if (ht->nNumUsed) {

  if (__builtin_expect(!!(ht->pDestructor != zval_ptr_dtor2), 0))
  {
   printf(" test=%s", "abc");
  }

  p = ht->arData;
  end = p + ht->nNumUsed;
                                    ;

  if ((((ht)->u.flags & ((1<<2)|(1<<4))) != 0)) {
   do {
    i_zval_ptr_dtor2(&p->val);
   } while (++p != end);
  } else if (((ht)->nNumUsed == (ht)->nNumOfElements)) {
   do {
    i_zval_ptr_dtor2(&p->val);
    if (__builtin_expect(!!(p->key), 1)) {
     zend_string_release_ex(p->key, 0);
    }
   } while (++p != end);
  } else {
   do {
    if (__builtin_expect(!!(zval_get_type(&(p->val)) != 0), 1)) {
     i_zval_ptr_dtor2(&p->val);
     if (__builtin_expect(!!(p->key), 1)) {
      zend_string_release_ex(p->key, 0);
     }
    }
   } while (++p != end);
  }
 }
 else if (__builtin_expect(!!((ht)->u.flags & (1<<3)), 1)) {
  goto free_ht;
 }
                               ;
 _efree((((char*)((ht)->arData) - (((size_t)(uint32_t)-(int32_t)((ht)->nTableMask)) * sizeof(uint32_t)))) );
free_ht:
 zend_hash_iterators_remove2(ht);

}


static void zend_reference_destroy2(zend_reference *ref);
static void zend_empty_destroy2(zend_reference *ref);
static inline __attribute__((always_inline)) void zval_ptr_dtor_nogc2(zval *zval_ptr);

typedef void ( *zend_rc_dtor_func_t2)(zend_refcounted *p);

__attribute__ ((visibility("default"))) void zend_ast_destroy2(zend_ast *ast)
{
tail_call:
 if (!ast) {
  return;
 }

 if (__builtin_expect(!!(ast->kind >= ZEND_AST_VAR), 1)) {
  uint32_t i, children = zend_ast_get_num_children(ast);

  for (i = 1; i < children; i++) {
   zend_ast_destroy2(ast->child[i]);
  }
  ast = ast->child[0];
  goto tail_call;
 } else if (__builtin_expect(!!(ast->kind == ZEND_AST_ZVAL), 1)) {
  zval_ptr_dtor_nogc2(zend_ast_get_zval(ast));
 } else if (__builtin_expect(!!(zend_ast_is_list(ast)), 1)) {
  zend_ast_list *list = zend_ast_get_list(ast);
  if (list->children) {
   uint32_t i;

   for (i = 1; i < list->children; i++) {
    zend_ast_destroy2(list->child[i]);
   }
   ast = list->child[0];
   goto tail_call;
  }
 } else if (__builtin_expect(!!(ast->kind == ZEND_AST_CONSTANT), 1)) {
  zend_string_release_ex(zend_ast_get_constant_name(ast), 0);
 } else if (__builtin_expect(!!(ast->kind >= ZEND_AST_FUNC_DECL), 1)) {
  zend_ast_decl *decl = (zend_ast_decl *) ast;

  if (decl->name) {
      zend_string_release_ex(decl->name, 0);
  }
  if (decl->doc_comment) {
   zend_string_release_ex(decl->doc_comment, 0);
  }
  zend_ast_destroy2(decl->child[0]);
  zend_ast_destroy2(decl->child[1]);
  zend_ast_destroy2(decl->child[2]);
  zend_ast_destroy2(decl->child[3]);
  ast = decl->child[4];
  goto tail_call;
 }
}


__attribute__ ((visibility("default"))) void zend_ast_ref_destroy2(zend_ast_ref *ast)
{
 zend_ast_destroy2(((zend_ast*)(((char*)ast) + sizeof(zend_ast_ref))));
 _efree((ast) );
}

zend_result zend_call_function2(zend_fcall_info *fci, zend_fcall_info_cache *fci_cache);

__attribute__ ((visibility("default"))) void zend_call_known_function2(
  zend_function *fn, zend_object *object, zend_class_entry *called_scope, zval *retval_ptr,
  uint32_t param_count, zval *params, HashTable *named_params)
{
 zval retval;
 zend_fcall_info fci;
 zend_fcall_info_cache fcic;

 do { if (__builtin_expect(!(fn && "zend_function must be passed!"), 0)) __builtin_unreachable(); } while (0);

 fci.size = sizeof(fci);
 fci.object = object;
 fci.retval = retval_ptr ? retval_ptr : &retval;
 fci.param_count = param_count;
 fci.params = params;
 fci.named_params = named_params;
 do { (*(&fci.function_name)).u1.type_info = 0; } while (0);

 fcic.function_handler = fn;
 fcic.object = object;
 fcic.called_scope = called_scope;

 zend_result result = zend_call_function2(&fci, &fcic);
 if (__builtin_expect(!!(result == FAILURE), 0)) {
  if (!(executor_globals.exception)) {
   zend_error_noreturn((1<<4L), "Couldn't execute method %s%s%s",
    fn->common.scope ? (fn->common.scope->name)->val : "",
    fn->common.scope ? "::" : "", (fn->common.function_name)->val);
  }
 }

 if (!retval_ptr) {
  zval_ptr_dtor2(&retval);
 }
}


static inline __attribute__((always_inline)) void zend_call_known_instance_method2(
  zend_function *fn, zend_object *object, zval *retval_ptr,
  uint32_t param_count, zval *params)
{
 zend_call_known_function2(fn, object, object->ce, retval_ptr, param_count, params, ((void*)0));
}

static inline __attribute__((always_inline)) void zend_call_known_instance_method_with_0_params2(
  zend_function *fn, zend_object *object, zval *retval_ptr)
{
 zend_call_known_instance_method2(fn, object, retval_ptr, 0, ((void*)0));
}


static inline zend_class_entry *i_get_exception_base2(zend_object *object)
{
 return instanceof_function(object->ce, zend_ce_exception) ? zend_ce_exception : zend_ce_error;
}
void zend_exception_set_previous2(zend_object *exception, zend_object *add_previous)
{
    zval *previous, *ancestor, *ex;
 zval pv, zv, rv;
 zend_class_entry *base_ce;

 if (!exception || !add_previous) {
  return;
 }

 if (exception == add_previous || zend_is_unwind_exit(add_previous)) {

  return;
 }

 do { if (__builtin_expect(!(instanceof_function(add_previous->ce, zend_ce_throwable) && "Previous execption must implement Throwable"), 0)) __builtin_unreachable(); } while (0);


 do { zval *__z = (&pv); (*(__z)).value.obj = (add_previous); (*(__z)).u1.type_info = (8 | ((1<<0) << 8) | ((1<<1) << 8)); } while (0);
 do { zval *__z = (&zv); (*(__z)).value.obj = (exception); (*(__z)).u1.type_info = (8 | ((1<<0) << 8) | ((1<<1) << 8)); } while (0);
 ex = &zv;
 do {
  ancestor = zend_read_property_ex(i_get_exception_base2(add_previous), add_previous, zend_known_strings[ZEND_STR_PREVIOUS], 1, &rv);
  while (zval_get_type(&(*(ancestor))) == 8) {
   if ((*(ancestor)).value.obj == (*(ex)).value.obj) {

    return;
   }
   ancestor = zend_read_property_ex(i_get_exception_base2((*(ancestor)).value.obj), (*(ancestor)).value.obj, zend_known_strings[ZEND_STR_PREVIOUS], 1, &rv);
  }
  base_ce = i_get_exception_base2((*(ex)).value.obj);
  previous = zend_read_property_ex(base_ce, (*(ex)).value.obj, zend_known_strings[ZEND_STR_PREVIOUS], 1, &rv);
  if (zval_get_type(&(*(previous))) == 1) {
   zend_update_property_ex(base_ce, (*(ex)).value.obj, zend_known_strings[ZEND_STR_PREVIOUS], &pv);
   zend_gc_delref(&(add_previous)->gc);
   return;
  }
  ex = previous;
 } while ((*(ex)).value.obj != add_previous);
}
__attribute__ ((visibility("default"))) void zend_objects_destroy_object2(zend_object *object)
{
 zend_function *destructor = object->ce->destructor;

 if (destructor) {
  zend_object *old_exception;
  if (destructor->op_array.fn_flags & ((1 << 2)|(1 << 1))) {
   if (destructor->op_array.fn_flags & (1 << 2)) {


    if ((executor_globals.current_execute_data)) {
     zend_class_entry *scope = zend_get_executed_scope();

     if (object->ce != scope) {
      zend_throw_error(((void*)0),
       "Call to private %s::__destruct() from %s%s",
       (object->ce->name)->val,
       scope ? "scope " : "global scope",
       scope ? (scope->name)->val : ""
      );
      return;
     }
    } else {
     zend_error((1<<1L),
      "Call to private %s::__destruct() from global scope during shutdown ignored",
      (object->ce->name)->val);
     return;
    }
   } else {


    if ((executor_globals.current_execute_data)) {
     zend_class_entry *scope = zend_get_executed_scope();

     if (!zend_check_protected(((destructor)->common.prototype ? (destructor)->common.prototype->common.scope : (destructor)->common.scope), scope))
     {
      zend_throw_error(((void*)0),
       "Call to protected %s::__destruct() from %s%s",
       (object->ce->name)->val,
       scope ? "scope " : "global scope",
       scope ? (scope->name)->val : ""
      );
      return;
     }
    } else {
     zend_error((1<<1L),
      "Call to protected %s::__destruct() from global scope during shutdown ignored",
      (object->ce->name)->val);
     return;
    }
   }
  }

  zend_gc_addref(&(object)->gc);





  old_exception = ((void*)0);
  if ((executor_globals.exception)) {
   if ((executor_globals.exception) == object) {
    zend_error_noreturn((1<<4L), "Attempt to destruct pending exception");
   } else {
    old_exception = (executor_globals.exception);
    (executor_globals.exception) = ((void*)0);
   }
  }

  zend_call_known_instance_method_with_0_params2(destructor, object, ((void*)0));

  if (old_exception) {
   if ((executor_globals.exception)) {
    zend_exception_set_previous2((executor_globals.exception), old_exception);
   } else {
    (executor_globals.exception) = old_exception;
   }
  }

 }
}

__attribute__ ((visibility("default"))) void zend_objects_store_del2(zend_object *object)
{
 do { if (__builtin_expect(!(zend_gc_refcount(&(object)->gc) == 0), 0)) __builtin_unreachable(); } while (0);


 if (__builtin_expect(!!(zval_gc_type((object)->gc.u.type_info) == 1), 0)) {
  return;
 }





 if (!(zval_gc_flags((object)->gc.u.type_info) & (1<<8))) {
  do { (object)->gc.u.type_info |= ((1<<8)) << 0; } while (0);

  if (object->handlers->dtor_obj != zend_objects_destroy_object2
    || object->ce->destructor) {
            printf(" test=%s", "abc");
   zend_gc_set_refcount(&(object)->gc, 1);
   object->handlers->dtor_obj(object);
   zend_gc_delref(&(object)->gc);
  }
 }

 if (zend_gc_refcount(&(object)->gc) == 0) {
  uint32_t handle = object->handle;
  void *ptr;

  do { if (__builtin_expect(!((executor_globals.objects_store).object_buckets != ((void*)0)), 0)) __builtin_unreachable(); } while (0);
  do { if (__builtin_expect(!((!(((zend_uintptr_t)((executor_globals.objects_store).object_buckets[handle])) & (1<<0)))), 0)) __builtin_unreachable(); } while (0);
  (executor_globals.objects_store).object_buckets[handle] = ((zend_object*)((((zend_uintptr_t)(object)) | (1<<0))));
  if (!(zval_gc_flags((object)->gc.u.type_info) & (1<<9))) {
   do { (object)->gc.u.type_info |= ((1<<9)) << 0; } while (0);
   zend_gc_set_refcount(&(object)->gc, 1);
   object->handlers->free_obj(object);
  }
  ptr = ((char*)object) - object->handlers->offset;
  do { zend_refcounted *_p = (zend_refcounted*)(object); if ((_p)->gc.u.type_info & 0xfffffc00) { gc_remove_from_buffer(_p); } } while (0);
  _efree((ptr) );
  do { do { ((executor_globals.objects_store).object_buckets[(handle)]) = (zend_object*)((((zend_uintptr_t)((executor_globals.objects_store).free_list_head)) << 1) | (1<<0)); } while (0); (executor_globals.objects_store).free_list_head = (handle); } while (0);
 }
}

__attribute__ ((visibility("default"))) void zend_list_free2(zend_resource *res)
{
 do { if (__builtin_expect(!(zend_gc_refcount(&(res)->gc) == 0), 0)) __builtin_unreachable(); } while (0);
 zend_hash_index_del(&(executor_globals.regular_list), res->handle);
}

static void zend_reference_destroy2(zend_reference *ref)
{
 do { if (__builtin_expect(!(!((ref)->sources.ptr != ((void*)0))), 0)) __builtin_unreachable(); } while (0);
 i_zval_ptr_dtor2(&ref->val);
 do { if (__builtin_constant_p(sizeof(zend_reference))) { if (sizeof(zend_reference) <= 8) { _efree_8(ref); } else if (sizeof(zend_reference) <= 16) { _efree_16(ref); } else if (sizeof(zend_reference) <= 24) { _efree_24(ref); } else if (sizeof(zend_reference) <= 32) { _efree_32(ref); } else if (sizeof(zend_reference) <= 40) { _efree_40(ref); } else if (sizeof(zend_reference) <= 48) { _efree_48(ref); } else if (sizeof(zend_reference) <= 56) { _efree_56(ref); } else if (sizeof(zend_reference) <= 64) { _efree_64(ref); } else if (sizeof(zend_reference) <= 80) { _efree_80(ref); } else if (sizeof(zend_reference) <= 96) { _efree_96(ref); } else if (sizeof(zend_reference) <= 112) { _efree_112(ref); } else if (sizeof(zend_reference) <= 128) { _efree_128(ref); } else if (sizeof(zend_reference) <= 160) { _efree_160(ref); } else if (sizeof(zend_reference) <= 192) { _efree_192(ref); } else if (sizeof(zend_reference) <= 224) { _efree_224(ref); } else if (sizeof(zend_reference) <= 256) { _efree_256(ref); } else if (sizeof(zend_reference) <= 320) { _efree_320(ref); } else if (sizeof(zend_reference) <= 384) { _efree_384(ref); } else if (sizeof(zend_reference) <= 448) { _efree_448(ref); } else if (sizeof(zend_reference) <= 512) { _efree_512(ref); } else if (sizeof(zend_reference) <= 640) { _efree_640(ref); } else if (sizeof(zend_reference) <= 768) { _efree_768(ref); } else if (sizeof(zend_reference) <= 896) { _efree_896(ref); } else if (sizeof(zend_reference) <= 1024) { _efree_1024(ref); } else if (sizeof(zend_reference) <= 1280) { _efree_1280(ref); } else if (sizeof(zend_reference) <= 1536) { _efree_1536(ref); } else if (sizeof(zend_reference) <= 1792) { _efree_1792(ref); } else if (sizeof(zend_reference) <= 2048) { _efree_2048(ref); } else if (sizeof(zend_reference) <= 2560) { _efree_2560(ref); } else if (sizeof(zend_reference) <= 3072) { _efree_3072(ref); } else if (sizeof(zend_reference) <= (((size_t) (2 * 1024 * 1024)) - ((4 * 1024) * (1)))) { _efree_large(ref, sizeof(zend_reference)); } else { _efree_huge(ref, sizeof(zend_reference)); } } else { _efree(ref); } } while (0);
}

static const zend_rc_dtor_func_t2 zend_rc_dtor_func2[] = {
                       (zend_rc_dtor_func_t2)zend_empty_destroy2,
                       (zend_rc_dtor_func_t2)zend_empty_destroy2,
                       (zend_rc_dtor_func_t2)zend_empty_destroy2,
                       (zend_rc_dtor_func_t2)zend_empty_destroy2,
                       (zend_rc_dtor_func_t2)zend_empty_destroy2,
                       (zend_rc_dtor_func_t2)zend_empty_destroy2,
                       (zend_rc_dtor_func_t2)_efree,
                       (zend_rc_dtor_func_t2)zend_array_destroy2,
                       (zend_rc_dtor_func_t2)zend_objects_store_del2,
                       (zend_rc_dtor_func_t2)zend_list_free2,
                       (zend_rc_dtor_func_t2)zend_reference_destroy2,
                       (zend_rc_dtor_func_t2)zend_ast_ref_destroy2
};

__attribute__ ((visibility("default"))) void rc_dtor_func2(zend_refcounted *p)
{
 do { if (__builtin_expect(!(zval_gc_type((p)->gc.u.type_info) <= 11), 0)) __builtin_unreachable(); } while (0);
 zend_rc_dtor_func2[zval_gc_type((p)->gc.u.type_info)](p);
}

static inline __attribute__((always_inline)) void zval_ptr_dtor_nogc2(zval *zval_ptr)
{
 if (((*(zval_ptr)).u1.v.type_flags != 0) && !zval_delref_p(zval_ptr)) {
  rc_dtor_func2((*(zval_ptr)).value.counted);
 }
}

static inline __attribute__((always_inline)) void zend_vm_stack_free_args2(zend_execute_data *call)
{
 uint32_t num_args = (call)->This.u2.num_args;

 if (__builtin_expect(!!(num_args > 0), 1)) {
  zval *p = (((zval*)(call)) + (((int)(((((sizeof(zend_execute_data)) + 8 - 1) & ~(8 - 1)) + (((sizeof(zval)) + 8 - 1) & ~(8 - 1)) - 1) / (((sizeof(zval)) + 8 - 1) & ~(8 - 1)))) + ((int)(((int)(1)) - 1))));

  do {
   zval_ptr_dtor_nogc2(p);
   p++;
  } while (--num_args);
 }
}

__attribute__ ((visibility("default"))) zend_bool zend_is_callable_at_frame2(
  zval *callable, zend_object *object, zend_execute_data *frame,
  uint32_t check_flags, zend_fcall_info_cache *fcc, char **error);

__attribute__ ((visibility("default"))) zend_bool zend_is_callable_ex2(zval *callable, zend_object *object, uint32_t check_flags, zend_string **callable_name, zend_fcall_info_cache *fcc, char **error)
{

 zend_execute_data *frame = (executor_globals.current_execute_data);
 while (frame && (!frame->func || !((frame->func->type) != 1))) {
  frame = frame->prev_execute_data;
 }

 zend_bool ret = zend_is_callable_at_frame2(callable, object, frame, check_flags, fcc, error);
 if (callable_name) {
  *callable_name = zend_get_callable_name_ex(callable, object);
 }
 return ret;
}

static inline __attribute__((always_inline)) void init_func_run_time_cache2_i(zend_op_array *op_array)
{
 void **run_time_cache;

 do { if (__builtin_expect(!((*((((uintptr_t)(op_array)->run_time_cache__ptr) & 1L) ? ((void**)((char*)(compiler_globals.map_ptr_base) + (uintptr_t)(op_array)->run_time_cache__ptr)) : ((void**)((op_array)->run_time_cache__ptr)))) == ((void*)0)), 0)) __builtin_unreachable(); } while (0);
 run_time_cache = zend_arena_alloc(&(compiler_globals.arena), op_array->cache_size);
 memset(run_time_cache, 0, op_array->cache_size);
 do { void **__p = (void**)(op_array->run_time_cache__ptr); if ((((uintptr_t)op_array->run_time_cache__ptr) & 1L)) { __p = ((void**)((char*)(compiler_globals.map_ptr_base) + (uintptr_t)op_array->run_time_cache__ptr)); } *__p = (run_time_cache); } while (0);
}


static __attribute__((noinline)) void init_func_run_time_cache2(zend_op_array *op_array)
{
 init_func_run_time_cache2_i(op_array);
}

static zend_execute_data *start_fake_frame2(zend_execute_data *call, const zend_op *opline) {
 zend_execute_data *old_prev_execute_data = call->prev_execute_data;
 call->prev_execute_data = (executor_globals.current_execute_data);
 call->opline = opline;
 (executor_globals.current_execute_data) = call;
 return old_prev_execute_data;
}

static void end_fake_frame2(zend_execute_data *call, zend_execute_data *old_prev_execute_data) {
 zend_execute_data *prev_execute_data = call->prev_execute_data;
 (executor_globals.current_execute_data) = prev_execute_data;
 call->prev_execute_data = old_prev_execute_data;
 if (__builtin_expect(!!((executor_globals.exception)), 0) && ((prev_execute_data->func->common.type) != 1)) {
  zend_rethrow_exception(prev_execute_data);
 }
}


static zend_string *try_parse_string2(const char *str, size_t len, char quote) {
 if (len == 0) {
  return zend_empty_string;
 }

 for (size_t i = 0; i < len; i++) {
  if (str[i] == '\\' || str[i] == quote) {
   return ((void*)0);
  }
 }
 return zend_string_init(str, len, 0);
}


static inline __attribute__((always_inline)) uint32_t zval_gc_flags2(uint32_t gc_type_info) {
 return (gc_type_info >> 0) & (0x000003f0 >> 0);
}

__attribute__ ((visibility("default"))) zend_result zend_get_default_from_internal_arg_info2(
  zval *default_value_zval, zend_internal_arg_info *arg_info)
{
 const char *default_value = arg_info->default_value;
 if (!default_value) {
  return FAILURE;
 }


 size_t default_value_len = strlen(default_value);
 zend_ulong lval;
 if (default_value_len == sizeof("null")-1
   && !memcmp(default_value, "null", sizeof("null")-1)) {
  do { (*(default_value_zval)).u1.type_info = 1; } while (0);
  return SUCCESS;
 } else if (default_value_len == sizeof("true")-1
   && !memcmp(default_value, "true", sizeof("true")-1)) {
  do { (*(default_value_zval)).u1.type_info = 3; } while (0);
  return SUCCESS;
 } else if (default_value_len == sizeof("false")-1
   && !memcmp(default_value, "false", sizeof("false")-1)) {
  do { (*(default_value_zval)).u1.type_info = 2; } while (0);
  return SUCCESS;
 } else if (default_value_len >= 2
   && (default_value[0] == '\'' || default_value[0] == '"')
   && default_value[default_value_len - 1] == default_value[0]) {
  zend_string *str = try_parse_string2(
   default_value + 1, default_value_len - 2, default_value[0]);
  if (str) {
   do { zval *__z = (default_value_zval); zend_string *__s = (str); (*(__z)).value.str = __s; (*(__z)).u1.type_info = (zval_gc_flags((__s)->gc.u.type_info) & (1<<6)) ? 6 : (6 | ((1<<0) << 8)); } while (0);
   return SUCCESS;
  }
 } else if (default_value_len == sizeof("[]")-1
   && !memcmp(default_value, "[]", sizeof("[]")-1)) {
  do { zval *__z = (default_value_zval); (*(__z)).value.arr = (zend_array*)&zend_empty_array2; (*(__z)).u1.type_info = 7; } while (0);

  return SUCCESS;
 } else if (_zend_handle_numeric_str(default_value, default_value_len, &lval)) {
  do { zval *__z = (default_value_zval); (*(__z)).value.lval = lval; (*(__z)).u1.type_info = 4; } while (0);
  return SUCCESS;
 }




 return SUCCESS;
}

static zend_result zend_ast_add_array_element(zval *result, zval *offset, zval *expr)
{
 switch (zval_get_type(&(*(offset)))) {
  case 0:
   if (!zend_hash_next_index_insert((*(result)).value.arr, expr)) {
    zend_throw_error(((void*)0),
     "Cannot add element to the array as the next element is already occupied");
    return FAILURE;
   }
   break;
  case 6:
   zend_symtable_update((*(result)).value.arr, (*(offset)).value.str, expr);
   zval_ptr_dtor_str(offset);
   break;
  case 1:
   zend_symtable_update((*(result)).value.arr, zend_empty_string, expr);
   break;
  case 4:
   zend_hash_index_update((*(result)).value.arr, (*(offset)).value.lval, expr);
   break;
  case 2:
   zend_hash_index_update((*(result)).value.arr, 0, expr);
   break;
  case 3:
   zend_hash_index_update((*(result)).value.arr, 1, expr);
   break;
  case 5:
   zend_hash_index_update((*(result)).value.arr, zend_dval_to_lval((*(offset)).value.dval), expr);
   break;
  case 9:
   zend_error((1<<1L), "Resource ID#%d used as offset, casting to integer (%d)", (*offset).value.res->handle, (*offset).value.res->handle);
   zend_hash_index_update((*(result)).value.arr, (*offset).value.res->handle, expr);
   break;
  default:
   zend_type_error("Illegal offset type");
   return FAILURE;
  }
 return SUCCESS;
}

static zend_result zend_ast_add_unpacked_element(zval *result, zval *expr) {
 if (__builtin_expect(!!(zval_get_type(&(*(expr))) == 7), 1)) {
  HashTable *ht = (*(expr)).value.arr;
  zval *val;
  zend_string *key;

  do { HashTable *__ht = (ht); Bucket *_p = __ht->arData; Bucket *_end = _p + __ht->nNumUsed; for (; _p != _end; _p++) { zval *_z = &_p->val; if (0 && zval_get_type(&(*(_z))) == 12) { _z = (*(_z)).value.zv; } if (__builtin_expect(!!(zval_get_type(&(*(_z))) == 0), 0)) continue;; key = _p->key; val = _z; {
   if (key) {
    zend_throw_error(((void*)0), "Cannot unpack array with string keys");
    return FAILURE;
   } else {
    if (!zend_hash_next_index_insert((*(result)).value.arr, val)) {
     zend_throw_error(((void*)0),
      "Cannot add element to the array as the next element is already occupied");
     return FAILURE;
    }
    do { if (((*((val))).u1.v.type_flags != 0)) { zval_addref_p((val)); } } while (0);
   }
  } } } while (0);
  return SUCCESS;
 }


 zend_throw_error(((void*)0), "Only arrays and Traversables can be unpacked");
 return FAILURE;
}


__attribute__ ((visibility("default"))) zval* zend_hash_add_empty_element2(HashTable *ht, zend_string *key)
{
 zval dummy;

 do { (*(&dummy)).u1.type_info = 1; } while (0);
 return zend_hash_add(ht, key, &dummy);
}

__attribute__ ((visibility("default"))) extern zend_string *zend_empty_string2;
__attribute__ ((visibility("default"))) extern zend_string *zend_one_char_string2[256];
__attribute__ ((visibility("default"))) extern zend_string **zend_known_strings2;





__attribute__ ((visibility("default"))) zend_result zend_ast_evaluate2(zval *result, zend_ast *ast, zend_class_entry *scope)
{
 return SUCCESS;
}

__attribute__ ((visibility("default"))) zend_result zend_handle_undef_args2(zend_execute_data *call) {
 zend_function *fbc = call->func;
 if (fbc->type == 2) {
  zend_op_array *op_array = &fbc->op_array;
  uint32_t num_args = (call)->This.u2.num_args;
  for (uint32_t i = 0; i < num_args; i++) {
   zval *arg = (((zval*)(call)) + (((int)(((((sizeof(zend_execute_data)) + 8 - 1) & ~(8 - 1)) + (((sizeof(zval)) + 8 - 1) & ~(8 - 1)) - 1) / (((sizeof(zval)) + 8 - 1) & ~(8 - 1)))) + ((int)(i))));
   if (!(zval_get_type(&(*(arg))) == 0)) {
    continue;
   }

   zend_op *opline = &op_array->opcodes[i];
   if (__builtin_expect(!!(opline->opcode == 64), 1)) {
    zval *default_value = (opline->op2).zv;
    if (((*(default_value)).u1.type_info & 0xff) == 11) {
     if (__builtin_expect(!!(!(*((((uintptr_t)(op_array)->run_time_cache__ptr) & 1L) ? ((void**)((char*)(compiler_globals.map_ptr_base) + (uintptr_t)(op_array)->run_time_cache__ptr)) : ((void**)((op_array)->run_time_cache__ptr))))), 0)) {
      init_func_run_time_cache2(op_array);
     }

     void *run_time_cache = (*((((uintptr_t)(op_array)->run_time_cache__ptr) & 1L) ? ((void**)((char*)(compiler_globals.map_ptr_base) + (uintptr_t)(op_array)->run_time_cache__ptr)) : ((void**)((op_array)->run_time_cache__ptr))));
     zval *cache_val =
      (zval *) ((char *) run_time_cache + (*(default_value)).u2.cache_slot);

     if (zval_get_type(&(*(cache_val))) != 0) {

      do { zval *_z1 = (arg); const zval *_z2 = (cache_val); zend_refcounted *_gc = (*(_z2)).value.counted; uint32_t _t = (*(_z2)).u1.type_info; do { uint32_t _w2 = _z2->value.ww.w2; (*(_z1)).value.counted = _gc; _z1->value.ww.w2 = _w2; (*(_z1)).u1.type_info = _t; } while (0); } while (0);
     } else {


      zval tmp;
      do { zval *_z1 = (&tmp); const zval *_z2 = (default_value); zend_refcounted *_gc = (*(_z2)).value.counted; uint32_t _t = (*(_z2)).u1.type_info; do { uint32_t _w2 = _z2->value.ww.w2; (*(_z1)).value.counted = _gc; _z1->value.ww.w2 = _w2; (*(_z1)).u1.type_info = _t; } while (0); if ((((_t) & 0xff00) != 0)) { zend_gc_addref(&(_gc)->gc); } } while (0);
      zend_execute_data *old = start_fake_frame2(call, opline);
      zend_result ret;
      end_fake_frame2(call, old);
      if (__builtin_expect(!!(ret == FAILURE), 0)) {
       zval_ptr_dtor_nogc2(&tmp);
       return FAILURE;
      }
      do { zval *_z1 = (arg); const zval *_z2 = (&tmp); zend_refcounted *_gc = (*(_z2)).value.counted; uint32_t _t = (*(_z2)).u1.type_info; do { uint32_t _w2 = _z2->value.ww.w2; (*(_z1)).value.counted = _gc; _z1->value.ww.w2 = _w2; (*(_z1)).u1.type_info = _t; } while (0); } while (0);
      if (!((tmp).u1.v.type_flags != 0)) {
       do { zval *_z1 = (cache_val); const zval *_z2 = (&tmp); zend_refcounted *_gc = (*(_z2)).value.counted; uint32_t _t = (*(_z2)).u1.type_info; do { uint32_t _w2 = _z2->value.ww.w2; (*(_z1)).value.counted = _gc; _z1->value.ww.w2 = _w2; (*(_z1)).u1.type_info = _t; } while (0); } while (0);
      }
     }
    } else {
     do { zval *_z1 = (arg); const zval *_z2 = (default_value); zend_refcounted *_gc = (*(_z2)).value.counted; uint32_t _t = (*(_z2)).u1.type_info; do { uint32_t _w2 = _z2->value.ww.w2; (*(_z1)).value.counted = _gc; _z1->value.ww.w2 = _w2; (*(_z1)).u1.type_info = _t; } while (0); if ((((_t) & 0xff00) != 0)) { zend_gc_addref(&(_gc)->gc); } } while (0);
    }
   } else {
    do { if (__builtin_expect(!(opline->opcode == 63), 0)) __builtin_unreachable(); } while (0);
    zend_execute_data *old = start_fake_frame2(call, opline);
    zend_argument_error(zend_ce_argument_count_error, i + 1, "not passed");
    end_fake_frame2(call, old);
    return FAILURE;
   }
  }

  return SUCCESS;
 } else {
  if (fbc->common.fn_flags & (1 << 26)) {

   return SUCCESS;
  }

  uint32_t num_args = (call)->This.u2.num_args;
  for (uint32_t i = 0; i < num_args; i++) {
   zval *arg = (((zval*)(call)) + (((int)(((((sizeof(zend_execute_data)) + 8 - 1) & ~(8 - 1)) + (((sizeof(zval)) + 8 - 1) & ~(8 - 1)) - 1) / (((sizeof(zval)) + 8 - 1) & ~(8 - 1)))) + ((int)(i))));
   if (!(zval_get_type(&(*(arg))) == 0)) {
    continue;
   }

   zend_internal_arg_info *arg_info = &fbc->internal_function.arg_info[i];
   if (i < fbc->common.required_num_args) {
    zend_execute_data *old = start_fake_frame2(call, ((void*)0));
    zend_argument_error(zend_ce_argument_count_error, i + 1, "not passed");
    end_fake_frame2(call, old);
    return FAILURE;
   }

   zval default_value;
   if (zend_get_default_from_internal_arg_info2(&default_value, arg_info) == FAILURE) {
    zend_execute_data *old = start_fake_frame2(call, ((void*)0));
    zend_argument_error(zend_ce_argument_count_error, i + 1,
     "must be passed explicitly, because the default value is not known");
    end_fake_frame2(call, old);
    return FAILURE;
   }

   if (zval_get_type(&(default_value)) == 11) {
    zend_execute_data *old = start_fake_frame2(call, ((void*)0));
    zend_result ret;
    end_fake_frame2(call, old);
    if (ret == FAILURE) {
     return FAILURE;
    }
   }

   do { zval *_z1 = (arg); const zval *_z2 = (&default_value); zend_refcounted *_gc = (*(_z2)).value.counted; uint32_t _t = (*(_z2)).u1.type_info; do { uint32_t _w2 = _z2->value.ww.w2; (*(_z1)).value.counted = _gc; _z1->value.ww.w2 = _w2; (*(_z1)).u1.type_info = _t; } while (0); } while (0);
   if ((((((arg_info)->type).type_mask) >> 24) & 3) & 1u) {
    do { zend_reference *_ref = (zend_reference *) (__builtin_constant_p((sizeof(zend_reference))) ? (((sizeof(zend_reference)) <= 8) ? _emalloc_8() : (((sizeof(zend_reference)) <= 16) ? _emalloc_16() : (((sizeof(zend_reference)) <= 24) ? _emalloc_24() : (((sizeof(zend_reference)) <= 32) ? _emalloc_32() : (((sizeof(zend_reference)) <= 40) ? _emalloc_40() : (((sizeof(zend_reference)) <= 48) ? _emalloc_48() : (((sizeof(zend_reference)) <= 56) ? _emalloc_56() : (((sizeof(zend_reference)) <= 64) ? _emalloc_64() : (((sizeof(zend_reference)) <= 80) ? _emalloc_80() : (((sizeof(zend_reference)) <= 96) ? _emalloc_96() : (((sizeof(zend_reference)) <= 112) ? _emalloc_112() : (((sizeof(zend_reference)) <= 128) ? _emalloc_128() : (((sizeof(zend_reference)) <= 160) ? _emalloc_160() : (((sizeof(zend_reference)) <= 192) ? _emalloc_192() : (((sizeof(zend_reference)) <= 224) ? _emalloc_224() : (((sizeof(zend_reference)) <= 256) ? _emalloc_256() : (((sizeof(zend_reference)) <= 320) ? _emalloc_320() : (((sizeof(zend_reference)) <= 384) ? _emalloc_384() : (((sizeof(zend_reference)) <= 448) ? _emalloc_448() : (((sizeof(zend_reference)) <= 512) ? _emalloc_512() : (((sizeof(zend_reference)) <= 640) ? _emalloc_640() : (((sizeof(zend_reference)) <= 768) ? _emalloc_768() : (((sizeof(zend_reference)) <= 896) ? _emalloc_896() : (((sizeof(zend_reference)) <= 1024) ? _emalloc_1024() : (((sizeof(zend_reference)) <= 1280) ? _emalloc_1280() : (((sizeof(zend_reference)) <= 1536) ? _emalloc_1536() : (((sizeof(zend_reference)) <= 1792) ? _emalloc_1792() : (((sizeof(zend_reference)) <= 2048) ? _emalloc_2048() : (((sizeof(zend_reference)) <= 2560) ? _emalloc_2560() : (((sizeof(zend_reference)) <= 3072) ? _emalloc_3072() : (((sizeof(zend_reference)) <= (((size_t) (2 * 1024 * 1024)) - ((4 * 1024) * (1)))) ? _emalloc_large((sizeof(zend_reference))) : _emalloc_huge((sizeof(zend_reference)))) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) : _emalloc((sizeof(zend_reference))) ); zend_gc_set_refcount(&(_ref)->gc, 1); (_ref)->gc.u.type_info = (10 | ((1<<4) << 0)); do { zval *_z1 = (&_ref->val); const zval *_z2 = (arg); zend_refcounted *_gc = (*(_z2)).value.counted; uint32_t _t = (*(_z2)).u1.type_info; do { uint32_t _w2 = _z2->value.ww.w2; (*(_z1)).value.counted = _gc; _z1->value.ww.w2 = _w2; (*(_z1)).u1.type_info = _t; } while (0); } while (0); _ref->sources.ptr = ((void*)0); (*(arg)).value.ref = _ref; (*(arg)).u1.type_info = (10 | ((1<<0) << 8)); } while (0);
   }
  }
 }

 return SUCCESS;
}


zend_result zend_call_function2(zend_fcall_info *fci, zend_fcall_info_cache *fci_cache)
{
 uint32_t i;
 zend_execute_data *call, dummy_execute_data;
 zend_fcall_info_cache fci_cache_local;
 zend_function *func;
 uint32_t call_info;
 void *object_or_called_scope;
 zend_class_entry *orig_fake_scope;

 do { (*(fci->retval)).u1.type_info = 0; } while (0);

 if (!(executor_globals.active)) {
  return FAILURE;
 }

 if ((executor_globals.exception)) {
  return FAILURE;
 }

 do { if (__builtin_expect(!(fci->size == sizeof(zend_fcall_info)), 0)) __builtin_unreachable(); } while (0);


 if (!(executor_globals.current_execute_data)) {




  memset(&dummy_execute_data, 0, sizeof(zend_execute_data));
  (executor_globals.current_execute_data) = &dummy_execute_data;
 } else if ((executor_globals.current_execute_data)->func &&
            (((executor_globals.current_execute_data)->func->common.type) != 1) &&
            (executor_globals.current_execute_data)->opline->opcode != 60 &&
            (executor_globals.current_execute_data)->opline->opcode != 129 &&
            (executor_globals.current_execute_data)->opline->opcode != 130 &&
            (executor_globals.current_execute_data)->opline->opcode != 131) {

  dummy_execute_data = *(executor_globals.current_execute_data);
  dummy_execute_data.prev_execute_data = (executor_globals.current_execute_data);
  dummy_execute_data.call = ((void*)0);
  dummy_execute_data.opline = ((void*)0);
  dummy_execute_data.func = ((void*)0);
  (executor_globals.current_execute_data) = &dummy_execute_data;
 }

 if (!fci_cache || !fci_cache->function_handler) {
  char *error = ((void*)0);

  if (!fci_cache) {
   fci_cache = &fci_cache_local;
  }

  if( !zend_is_callable_ex2(&fci->function_name, fci->object, (1<<3), ((void*)0), fci_cache, &error))
  {
   if (error) {
    zend_string *callable_name
     = zend_get_callable_name_ex(&fci->function_name, fci->object);
    zend_error((1<<1L), "Invalid callback %s, %s", (callable_name)->val, error);
    _efree((error) );
    zend_string_release_ex(callable_name, 0);
   }
   if ((executor_globals.current_execute_data) == &dummy_execute_data) {
    (executor_globals.current_execute_data) = dummy_execute_data.prev_execute_data;
   }
   return FAILURE;
  }

  do { if (__builtin_expect(!(!error), 0)) __builtin_unreachable(); } while (0);
 }

 func = fci_cache->function_handler;
 if ((func->common.fn_flags & (1 << 4)) || !fci_cache->object) {
  fci->object = ((void*)0);
  object_or_called_scope = fci_cache->called_scope;
  call_info = ((1 << 17) | (0 << 16)) | (1 << 25);
 } else {
  fci->object = fci_cache->object;
  object_or_called_scope = fci->object;
  call_info = ((1 << 17) | (0 << 16)) | (1 << 25) | (8 | ((1<<0) << 8) | ((1<<1) << 8));
 }

 call = zend_vm_stack_push_call_frame(call_info,
  func, fci->param_count, object_or_called_scope);

 if (__builtin_expect(!!(func->common.fn_flags & (1 << 11)), 0)) {
  zend_deprecated_function(func);

  if (__builtin_expect(!!((executor_globals.exception)), 0)) {
   zend_vm_stack_free_call_frame(call);
   if ((executor_globals.current_execute_data) == &dummy_execute_data) {
    (executor_globals.current_execute_data) = dummy_execute_data.prev_execute_data;
    zend_rethrow_exception((executor_globals.current_execute_data));
   }
   return FAILURE;
  }
 }

 for (i=0; i<fci->param_count; i++) {
  zval *param = (((zval*)(call)) + (((int)(((((sizeof(zend_execute_data)) + 8 - 1) & ~(8 - 1)) + (((sizeof(zval)) + 8 - 1) & ~(8 - 1)) - 1) / (((sizeof(zval)) + 8 - 1) & ~(8 - 1)))) + ((int)(((int)(i+1)) - 1))));
  zval *arg = &fci->params[i];
  zend_bool must_wrap = 0;
  if (__builtin_expect(!!((zval_get_type(&(*(arg))) == 0)), 0)) {

   do { (*(param)).u1.type_info = 0; } while (0);
   do { do { ((call)->This).u1.type_info |= ((1 << 26)); } while (0); } while (0);
   continue;
  }

  if (zend_check_arg_send_type(func, i + 1, 1u|2u)) {
   if (__builtin_expect(!!(!(zval_get_type(&(*(arg))) == 10)), 0)) {
    if (!zend_check_arg_send_type(func, i + 1, 2u)) {


     zend_param_must_be_ref(func, i + 1);
     must_wrap = 1;
     if (__builtin_expect(!!((executor_globals.exception)), 0)) {
      (call)->This.u2.num_args = i;
cleanup_args:
      zend_vm_stack_free_args2(call);

      if ((executor_globals.current_execute_data) == &dummy_execute_data) {
       (executor_globals.current_execute_data) = dummy_execute_data.prev_execute_data;
      }
      return FAILURE;
     }
    }
   }
  } else {
   if ((zval_get_type(&(*(arg))) == 10) &&
       !(func->common.fn_flags & (1 << 18))) {

    arg = &(*(arg)).value.ref->val;
   }
  }

  if (__builtin_expect(!!(!must_wrap), 1)) {
   do { zval *_z1 = (param); const zval *_z2 = (arg); zend_refcounted *_gc = (*(_z2)).value.counted; uint32_t _t = (*(_z2)).u1.type_info; do { uint32_t _w2 = _z2->value.ww.w2; (*(_z1)).value.counted = _gc; _z1->value.ww.w2 = _w2; (*(_z1)).u1.type_info = _t; } while (0); if ((((_t) & 0xff00) != 0)) { zend_gc_addref(&(_gc)->gc); } } while (0);
  } else {
   do { if (((*((arg))).u1.v.type_flags != 0)) { zval_addref_p((arg)); } } while (0);
   do { zend_reference *_ref = (zend_reference *) (__builtin_constant_p((sizeof(zend_reference))) ? (((sizeof(zend_reference)) <= 8) ? _emalloc_8() : (((sizeof(zend_reference)) <= 16) ? _emalloc_16() : (((sizeof(zend_reference)) <= 24) ? _emalloc_24() : (((sizeof(zend_reference)) <= 32) ? _emalloc_32() : (((sizeof(zend_reference)) <= 40) ? _emalloc_40() : (((sizeof(zend_reference)) <= 48) ? _emalloc_48() : (((sizeof(zend_reference)) <= 56) ? _emalloc_56() : (((sizeof(zend_reference)) <= 64) ? _emalloc_64() : (((sizeof(zend_reference)) <= 80) ? _emalloc_80() : (((sizeof(zend_reference)) <= 96) ? _emalloc_96() : (((sizeof(zend_reference)) <= 112) ? _emalloc_112() : (((sizeof(zend_reference)) <= 128) ? _emalloc_128() : (((sizeof(zend_reference)) <= 160) ? _emalloc_160() : (((sizeof(zend_reference)) <= 192) ? _emalloc_192() : (((sizeof(zend_reference)) <= 224) ? _emalloc_224() : (((sizeof(zend_reference)) <= 256) ? _emalloc_256() : (((sizeof(zend_reference)) <= 320) ? _emalloc_320() : (((sizeof(zend_reference)) <= 384) ? _emalloc_384() : (((sizeof(zend_reference)) <= 448) ? _emalloc_448() : (((sizeof(zend_reference)) <= 512) ? _emalloc_512() : (((sizeof(zend_reference)) <= 640) ? _emalloc_640() : (((sizeof(zend_reference)) <= 768) ? _emalloc_768() : (((sizeof(zend_reference)) <= 896) ? _emalloc_896() : (((sizeof(zend_reference)) <= 1024) ? _emalloc_1024() : (((sizeof(zend_reference)) <= 1280) ? _emalloc_1280() : (((sizeof(zend_reference)) <= 1536) ? _emalloc_1536() : (((sizeof(zend_reference)) <= 1792) ? _emalloc_1792() : (((sizeof(zend_reference)) <= 2048) ? _emalloc_2048() : (((sizeof(zend_reference)) <= 2560) ? _emalloc_2560() : (((sizeof(zend_reference)) <= 3072) ? _emalloc_3072() : (((sizeof(zend_reference)) <= (((size_t) (2 * 1024 * 1024)) - ((4 * 1024) * (1)))) ? _emalloc_large((sizeof(zend_reference))) : _emalloc_huge((sizeof(zend_reference)))) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) : _emalloc((sizeof(zend_reference))) ); zend_gc_set_refcount(&(_ref)->gc, 1); (_ref)->gc.u.type_info = (10 | ((1<<4) << 0)); do { zval *_z1 = (&_ref->val); const zval *_z2 = (arg); zend_refcounted *_gc = (*(_z2)).value.counted; uint32_t _t = (*(_z2)).u1.type_info; do { uint32_t _w2 = _z2->value.ww.w2; (*(_z1)).value.counted = _gc; _z1->value.ww.w2 = _w2; (*(_z1)).u1.type_info = _t; } while (0); } while (0); _ref->sources.ptr = ((void*)0); (*(param)).value.ref = _ref; (*(param)).u1.type_info = (10 | ((1<<0) << 8)); } while (0);
  }
 }

 if (fci->named_params) {
  zend_string *name;
  zval *arg;
  uint32_t arg_num = (call)->This.u2.num_args + 1;
  zend_bool have_named_params = 0;
  do { HashTable *__ht = (fci->named_params); Bucket *_p = __ht->arData; Bucket *_end = _p + __ht->nNumUsed; for (; _p != _end; _p++) { zval *_z = &_p->val; if (0 && zval_get_type(&(*(_z))) == 12) { _z = (*(_z)).value.zv; } if (__builtin_expect(!!(zval_get_type(&(*(_z))) == 0), 0)) continue;; name = _p->key; arg = _z; {
   zend_bool must_wrap = 0;
   zval *target;
   if (name) {
    void *cache_slot[2] = {((void*)0), ((void*)0)};
    have_named_params = 1;

                goto cleanup_args;
   } else {
    if (have_named_params) {
     zend_throw_error(((void*)0),
      "Cannot use positional argument after named argument");
     goto cleanup_args;
    }

    zend_vm_stack_extend_call_frame(&call, arg_num - 1, 1);
    target = (((zval*)(call)) + (((int)(((((sizeof(zend_execute_data)) + 8 - 1) & ~(8 - 1)) + (((sizeof(zval)) + 8 - 1) & ~(8 - 1)) - 1) / (((sizeof(zval)) + 8 - 1) & ~(8 - 1)))) + ((int)(((int)(arg_num)) - 1))));
   }

   if (zend_check_arg_send_type(func, arg_num, 1u|2u)) {
    if (__builtin_expect(!!(!(zval_get_type(&(*(arg))) == 10)), 0)) {
     if (!zend_check_arg_send_type(func, arg_num, 2u)) {


      zend_param_must_be_ref(func, arg_num);
      must_wrap = 1;
      if (__builtin_expect(!!((executor_globals.exception)), 0)) {
       goto cleanup_args;
      }
     }
    }
   } else {
    if ((zval_get_type(&(*(arg))) == 10) &&
     !(func->common.fn_flags & (1 << 18))) {

     arg = &(*(arg)).value.ref->val;
    }
   }

   if (__builtin_expect(!!(!must_wrap), 1)) {
    do { zval *_z1 = (target); const zval *_z2 = (arg); zend_refcounted *_gc = (*(_z2)).value.counted; uint32_t _t = (*(_z2)).u1.type_info; do { uint32_t _w2 = _z2->value.ww.w2; (*(_z1)).value.counted = _gc; _z1->value.ww.w2 = _w2; (*(_z1)).u1.type_info = _t; } while (0); if ((((_t) & 0xff00) != 0)) { zend_gc_addref(&(_gc)->gc); } } while (0);
   } else {
    do { if (((*((arg))).u1.v.type_flags != 0)) { zval_addref_p((arg)); } } while (0);
    do { zend_reference *_ref = (zend_reference *) (__builtin_constant_p((sizeof(zend_reference))) ? (((sizeof(zend_reference)) <= 8) ? _emalloc_8() : (((sizeof(zend_reference)) <= 16) ? _emalloc_16() : (((sizeof(zend_reference)) <= 24) ? _emalloc_24() : (((sizeof(zend_reference)) <= 32) ? _emalloc_32() : (((sizeof(zend_reference)) <= 40) ? _emalloc_40() : (((sizeof(zend_reference)) <= 48) ? _emalloc_48() : (((sizeof(zend_reference)) <= 56) ? _emalloc_56() : (((sizeof(zend_reference)) <= 64) ? _emalloc_64() : (((sizeof(zend_reference)) <= 80) ? _emalloc_80() : (((sizeof(zend_reference)) <= 96) ? _emalloc_96() : (((sizeof(zend_reference)) <= 112) ? _emalloc_112() : (((sizeof(zend_reference)) <= 128) ? _emalloc_128() : (((sizeof(zend_reference)) <= 160) ? _emalloc_160() : (((sizeof(zend_reference)) <= 192) ? _emalloc_192() : (((sizeof(zend_reference)) <= 224) ? _emalloc_224() : (((sizeof(zend_reference)) <= 256) ? _emalloc_256() : (((sizeof(zend_reference)) <= 320) ? _emalloc_320() : (((sizeof(zend_reference)) <= 384) ? _emalloc_384() : (((sizeof(zend_reference)) <= 448) ? _emalloc_448() : (((sizeof(zend_reference)) <= 512) ? _emalloc_512() : (((sizeof(zend_reference)) <= 640) ? _emalloc_640() : (((sizeof(zend_reference)) <= 768) ? _emalloc_768() : (((sizeof(zend_reference)) <= 896) ? _emalloc_896() : (((sizeof(zend_reference)) <= 1024) ? _emalloc_1024() : (((sizeof(zend_reference)) <= 1280) ? _emalloc_1280() : (((sizeof(zend_reference)) <= 1536) ? _emalloc_1536() : (((sizeof(zend_reference)) <= 1792) ? _emalloc_1792() : (((sizeof(zend_reference)) <= 2048) ? _emalloc_2048() : (((sizeof(zend_reference)) <= 2560) ? _emalloc_2560() : (((sizeof(zend_reference)) <= 3072) ? _emalloc_3072() : (((sizeof(zend_reference)) <= (((size_t) (2 * 1024 * 1024)) - ((4 * 1024) * (1)))) ? _emalloc_large((sizeof(zend_reference))) : _emalloc_huge((sizeof(zend_reference)))) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) : _emalloc((sizeof(zend_reference))) ); zend_gc_set_refcount(&(_ref)->gc, 1); (_ref)->gc.u.type_info = (10 | ((1<<4) << 0)); do { zval *_z1 = (&_ref->val); const zval *_z2 = (arg); zend_refcounted *_gc = (*(_z2)).value.counted; uint32_t _t = (*(_z2)).u1.type_info; do { uint32_t _w2 = _z2->value.ww.w2; (*(_z1)).value.counted = _gc; _z1->value.ww.w2 = _w2; (*(_z1)).u1.type_info = _t; } while (0); } while (0); _ref->sources.ptr = ((void*)0); (*(target)).value.ref = _ref; (*(target)).u1.type_info = (10 | ((1<<0) << 8)); } while (0);
   }
   if (!name) {
    (call)->This.u2.num_args++;
    arg_num++;
   }
  } } } while (0);
 }

 if (__builtin_expect(!!(((call)->This).u1.type_info & (1 << 26)), 0)) {
  if ( (zend_handle_undef_args2(call) == FAILURE)) {

   zend_vm_stack_free_call_frame(call);
   if ((executor_globals.current_execute_data) == &dummy_execute_data) {
    (executor_globals.current_execute_data) = dummy_execute_data.prev_execute_data;
   }
   return SUCCESS;
  }
 }

 if (__builtin_expect(!!(func->op_array.fn_flags & (1 << 22)), 0)) {
  uint32_t call_info;

  zend_gc_addref(&(((zend_object*)((char*)(func) - sizeof(zend_object))))->gc);
  call_info = (1 << 22);
  if (func->common.fn_flags & (1 << 23)) {
   call_info |= (1 << 23);
  }
  do { do { ((call)->This).u1.type_info |= (call_info); } while (0); } while (0);
 }

 orig_fake_scope = (executor_globals.fake_scope);
 (executor_globals.fake_scope) = ((void*)0);
 if (func->type == 2) {
  int call_via_handler = (func->common.fn_flags & (1 << 18)) != 0;
  const zend_op *current_opline_before_exception = (executor_globals.opline_before_exception);
  uint32_t orig_jit_trace_num = (executor_globals.jit_trace_num);

  zend_init_func_execute_data(call, &func->op_array, fci->retval);
  do { if ((zend_observer_fcall_op_array_extension != -1)) { zend_observer_fcall_begin(call); } } while (0);
  zend_execute_ex(call);
  (executor_globals.jit_trace_num) = orig_jit_trace_num;
  (executor_globals.opline_before_exception) = current_opline_before_exception;
  if (call_via_handler) {

   fci_cache->function_handler = ((void*)0);
  }
 } else {
  int call_via_handler = (func->common.fn_flags & (1 << 18)) != 0;

  do { if (__builtin_expect(!(func->type == 1), 0)) __builtin_unreachable(); } while (0);
  do { (*(fci->retval)).u1.type_info = 1; } while (0);
  call->prev_execute_data = (executor_globals.current_execute_data);
  (executor_globals.current_execute_data) = call;
  if (__builtin_expect(!!(zend_execute_internal == ((void*)0)), 1)) {

   func->internal_function.handler(call, fci->retval);
  } else {
   zend_execute_internal(call, fci->retval);
  }
  (executor_globals.current_execute_data) = call->prev_execute_data;

  if (__builtin_expect(!!(((call)->This).u1.type_info & (1 << 27)), 0)) {

  }

  if ((executor_globals.exception)) {

   do { (*(fci->retval)).u1.type_info = 0; } while (0);
  }

  if (call_via_handler) {

   fci_cache->function_handler = ((void*)0);
  }



  if ((executor_globals.vm_interrupt)) {
   (executor_globals.vm_interrupt) = 0;
   if ((executor_globals.timed_out)) {
    zend_timeout();
   } else if (zend_interrupt_function) {
    zend_interrupt_function((executor_globals.current_execute_data));
   }
  }
 }
 (executor_globals.fake_scope) = orig_fake_scope;



 if ((executor_globals.current_execute_data) == &dummy_execute_data) {
  (executor_globals.current_execute_data) = dummy_execute_data.prev_execute_data;
 }

 if (__builtin_expect(!!((executor_globals.exception)), 0)) {
  if (__builtin_expect(!!(!(executor_globals.current_execute_data)), 0)) {

  } else if ((executor_globals.current_execute_data)->func &&
             (((executor_globals.current_execute_data)->func->common.type) != 1)) {
   zend_rethrow_exception((executor_globals.current_execute_data));
  }
 }

 return SUCCESS;
}


void zend_exception_save2(void)
{
 if ((executor_globals.prev_exception)) {

  zend_call_function2(((void*)0), ((void*)0));
 }
 if ((executor_globals.exception)) {
  (executor_globals.prev_exception) = (executor_globals.exception);
 }
 (executor_globals.exception) = ((void*)0);
}

__attribute__ ((visibility("default"))) zend_class_entry *zend_lookup_class2(zend_string *name, zend_string *key, uint32_t flags)
{
 zend_class_entry *ce = ((void*)0);
 zval *zv;
 zend_string *lc_name;
 zend_string *autoload_name;

 if (key) {
  lc_name = key;
 } else {
  if (name == ((void*)0) || !(name)->len) {
   return ((void*)0);
  }

  if ((name)->val[0] == '\\') {
   lc_name = zend_string_alloc((name)->len - 1, 0);
   zend_str_tolower_copy((lc_name)->val, (name)->val + 1, (name)->len - 1);
  } else {
   lc_name = zend_string_tolower_ex(name, 0);
  }
 }

 zv = zend_hash_find((executor_globals.class_table), lc_name);
 if (zv) {
  if (!key) {
   zend_string_release_ex(lc_name, 0);
  }
  ce = (zend_class_entry*)(*(zv)).value.ptr;
  if (__builtin_expect(!!(!(ce->ce_flags & (1 << 3))), 0)) {
   if ((flags & 0x0400) ||
    ((flags & 0x0800) &&
     (ce->ce_flags & (1 << 20)))) {
    ce->ce_flags |= (1 << 21);
    return ce;
   }
   return ((void*)0);
  }
  return ce;
 }


 if ((flags & 0x80) || zend_is_compiling()) {
  if (!key) {
   zend_string_release_ex(lc_name, 0);
  }
  return ((void*)0);
 }

 if (!zend_autoload) {
  if (!key) {
   zend_string_release_ex(lc_name, 0);
  }
  return ((void*)0);
 }


 if (!key && !zend_is_valid_class_name(name)) {
  zend_string_release_ex(lc_name, 0);
  return ((void*)0);
 }

 if ((executor_globals.in_autoload) == ((void*)0)) {

  _zend_hash_init(((executor_globals.in_autoload)), (8), (((void*)0)), (0));
 }

 if (zend_hash_add_empty_element2((executor_globals.in_autoload), lc_name) == ((void*)0)) {
  if (!key) {
   zend_string_release_ex(lc_name, 0);
  }
  return ((void*)0);
 }

 if ((name)->val[0] == '\\') {
  autoload_name = zend_string_init((name)->val + 1, (name)->len - 1, 0);
 } else {
  autoload_name = zend_string_copy(name);
 }

 zend_exception_save2();



 zend_string_release_ex(autoload_name, 0);
 zend_hash_del((executor_globals.in_autoload), lc_name);

 if (!key) {
  zend_string_release_ex(lc_name, 0);
 }
 return ce;
}


static inline __attribute__((always_inline)) zend_class_entry *get_scope(zend_execute_data *frame)
{
 return frame && frame->func ? frame->func->common.scope : ((void*)0);
}


static _Bool zend_is_callable_check_class(zend_string *name, zend_class_entry *scope, zend_execute_data *frame, zend_fcall_info_cache *fcc, _Bool *strict_class, char **error)
{
 _Bool ret = 0;
 zend_class_entry *ce;
 size_t name_len = (name)->len;
 zend_string *lcname;
 zend_bool use_heap;;

 do { (lcname) = (zend_string *)(((use_heap) = (__builtin_expect(!!((((((__builtin_offsetof(zend_string, val) + name_len + 1)) + ((8) - 1)) & ~((8) - 1))) > ((32 * 1024))), 0))) ? (__builtin_constant_p((((((__builtin_offsetof(zend_string, val) + name_len + 1)) + ((8) - 1)) & ~((8) - 1)))) ? (((((((__builtin_offsetof(zend_string, val) + name_len + 1)) + ((8) - 1)) & ~((8) - 1))) <= 8) ? _emalloc_8() : (((((((__builtin_offsetof(zend_string, val) + name_len + 1)) + ((8) - 1)) & ~((8) - 1))) <= 16) ? _emalloc_16() : (((((((__builtin_offsetof(zend_string, val) + name_len + 1)) + ((8) - 1)) & ~((8) - 1))) <= 24) ? _emalloc_24() : (((((((__builtin_offsetof(zend_string, val) + name_len + 1)) + ((8) - 1)) & ~((8) - 1))) <= 32) ? _emalloc_32() : (((((((__builtin_offsetof(zend_string, val) + name_len + 1)) + ((8) - 1)) & ~((8) - 1))) <= 40) ? _emalloc_40() : (((((((__builtin_offsetof(zend_string, val) + name_len + 1)) + ((8) - 1)) & ~((8) - 1))) <= 48) ? _emalloc_48() : (((((((__builtin_offsetof(zend_string, val) + name_len + 1)) + ((8) - 1)) & ~((8) - 1))) <= 56) ? _emalloc_56() : (((((((__builtin_offsetof(zend_string, val) + name_len + 1)) + ((8) - 1)) & ~((8) - 1))) <= 64) ? _emalloc_64() : (((((((__builtin_offsetof(zend_string, val) + name_len + 1)) + ((8) - 1)) & ~((8) - 1))) <= 80) ? _emalloc_80() : (((((((__builtin_offsetof(zend_string, val) + name_len + 1)) + ((8) - 1)) & ~((8) - 1))) <= 96) ? _emalloc_96() : (((((((__builtin_offsetof(zend_string, val) + name_len + 1)) + ((8) - 1)) & ~((8) - 1))) <= 112) ? _emalloc_112() : (((((((__builtin_offsetof(zend_string, val) + name_len + 1)) + ((8) - 1)) & ~((8) - 1))) <= 128) ? _emalloc_128() : (((((((__builtin_offsetof(zend_string, val) + name_len + 1)) + ((8) - 1)) & ~((8) - 1))) <= 160) ? _emalloc_160() : (((((((__builtin_offsetof(zend_string, val) + name_len + 1)) + ((8) - 1)) & ~((8) - 1))) <= 192) ? _emalloc_192() : (((((((__builtin_offsetof(zend_string, val) + name_len + 1)) + ((8) - 1)) & ~((8) - 1))) <= 224) ? _emalloc_224() : (((((((__builtin_offsetof(zend_string, val) + name_len + 1)) + ((8) - 1)) & ~((8) - 1))) <= 256) ? _emalloc_256() : (((((((__builtin_offsetof(zend_string, val) + name_len + 1)) + ((8) - 1)) & ~((8) - 1))) <= 320) ? _emalloc_320() : (((((((__builtin_offsetof(zend_string, val) + name_len + 1)) + ((8) - 1)) & ~((8) - 1))) <= 384) ? _emalloc_384() : (((((((__builtin_offsetof(zend_string, val) + name_len + 1)) + ((8) - 1)) & ~((8) - 1))) <= 448) ? _emalloc_448() : (((((((__builtin_offsetof(zend_string, val) + name_len + 1)) + ((8) - 1)) & ~((8) - 1))) <= 512) ? _emalloc_512() : (((((((__builtin_offsetof(zend_string, val) + name_len + 1)) + ((8) - 1)) & ~((8) - 1))) <= 640) ? _emalloc_640() : (((((((__builtin_offsetof(zend_string, val) + name_len + 1)) + ((8) - 1)) & ~((8) - 1))) <= 768) ? _emalloc_768() : (((((((__builtin_offsetof(zend_string, val) + name_len + 1)) + ((8) - 1)) & ~((8) - 1))) <= 896) ? _emalloc_896() : (((((((__builtin_offsetof(zend_string, val) + name_len + 1)) + ((8) - 1)) & ~((8) - 1))) <= 1024) ? _emalloc_1024() : (((((((__builtin_offsetof(zend_string, val) + name_len + 1)) + ((8) - 1)) & ~((8) - 1))) <= 1280) ? _emalloc_1280() : (((((((__builtin_offsetof(zend_string, val) + name_len + 1)) + ((8) - 1)) & ~((8) - 1))) <= 1536) ? _emalloc_1536() : (((((((__builtin_offsetof(zend_string, val) + name_len + 1)) + ((8) - 1)) & ~((8) - 1))) <= 1792) ? _emalloc_1792() : (((((((__builtin_offsetof(zend_string, val) + name_len + 1)) + ((8) - 1)) & ~((8) - 1))) <= 2048) ? _emalloc_2048() : (((((((__builtin_offsetof(zend_string, val) + name_len + 1)) + ((8) - 1)) & ~((8) - 1))) <= 2560) ? _emalloc_2560() : (((((((__builtin_offsetof(zend_string, val) + name_len + 1)) + ((8) - 1)) & ~((8) - 1))) <= 3072) ? _emalloc_3072() : (((((((__builtin_offsetof(zend_string, val) + name_len + 1)) + ((8) - 1)) & ~((8) - 1))) <= (((size_t) (2 * 1024 * 1024)) - ((4 * 1024) * (1)))) ? _emalloc_large((((((__builtin_offsetof(zend_string, val) + name_len + 1)) + ((8) - 1)) & ~((8) - 1)))) : _emalloc_huge((((((__builtin_offsetof(zend_string, val) + name_len + 1)) + ((8) - 1)) & ~((8) - 1))))) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) ) : _emalloc((((((__builtin_offsetof(zend_string, val) + name_len + 1)) + ((8) - 1)) & ~((8) - 1)))) ) : __builtin_alloca(((((__builtin_offsetof(zend_string, val) + name_len + 1)) + ((8) - 1)) & ~((8) - 1)))); zend_gc_set_refcount(&(lcname)->gc, 1); (lcname)->gc.u.type_info = (6 | ((1<<4) << 0)); (lcname)->h = 0; (lcname)->len = name_len; } while (0);
 zend_str_tolower_copy((lcname)->val, (name)->val, name_len);

 *strict_class = 0;
 if (((lcname)->len == sizeof("self")-1 && !memcmp((lcname)->val, "self", sizeof("self") - 1))) {
  if (!scope) {
   if (error) *error = _estrdup(("cannot access \"self\" when no class scope is active") );
  } else {
   fcc->called_scope = zend_get_called_scope(frame);
   if (!fcc->called_scope || !instanceof_function(fcc->called_scope, scope)) {
    fcc->called_scope = scope;
   }
   fcc->calling_scope = scope;
   if (!fcc->object) {
    fcc->object = zend_get_this_object(frame);
   }
   ret = 1;
  }
 } else if (((lcname)->len == sizeof("parent")-1 && !memcmp((lcname)->val, "parent", sizeof("parent") - 1))) {
  if (!scope) {
   if (error) *error = _estrdup(("cannot access \"parent\" when no class scope is active") );
  } else if (!scope->parent) {
   if (error) *error = _estrdup(("cannot access \"parent\" when current class scope has no parent") );
  } else {
   fcc->called_scope = zend_get_called_scope(frame);
   if (!fcc->called_scope || !instanceof_function(fcc->called_scope, scope->parent)) {
    fcc->called_scope = scope->parent;
   }
   fcc->calling_scope = scope->parent;
   if (!fcc->object) {
    fcc->object = zend_get_this_object(frame);
   }
   *strict_class = 1;
   ret = 1;
  }
 } else if (((lcname)->len == sizeof("static")-1 && !memcmp((lcname)->val, "static", sizeof("static") - 1))) {
  zend_class_entry *called_scope = zend_get_called_scope(frame);

  if (!called_scope) {
   if (error) *error = _estrdup(("cannot access \"static\" when no class scope is active") );
  } else {
   fcc->called_scope = called_scope;
   fcc->calling_scope = called_scope;
   if (!fcc->object) {
    fcc->object = zend_get_this_object(frame);
   }
   *strict_class = 1;
   ret = 1;
  }
 } else if (scope != ((void*)0)) {
     ce = zend_lookup_class2(name, ((void*)0), 0);
  zend_class_entry *scope = get_scope(frame);
  fcc->calling_scope = ce;
  if (scope && !fcc->object) {
   zend_object *object = zend_get_this_object(frame);

   if (object &&
       instanceof_function(object->ce, scope) &&
       instanceof_function(scope, ce)) {
    fcc->object = object;
    fcc->called_scope = object->ce;
   } else {
    fcc->called_scope = ce;
   }
  } else {
   fcc->called_scope = fcc->object ? fcc->object->ce : ce;
  }
  *strict_class = 1;
  ret = 1;
 } else {
  if (error) zend_spprintf(error, 0, "class \"%.*s\" not found", (int)name_len, (name)->val);
 }
 do { if (__builtin_expect(!!(use_heap), 0)) _efree((lcname) ); } while (0);
 return ret;
}

__attribute__ ((visibility("default"))) zend_bool zend_is_callable_at_frame2(
  zval *callable, zend_object *object, zend_execute_data *frame,
  uint32_t check_flags, zend_fcall_info_cache *fcc, char **error)
{
 zend_bool ret;
 zend_fcall_info_cache fcc_local;
 _Bool strict_class = 0;

 if (fcc == ((void*)0)) {
  fcc = &fcc_local;
 }
 if (error) {
  *error = ((void*)0);
 }

 fcc->calling_scope = ((void*)0);
 fcc->called_scope = ((void*)0);
 fcc->function_handler = ((void*)0);
 fcc->object = ((void*)0);

again:
 switch (zval_get_type(&(*(callable)))) {
  case 6:
   if (object) {
    fcc->object = object;
    fcc->calling_scope = object->ce;
   }

   if (check_flags & (1<<0)) {
    fcc->called_scope = fcc->calling_scope;
    return 1;
   }

check_func:

   if (fcc == &fcc_local) {
    zend_release_fcall_info_cache(fcc);
   }
   return ret;

  case 7:
   {
    zval *method = ((void*)0);
    zval *obj = ((void*)0);

    if (((*(callable)).value.arr)->nNumOfElements == 2) {
     obj = zend_hash_index_find((*(callable)).value.arr, 0);
     method = zend_hash_index_find((*(callable)).value.arr, 1);
    }

    do {
     if (obj == ((void*)0) || method == ((void*)0)) {
      break;
     }

     do { if (__builtin_expect(!!((zval_get_type(&(*(method))) == 10)), 0)) { (method) = &(*(method)).value.ref->val; } } while (0);
     if (zval_get_type(&(*(method))) != 6) {
      break;
     }

     do { if (__builtin_expect(!!((zval_get_type(&(*(obj))) == 10)), 0)) { (obj) = &(*(obj)).value.ref->val; } } while (0);
     if (zval_get_type(&(*(obj))) == 6) {
      if (check_flags & (1<<0)) {
       return 1;
      }

      if (!zend_is_callable_check_class((*(obj)).value.str, get_scope(frame), frame, fcc, &strict_class, error)) {
       return 0;
      }

     } else if (zval_get_type(&(*(obj))) == 8) {

      fcc->calling_scope = ((*(obj)).value.obj->ce);

      fcc->object = (*(obj)).value.obj;

      if (check_flags & (1<<0)) {
       fcc->called_scope = fcc->calling_scope;
       return 1;
      }
     } else {
      break;
     }

     callable = method;
     goto check_func;

    } while (0);
    if (((*(callable)).value.arr)->nNumOfElements == 2) {
     if (!obj || (!(zval_get_type(&(*(obj))) == 10)?
        (zval_get_type(&(*(obj))) != 6 && zval_get_type(&(*(obj))) != 8) :
        (zval_get_type(&(*(&(*(obj)).value.ref->val))) != 6 && zval_get_type(&(*(&(*(obj)).value.ref->val))) != 8))) {
      if (error) *error = _estrdup(("first array member is not a valid class name or object") );
     } else {
      if (error) *error = _estrdup(("second array member is not a valid method") );
     }
    } else {
     if (error) *error = _estrdup(("array must have exactly two members") );
    }
   }
   return 0;
  case 8:
   if (((*(callable))).value.obj->handlers->get_closure && ((*(callable))).value.obj->handlers->get_closure((*(callable)).value.obj, &fcc->calling_scope, &fcc->function_handler, &fcc->object, 1) == SUCCESS) {
    fcc->called_scope = fcc->calling_scope;
    if (fcc == &fcc_local) {
     zend_release_fcall_info_cache(fcc);
    }
    return 1;
   }
   if (error) *error = _estrdup(("no array or string given") );
   return 0;
  case 10:
   callable = &(*(callable)).value.ref->val;
   goto again;
  default:
   if (error) *error = _estrdup(("no array or string given") );
   return 0;
 }
}



void __attribute__((used)) pib_init2(
                                    zval *callable, zend_object *object, zend_execute_data *frame,
                                    uint32_t check_flags, zend_fcall_info_cache *fcc, char **error
)
{
    zend_is_callable_at_frame2(callable, object, frame, check_flags, fcc, error);
}
