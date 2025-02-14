/* {{{ includes */
#include "php.h"
#include "php_network.h"
#include "zend_API.h"
#include "dns_polyfill.h"
#include "ext/standard/info.h"

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

typedef union {
	HEADER qb1;
	uint8_t qb2[65536];
} querybuf;

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

/* {{{ PHP_MINFO_FUNCTION */
PHP_MINFO_FUNCTION(dns_polyfill)
{
	php_info_print_table_start();
	php_info_print_table_row(2, "dns_polyfill support", "enabled");
	php_info_print_table_end();
}
/* }}} */

PHP_MINIT_FUNCTION(dns_polyfill)
{
	REGISTER_LONG_CONSTANT("DNS_A", PHP_DNS_A, CONST_CS | CONST_PERSISTENT);
	REGISTER_LONG_CONSTANT("DNS_NS", PHP_DNS_NS, CONST_CS | CONST_PERSISTENT);
	REGISTER_LONG_CONSTANT("DNS_CNAME", PHP_DNS_CNAME, CONST_CS | CONST_PERSISTENT);
	REGISTER_LONG_CONSTANT("DNS_SOA", PHP_DNS_SOA, CONST_CS | CONST_PERSISTENT);
	REGISTER_LONG_CONSTANT("DNS_PTR", PHP_DNS_PTR, CONST_CS | CONST_PERSISTENT);
	REGISTER_LONG_CONSTANT("DNS_HINFO", PHP_DNS_HINFO, CONST_CS | CONST_PERSISTENT);
	REGISTER_LONG_CONSTANT("DNS_CAA", PHP_DNS_CAA, CONST_CS | CONST_PERSISTENT);
	REGISTER_LONG_CONSTANT("DNS_MX", PHP_DNS_MX, CONST_CS | CONST_PERSISTENT);
	REGISTER_LONG_CONSTANT("DNS_TXT", PHP_DNS_TXT, CONST_CS | CONST_PERSISTENT);
	REGISTER_LONG_CONSTANT("DNS_SRV", PHP_DNS_SRV, CONST_CS | CONST_PERSISTENT);
	REGISTER_LONG_CONSTANT("DNS_NAPTR", PHP_DNS_NAPTR, CONST_CS | CONST_PERSISTENT);
	REGISTER_LONG_CONSTANT("DNS_AAAA", PHP_DNS_AAAA, CONST_CS | CONST_PERSISTENT);
	REGISTER_LONG_CONSTANT("DNS_A6", PHP_DNS_A6, CONST_CS | CONST_PERSISTENT);
	REGISTER_LONG_CONSTANT("DNS_ANY", PHP_DNS_ANY, CONST_CS | CONST_PERSISTENT);
	REGISTER_LONG_CONSTANT("DNS_ALL", PHP_DNS_ALL, CONST_CS | CONST_PERSISTENT);

	return SUCCESS;
}

PHP_MSHUTDOWN_FUNCTION(dns_polyfill)
{
	return SUCCESS;
}

/* {{{ dns_polyfill_functions[] */
const zend_function_entry dns_polyfill_functions[] = {
	ZEND_FE(dns_get_mx, arginfo_dns_get_mx)
		ZEND_FALIAS(getmxrr, dns_get_mx, arginfo_getmxrr)
			ZEND_FE(dns_check_record, arginfo_dns_check_record)
				ZEND_FALIAS(checkdnsrr, dns_check_record, arginfo_checkdnsrr)
					ZEND_FE(dns_get_record, arginfo_dns_get_record)
						ZEND_FE_END};
/* }}} */

/* {{{ dns_polyfill_module_entry */
zend_module_entry dns_polyfill_module_entry = {
	STANDARD_MODULE_HEADER,
	"dns_polyfill",				 /* Extension name */
	dns_polyfill_functions,		 /* zend_function_entry */
	PHP_MINIT(dns_polyfill),	 /* PHP_MINIT - Module initialization */
	PHP_MSHUTDOWN(dns_polyfill), /* PHP_MSHUTDOWN - Module shutdown */
	NULL,						 /* PHP_RINIT - Request initialization */
	NULL,						 /* PHP_RSHUTDOWN - Request shutdown */
	PHP_MINFO(dns_polyfill),	 /* PHP_MINFO - Module info */
	PHP_DNS_POLYFILL_VERSION,	 /* Version */
	STANDARD_MODULE_PROPERTIES};
/* }}} */