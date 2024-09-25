/* {{{ includes */
#include "php.h"
#include "php_network.h"
#include "zend_API.h"
#include "zend_constants.h"
#include "dns_polyfill.h"

#ifdef HAVE_SYS_SOCKET_H
#include <sys/socket.h>
#endif

#include <netinet/in.h>
#ifdef HAVE_ARPA_INET_H
#include <arpa/inet.h>
#endif
#include <netdb.h>
#ifdef _OSD_POSIX
#undef STATUS
#undef T_UNSPEC
#endif
#ifdef HAVE_ARPA_NAMESER_H
#ifdef DARWIN
# define BIND_8_COMPAT 1
#endif
#include <arpa/nameser.h>
#endif
#ifdef HAVE_RESOLV_H
#include <resolv.h>
#if defined(__HAIKU__)
extern void __res_ndestroy(res_state statp);
#define res_ndestroy __res_ndestroy
#endif
#endif
#ifdef HAVE_DNS_H
#include <dns.h>
#endif

#ifndef MAXHOSTNAMELEN
#define MAXHOSTNAMELEN 255
#endif

/* For the local hostname obtained via gethostname which is different from the
   dns-related MAXHOSTNAMELEN constant above */
#ifndef HOST_NAME_MAX
#define HOST_NAME_MAX 255
#endif

/* type compat */
#ifndef DNS_T_A
#define DNS_T_A		1
#endif
#ifndef DNS_T_NS
#define DNS_T_NS	2
#endif
#ifndef DNS_T_CNAME
#define DNS_T_CNAME	5
#endif
#ifndef DNS_T_SOA
#define DNS_T_SOA	6
#endif
#ifndef DNS_T_PTR
#define DNS_T_PTR	12
#endif
#ifndef DNS_T_HINFO
#define DNS_T_HINFO	13
#endif
#ifndef DNS_T_MINFO
#define DNS_T_MINFO	14
#endif
#ifndef DNS_T_MX
#define DNS_T_MX	15
#endif
#ifndef DNS_T_TXT
#define DNS_T_TXT	16
#endif
#ifndef DNS_T_AAAA
#define DNS_T_AAAA	28
#endif
#ifndef DNS_T_SRV
#define DNS_T_SRV	33
#endif
#ifndef DNS_T_NAPTR
#define DNS_T_NAPTR	35
#endif
#ifndef DNS_T_A6
#define DNS_T_A6	38
#endif
#ifndef DNS_T_CAA
#define DNS_T_CAA	257
#endif

#ifndef DNS_T_ANY
#define DNS_T_ANY	255
#endif
/* }}} */

#ifndef HFIXEDSZ
#define HFIXEDSZ        12      /* fixed data in header <arpa/nameser.h> */
#endif /* HFIXEDSZ */

#ifndef QFIXEDSZ
#define QFIXEDSZ        4       /* fixed data in query <arpa/nameser.h> */
#endif /* QFIXEDSZ */

#undef MAXHOSTNAMELEN
#define MAXHOSTNAMELEN  1024

#ifndef MAXRESOURCERECORDS
#define MAXRESOURCERECORDS	64
#endif /* MAXRESOURCERECORDS */

#ifndef PHP_DNS_A
#define PHP_DNS_A      0x00000001
#endif
#ifndef PHP_DNS_NS
#define PHP_DNS_NS     0x00000002
#endif
#ifndef PHP_DNS_CNAME
#define PHP_DNS_CNAME  0x00000010
#endif
#ifndef PHP_DNS_SOA
#define PHP_DNS_SOA    0x00000020
#endif
#ifndef PHP_DNS_PTR
#define PHP_DNS_PTR 0x00000800
#endif
#ifndef PHP_DNS_HINFO
#define PHP_DNS_HINFO 0x00001000
#endif
#if !defined(PHP_WIN32) && !defined(PHP_DNS_CAA)
#define PHP_DNS_CAA 0x00002000
#endif
#ifndef PHP_DNS_MX
#define PHP_DNS_MX     0x00004000
#endif
#ifndef PHP_DNS_TXT
#define PHP_DNS_TXT    0x00008000
#endif
#ifndef PHP_DNS_A6
#define PHP_DNS_A6     0x01000000
#endif
#ifndef PHP_DNS_SRV
#define PHP_DNS_SRV    0x02000000
#endif
#ifndef PHP_DNS_NAPTR
#define PHP_DNS_NAPTR  0x04000000
#endif
#ifndef PHP_DNS_AAAA
#define PHP_DNS_AAAA   0x08000000
#endif
#ifndef PHP_DNS_ANY
#define PHP_DNS_ANY    0x10000000
#endif
#ifndef PHP_DNS_NUM_TYPES
#define PHP_DNS_NUM_TYPES	13	/* Number of DNS Types Supported by PHP currently */
#endif
#ifndef PHP_DNS_ALL
#define PHP_DNS_ALL   (PHP_DNS_A|PHP_DNS_NS|PHP_DNS_CNAME|PHP_DNS_SOA|PHP_DNS_PTR|PHP_DNS_HINFO|PHP_DNS_CAA|PHP_DNS_MX|PHP_DNS_TXT|PHP_DNS_A6|PHP_DNS_SRV|PHP_DNS_NAPTR|PHP_DNS_AAAA)
#endif
typedef union {
	HEADER qb1;
	uint8_t qb2[65536];
} querybuf;

