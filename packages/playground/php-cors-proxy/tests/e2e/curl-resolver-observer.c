/*
 * Test-only libcurl observer. PHP does not expose the resolver-start callback,
 * so preload this library into the fixture server to install it on every handle.
 * No libcurl is linked here: use the same loaded library as PHP's curl extension.
 *
 * The callback records a resolver start and aborts before external DNS traffic.
 * CURLOPT_RESOLVE entries must bypass it and still reach the approved listener.
 * An unpinned control request checks that the callback is actually observable.
 * https://curl.se/libcurl/c/CURLOPT_RESOLVER_START_FUNCTION.html
 */
#define _GNU_SOURCE
#include <curl/curl.h>
#include <dlfcn.h>
#include <stdio.h>
#include <stdlib.h>

typedef CURLcode (*setopt_function)(CURL *, CURLoption, ...);

static CURL *attach_observer(CURL *handle, setopt_function setopt);
static int resolver_start(void *state, void *reserved, void *userdata);
static void record_event(const char *event);

#ifdef __APPLE__
static CURL *observed_easy_init(void)
{
    /* dyld does not interpose calls from the replacement's own image. */
    return attach_observer(curl_easy_init(), curl_easy_setopt);
}

__attribute__((used)) static const struct {
    const void *replacement;
    const void *original;
} interpose __attribute__((section("__DATA,__interpose"))) = {
    (const void *)observed_easy_init, (const void *)curl_easy_init
};
#else
void *dlopen(const char *filename, int flags)
{
    /* PHP's RTLD_DEEPBIND would prefer libcurl over our preloaded init hook.
     * Disable it only in this fixture process so the observer can attach.
     * https://github.com/php/php-src/blob/PHP-8.3/Zend/zend_portability.h
     */
    void *(*original)(const char *, int) =
        (void *(*)(const char *, int))dlsym(RTLD_NEXT, "dlopen");
    if (!original) {
        fputs("Could not find the native library loader\n", stderr);
        exit(1);
    }
    return original(filename, flags & ~RTLD_DEEPBIND);
}

CURL *curl_easy_init(void)
{
    CURL *(*original)(void) = (CURL *(*)(void))dlsym(RTLD_NEXT, "curl_easy_init");
    setopt_function setopt = (setopt_function)dlsym(RTLD_NEXT, "curl_easy_setopt");
    if (!original || !setopt) {
        fputs("Could not find PHP's native libcurl functions\n", stderr);
        exit(1);
    }
    return attach_observer(original(), setopt);
}
#endif

static CURL *attach_observer(CURL *handle, setopt_function setopt)
{
    if (!handle) {
        return NULL;
    }
    if (setopt(handle, CURLOPT_RESOLVER_START_FUNCTION, resolver_start) != CURLE_OK) {
        fputs("Could not install the native resolver observer\n", stderr);
        exit(1);
    }
    record_event("curl-init\n");
    return handle;
}

static int resolver_start(void *state, void *reserved, void *userdata)
{
    (void)state;
    (void)reserved;
    (void)userdata;
    record_event("curl-resolver-start\n");
    return 1;
}

static void record_event(const char *event)
{
    const char *path = getenv("PLAYGROUND_CORS_PROXY_TEST_RESOLVER_LOG");
    FILE *log = path ? fopen(path, "a") : NULL;
    if (!log || fputs(event, log) == EOF || fclose(log) != 0) {
        fputs("Could not record a native resolver observation\n", stderr);
        exit(1);
    }
}
