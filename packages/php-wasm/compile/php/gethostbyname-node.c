#ifdef PHP_WASM_USE_NODE_DNS

/*
 * Provide a Node-backed gethostbyname() that resolves hostnames using the
 * native dns module instead of Emscripten's synthetic DNS mapping. This is
 * enabled only for the Node build via PHP_WASM_USE_NODE_DNS.
 */

#include <arpa/inet.h>
#include <emscripten.h>
#include <netdb.h>
#include <netinet/in.h>
#include <sys/socket.h>
#include <stdlib.h>
#include <string.h>

/* Provide direct replacements for libc DNS helpers for the Node build. */

#ifdef PLAYGROUND_JSPI
EM_ASYNC_JS(int, wasm_node_dns_lookup, (const char *name, char *out, int out_len), {
        const returnCallback = (resolver) => new Promise(resolver);
#else
EM_JS(int, wasm_node_dns_lookup, (const char *name, char *out, int out_len), {
        const returnCallback = (resolver) => Asyncify.handleSleep(resolver);
#endif
        return returnCallback(async (wakeUp) => {
                try {
                        const dns = require('dns').promises;
                        const host = UTF8ToString(name);
                        const { address } = await dns.lookup(host, { family: 4 });
                        const required = lengthBytesUTF8(address) + 1;
                        if (required > out_len) {
                                wakeUp(-required);
                                return;
                        }
                        stringToUTF8(address, out, out_len);
                        wakeUp(required);
                } catch (e) {
                        wakeUp(0);
                }
        });
});

static struct hostent *node_dns_gethostbyname(const char *name)
{
        static struct hostent h;
        static char *aliases[1];
        static char *addr_list[2];
        static struct in_addr addr;
        static char name_buf[256];

        memset(&h, 0, sizeof(h));
        aliases[0] = NULL;
        addr_list[0] = NULL;
        addr_list[1] = NULL;

        char ip[64];
        int n = wasm_node_dns_lookup(name, ip, sizeof(ip));
        if (n <= 0) {
#ifdef h_errno
                h_errno = HOST_NOT_FOUND;
#endif
                return NULL;
        }

        if (!inet_aton(ip, &addr)) {
#ifdef h_errno
                h_errno = NO_RECOVERY;
#endif
                return NULL;
        }

        strncpy(name_buf, name, sizeof(name_buf) - 1);
        name_buf[sizeof(name_buf) - 1] = '\0';

        h.h_name = name_buf;
        h.h_aliases = aliases;
        h.h_addrtype = AF_INET;
        h.h_length = sizeof(struct in_addr);
        addr_list[0] = (char *)&addr;
        h.h_addr_list = addr_list;

        return &h;
}

struct hostent *gethostbyname(const char *name)
{
        /* Try Node-backed resolution first. */
        struct hostent *h = node_dns_gethostbyname(name);
        if (h != NULL) {
                return h;
        }

        /* No libc fallback: rely solely on the Node-backed resolver. */
        return NULL;
}

/* Minimal getaddrinfo implementation backed by the same Node DNS lookup. */
int getaddrinfo(const char *node, const char *service, const struct addrinfo *hints, struct addrinfo **res)
{
        if (!node || !res) {
                return EAI_NONAME;
        }

        char ip[64];
        int n = wasm_node_dns_lookup(node, ip, sizeof(ip));
        if (n <= 0) {
                return EAI_FAIL;
        }

        struct sockaddr_in *sa = calloc(1, sizeof(struct sockaddr_in));
        struct addrinfo *ai = calloc(1, sizeof(struct addrinfo));
        if (!sa || !ai) {
                free(sa); free(ai);
                return EAI_MEMORY;
        }

        sa->sin_family = AF_INET;
        sa->sin_port = 0;
        if (service) {
                sa->sin_port = htons((uint16_t)atoi(service));
        }
        if (!inet_aton(ip, &sa->sin_addr)) {
                free(sa); free(ai);
                return EAI_FAIL;
        }

        ai->ai_family = AF_INET;
        ai->ai_socktype = hints && hints->ai_socktype ? hints->ai_socktype : SOCK_STREAM;
        ai->ai_protocol = hints && hints->ai_protocol ? hints->ai_protocol : 0;
        ai->ai_addrlen = sizeof(struct sockaddr_in);
        ai->ai_addr = (struct sockaddr *)sa;
        ai->ai_canonname = NULL;
        ai->ai_next = NULL;

        if (hints && (hints->ai_flags & AI_CANONNAME)) {
                ai->ai_canonname = strdup(node);
        }

        *res = ai;
        return 0;
}

void freeaddrinfo(struct addrinfo *res)
{
        while (res) {
            struct addrinfo *next = res->ai_next;
            free(res->ai_canonname);
            free(res->ai_addr);
            free(res);
            res = next;
        }
}

/* Plain replacements to ensure PHP hits Node-backed DNS. */

#endif
