#include <sys/types.h>
#include <sys/socket.h>

extern ssize_t wasm_recv(int, void*, size_t, int);
extern int wasm_setsockopt(int, int, int, const void*, socklen_t);

ssize_t recv(int s, void* b, size_t l, int f) {
	return wasm_recv(s, b, l, f);
}
int setsockopt(int s, int lvl, int opt, const void* v, socklen_t n) {
	return wasm_setsockopt(s, lvl, opt, v, n);
}