#define arginfo_checkdnsrr arginfo_dns_check_record

PHP_FUNCTION(dns_check_record)
{
	HEADER *hp;
	querybuf answer = {0};
	char *hostname;
	size_t hostname_len;
	size_t rectype_len = 0;
	zend_string *rectype = NULL;
	int type = DNS_T_MX, i;

	if (zend_parse_parameters(ZEND_NUM_ARGS(), "s|s", &hostname, &hostname_len, &rectype, &rectype_len) == FAILURE) {
		return;
	}

	if (hostname_len == 0) {
		php_error_docref(NULL, E_WARNING, "Host cannot be empty");
		RETURN_FALSE;
	}

	php_error_docref(NULL, E_WARNING, "dns_check_record() always returns false in PHP.wasm.");

    RETURN_FALSE;
}

/* {{{ Get any Resource Record corresponding to a given Internet host name */

PHP_FUNCTION(dns_get_record)
{
	char *hostname;
	size_t hostname_len;
	zend_long type_param = PHP_DNS_ANY;
	zval *authns = NULL, *addtl = NULL;
	int type_to_fetch;
	int dns_errno;
	HEADER *hp;
	querybuf answer = {0};
	uint8_t *cp = NULL, *end = NULL;
	int n, qd, an, ns = 0, ar = 0;
	int type, first_query = 1, store_results = 1;
	zend_bool raw = 0;

	if (zend_parse_parameters(ZEND_NUM_ARGS(), "s|lz!z!b",
			&hostname, &hostname_len, &type_param, &authns, &addtl, &raw) == FAILURE) {
		return;
	}

	if (authns) {
		array_init(authns);
		if (!authns) {
    		RETURN_FALSE;
		}
	}
	if (addtl) {
		array_init(addtl);
		if (!addtl) {
    		RETURN_FALSE;
		}
	}

	php_error_docref(NULL, E_WARNING, "dns_get_record() always returns an empty array in PHP.wasm.");

	/* Initialize the return array */
	array_init(return_value);
}

/* }}} */

/* {{{ Get MX records corresponding to a given Internet host name */

#define arginfo_getmxrr arginfo_dns_get_mx

PHP_FUNCTION(dns_get_mx)
{
	char *hostname;
	size_t hostname_len;
	zval *mx_list, *weight_list = NULL;
	int count, qdc;
	u_short type, weight;
	querybuf answer = {0};
	char buf[MAXHOSTNAMELEN] = {0};
	HEADER *hp;
	uint8_t *cp, *end;
	int i;

	ZEND_PARSE_PARAMETERS_START(2, 3)
		Z_PARAM_STRING(hostname, hostname_len)
		Z_PARAM_ZVAL(mx_list)
		Z_PARAM_OPTIONAL
		Z_PARAM_ZVAL(weight_list)
	ZEND_PARSE_PARAMETERS_END();

	array_init(mx_list);
	if (!mx_list) {
        RETURN_FALSE;
	}

	if (weight_list) {
		array_init(weight_list);
		if (!weight_list) {
    		RETURN_FALSE;
		}
	}

	php_error_docref(NULL, E_WARNING, "dns_get_mx() always returns an empty array in PHP.wasm.");

    RETURN_FALSE;
}
/* }}} */


