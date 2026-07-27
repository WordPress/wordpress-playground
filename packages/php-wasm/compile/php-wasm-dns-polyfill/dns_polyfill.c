/* {{{ includes */
#include "php.h"
#include "php_network.h"
#include "zend_API.h"
#include "dns_polyfill.h"
#include "ext/standard/info.h"
#include <emscripten.h>
#include <stdlib.h>
#include <string.h>

/* ZEND_FE_END was added in PHP 5.3.7; provide fallback for PHP 5.2 */
#ifndef ZEND_FE_END
#define ZEND_FE_END {NULL, NULL, NULL}
#endif

/* TSRMLS macros were removed in PHP 7; provide empty fallbacks */
#ifndef TSRMLS_CC
#define TSRMLS_CC
#endif

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

/* Node returns tab-separated, hex-encoded fields. Browsers have no resolver
 * syscall, so the bridge returns NULL and the public functions fail normally. */
#ifdef PLAYGROUND_JSPI
EM_ASYNC_JS(char *, wasm_dns_resolve, (const char *host, const char *type), {
	if (typeof Module['userSpace'] === 'undefined' || !Module['userSpace'].dnsResolve) return 0;
	const value = await Module['userSpace'].dnsResolve(UTF8ToString(host), UTF8ToString(type));
	const size = lengthBytesUTF8(value) + 1;
	const result = _malloc(size);
	stringToUTF8(value, result, size);
	return result;
});
#else
EM_JS(char *, wasm_dns_resolve, (const char *host, const char *type), {
	if (typeof Module['userSpace'] === 'undefined' || !Module['userSpace'].dnsResolve) return 0;
	return Asyncify.handleSleep((wakeUp) => {
		Module['userSpace'].dnsResolve(UTF8ToString(host), UTF8ToString(type))
			.then((value) => {
				const size = lengthBytesUTF8(value) + 1;
				const result = _malloc(size);
				stringToUTF8(value, result, size);
				wakeUp(result);
			})
			.catch(() => wakeUp(0));
	});
});
#endif

static char *dns_field(char **cursor)
{
	char *value = *cursor, *delimiter;
	if (!value) return NULL;
	delimiter = strchr(value, '\t');
	if (delimiter) { *delimiter = '\0'; *cursor = delimiter + 1; }
	else *cursor = NULL;
	return value;
}

static char *dns_decode(const char *encoded)
{
	size_t i, length;
	char *decoded;
	if (!encoded || strlen(encoded) % 2) return NULL;
	length = strlen(encoded) / 2;
	decoded = emalloc(length + 1);
	for (i = 0; i < length; i++) {
		char byte[3] = { encoded[i * 2], encoded[i * 2 + 1], '\0' };
		decoded[i] = (char) strtol(byte, NULL, 16);
	}
	decoded[length] = '\0';
	return decoded;
}

/* PHP 5 copies strings only when the duplicate flag is supplied. */
static void dns_assoc_string(zval *record, const char *key, char *value)
{
#if PHP_MAJOR_VERSION >= 7
	add_assoc_string(record, key, value);
#else
	add_assoc_string(record, (char *) key, value, 1);
#endif
}

static void dns_append_string(zval *array, char *value)
{
#if PHP_MAJOR_VERSION >= 7
	add_next_index_string(array, value);
#else
	add_next_index_string(array, value, 1);
#endif
}

static void dns_add_string(zval *record, const char *key, const char *encoded)
{
	char *value = dns_decode(encoded);
	if (value) { dns_assoc_string(record, key, value); efree(value); }
}

static void dns_add_number(zval *record, const char *key, const char *encoded)
{
	char *value = dns_decode(encoded);
	if (value) { add_assoc_long(record, (char *) key, strtol(value, NULL, 10)); efree(value); }
}

static void dns_add_records(zval *records, const char *host, char *response)
{
	char *line = response;
	while (line && *line) {
		char *next = strchr(line, '\n'), *cursor, *type;
		if (next) *next = '\0';
		cursor = line;
		type = dns_field(&cursor);
		if (type && cursor) {
#if PHP_MAJOR_VERSION >= 7
			zval record_value;
			zval *record = &record_value;
#else
			zval *record;
			MAKE_STD_ZVAL(record);
#endif
			array_init(record);
			dns_assoc_string(record, "host", (char *) host);
			dns_assoc_string(record, "class", "IN");
			add_assoc_long(record, "ttl", 0);
			dns_assoc_string(record, "type", type);
			if (!strcmp(type, "A")) dns_add_string(record, "ip", dns_field(&cursor));
			else if (!strcmp(type, "AAAA")) dns_add_string(record, "ipv6", dns_field(&cursor));
			else if (!strcmp(type, "CNAME") || !strcmp(type, "NS") || !strcmp(type, "PTR")) dns_add_string(record, "target", dns_field(&cursor));
			else if (!strcmp(type, "MX")) { dns_add_number(record, "pri", dns_field(&cursor)); dns_add_string(record, "target", dns_field(&cursor)); }
			else if (!strcmp(type, "SRV")) { dns_add_number(record, "pri", dns_field(&cursor)); dns_add_number(record, "weight", dns_field(&cursor)); dns_add_number(record, "port", dns_field(&cursor)); dns_add_string(record, "target", dns_field(&cursor)); }
			else if (!strcmp(type, "CAA")) { dns_add_number(record, "flags", dns_field(&cursor)); dns_add_string(record, "tag", dns_field(&cursor)); dns_add_string(record, "value", dns_field(&cursor)); }
			else if (!strcmp(type, "TXT")) {
#if PHP_MAJOR_VERSION >= 7
				zval entries_value;
				zval *entries = &entries_value;
#else
				zval *entries;
				MAKE_STD_ZVAL(entries);
#endif
				dns_add_string(record, "txt", dns_field(&cursor));
				array_init(entries);
				while (cursor) { char *entry = dns_decode(dns_field(&cursor)); if (entry) { dns_append_string(entries, entry); efree(entry); } }
				add_assoc_zval(record, "entries", entries);
			}
			else if (!strcmp(type, "SOA")) {
				const char *keys[] = { "mname", "rname", "serial", "refresh", "retry", "expire", "minimum" }; int i;
				for (i = 0; i < 7; i++) { if (i < 2) dns_add_string(record, keys[i], dns_field(&cursor)); else dns_add_number(record, keys[i], dns_field(&cursor)); }
			}
			else if (!strcmp(type, "NAPTR")) {
				const char *keys[] = { "order", "pref", "flags", "services", "regex", "replacement" }; int i;
				for (i = 0; i < 6; i++) { if (i < 2) dns_add_number(record, keys[i], dns_field(&cursor)); else dns_add_string(record, keys[i], dns_field(&cursor)); }
			}
			add_next_index_zval(records, record);
		}
		line = next ? next + 1 : NULL;
	}
}

static int dns_resolve(zval *records, const char *host, const char *type)
{
	char *response = wasm_dns_resolve(host, type);
	if (!response) return 0;
	dns_add_records(records, host, response);
	free(response);
	return 1;
}

static const char *dns_type(const char *type)
{
	if (!strcasecmp(type, "A") || !strcasecmp(type, "AAAA") || !strcasecmp(type, "CAA") || !strcasecmp(type, "CNAME") || !strcasecmp(type, "MX") || !strcasecmp(type, "NAPTR") || !strcasecmp(type, "NS") || !strcasecmp(type, "PTR") || !strcasecmp(type, "SOA") || !strcasecmp(type, "SRV") || !strcasecmp(type, "TXT")) return type;
	return NULL;
}

static void dns_resolve_mask(zval *records, const char *host, long mask)
{
	const long supported = PHP_DNS_A | PHP_DNS_NS | PHP_DNS_CNAME | PHP_DNS_SOA |
		PHP_DNS_PTR | PHP_DNS_CAA | PHP_DNS_MX | PHP_DNS_TXT | PHP_DNS_SRV |
		PHP_DNS_NAPTR | PHP_DNS_AAAA;
	struct dns_name { long mask; const char *name; } types[] = {
		{ PHP_DNS_A, "A" }, { PHP_DNS_NS, "NS" }, { PHP_DNS_CNAME, "CNAME" }, { PHP_DNS_SOA, "SOA" }, { PHP_DNS_PTR, "PTR" }, { PHP_DNS_CAA, "CAA" }, { PHP_DNS_MX, "MX" }, { PHP_DNS_TXT, "TXT" }, { PHP_DNS_SRV, "SRV" }, { PHP_DNS_NAPTR, "NAPTR" }, { PHP_DNS_AAAA, "AAAA" }
	};
	int i;
	if (mask == PHP_DNS_ANY || mask == PHP_DNS_ALL) mask = supported;
	else if (mask & ~supported) {
		php_error_docref(NULL TSRMLS_CC, E_WARNING, "Some requested DNS record types are not supported in PHP.wasm.");
		mask &= supported;
	}
	for (i = 0; i < (int) (sizeof(types) / sizeof(types[0])); i++) if (mask & types[i].mask) dns_resolve(records, host, types[i].name);
}

PHP_FUNCTION(dns_check_record)
{
	char *hostname;
#if PHP_MAJOR_VERSION >= 7
	size_t hostname_len;
	size_t rectype_len = 0;
	char *rectype = NULL;
#else
	int hostname_len;
	int rectype_len = 0;
	char *rectype = NULL;
#endif
	const char *type;
	zval records;

	if (zend_parse_parameters(ZEND_NUM_ARGS() TSRMLS_CC, "s|s", &hostname, &hostname_len, &rectype, &rectype_len) == FAILURE) {
		return;
	}

	if (hostname_len == 0) {
		php_error_docref(NULL TSRMLS_CC, E_WARNING, "Host cannot be empty");
		RETURN_FALSE;
	}

	type = rectype ? dns_type(rectype) : "MX";
	if (!type) {
		php_error_docref(NULL TSRMLS_CC, E_WARNING, "Invalid DNS record type");
		RETURN_FALSE;
	}
	array_init(&records);
	dns_resolve(&records, hostname, type);
	if (zend_hash_num_elements(Z_ARRVAL(records))) {
		zval_ptr_dtor(&records);
		RETURN_TRUE;
	}
	zval_ptr_dtor(&records);
	RETURN_FALSE;
}

/* {{{ Get any Resource Record corresponding to a given Internet host name */

PHP_FUNCTION(dns_get_record)
{
	char *hostname;
#if PHP_MAJOR_VERSION >= 7
	size_t hostname_len;
	zend_long type_param = PHP_DNS_ANY;
#else
	int hostname_len;
	long type_param = PHP_DNS_ANY;
#endif
	zval *authns = NULL, *addtl = NULL;
	zend_bool raw = 0;

	if (zend_parse_parameters(ZEND_NUM_ARGS() TSRMLS_CC, "s|lz!z!b",
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

	array_init(return_value);
	if (!hostname_len) return;
	if (raw) {
		php_error_docref(NULL TSRMLS_CC, E_WARNING, "Raw DNS response mode is not supported in PHP.wasm.");
		return;
	}
	dns_resolve_mask(return_value, hostname, type_param);
}

/* }}} */

/* {{{ Get MX records corresponding to a given Internet host name */

PHP_FUNCTION(dns_get_mx)
{
	char *hostname;
#if PHP_MAJOR_VERSION >= 7
	size_t hostname_len;
#else
	int hostname_len;
#endif
	zval *mx_list, *weight_list = NULL;
	zval records;

#if PHP_MAJOR_VERSION >= 7
	ZEND_PARSE_PARAMETERS_START(2, 3)
		Z_PARAM_STRING(hostname, hostname_len)
		Z_PARAM_ZVAL(mx_list)
		Z_PARAM_OPTIONAL
		Z_PARAM_ZVAL(weight_list)
	ZEND_PARSE_PARAMETERS_END();
#else
	if (zend_parse_parameters(ZEND_NUM_ARGS() TSRMLS_CC, "sz|z", &hostname, &hostname_len, &mx_list, &weight_list) == FAILURE) {
		return;
	}
#endif

#if PHP_MAJOR_VERSION >= 7
	mx_list = zend_try_array_init(mx_list);
	if (!mx_list) return;
	if (weight_list) {
		weight_list = zend_try_array_init(weight_list);
		if (!weight_list) return;
	}
#else
	array_init(mx_list);
	if (weight_list) array_init(weight_list);
#endif

	if (!hostname_len) RETURN_FALSE;
	array_init(&records);
	dns_resolve(&records, hostname, "MX");
	if (!zend_hash_num_elements(Z_ARRVAL(records))) {
		zval_ptr_dtor(&records);
		RETURN_FALSE;
	}
#if PHP_MAJOR_VERSION >= 7
	{
		zval *record;
		ZEND_HASH_FOREACH_VAL(Z_ARRVAL(records), record) {
			zval *target = zend_hash_str_find(Z_ARRVAL_P(record), "target", sizeof("target") - 1);
			zval *priority = zend_hash_str_find(Z_ARRVAL_P(record), "pri", sizeof("pri") - 1);
			if (target) dns_append_string(mx_list, Z_STRVAL_P(target));
			if (weight_list && priority) add_next_index_long(weight_list, Z_LVAL_P(priority));
		} ZEND_HASH_FOREACH_END();
	}
#else
	{
		HashPosition position;
		zval **record, **target, **priority;
		for (zend_hash_internal_pointer_reset_ex(Z_ARRVAL(records), &position); zend_hash_get_current_data_ex(Z_ARRVAL(records), (void **) &record, &position) == SUCCESS; zend_hash_move_forward_ex(Z_ARRVAL(records), &position)) {
			if (zend_hash_find(Z_ARRVAL_PP(record), "target", sizeof("target"), (void **) &target) == SUCCESS) dns_append_string(mx_list, Z_STRVAL_PP(target));
			if (weight_list && zend_hash_find(Z_ARRVAL_PP(record), "pri", sizeof("pri"), (void **) &priority) == SUCCESS) add_next_index_long(weight_list, Z_LVAL_PP(priority));
		}
	}
#endif
	zval_ptr_dtor(&records);
	RETURN_TRUE;
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

/* {{{ arginfo definitions */
ZEND_BEGIN_ARG_INFO_EX(arginfo_dns_check_record, 0, 0, 1)
ZEND_ARG_INFO(0, host)
ZEND_ARG_INFO(0, type)
ZEND_END_ARG_INFO()

#define arginfo_checkdnsrr arginfo_dns_check_record

ZEND_BEGIN_ARG_INFO_EX(arginfo_dns_get_record, 0, 0, 1)
ZEND_ARG_INFO(0, hostname)
ZEND_ARG_INFO(0, type)
ZEND_ARG_ARRAY_INFO(1, authns, 1)
ZEND_ARG_ARRAY_INFO(1, addtl, 1)
ZEND_ARG_INFO(0, raw)
ZEND_END_ARG_INFO()

ZEND_BEGIN_ARG_INFO_EX(arginfo_dns_get_mx, 0, 0, 2)
ZEND_ARG_INFO(0, hostname)
ZEND_ARG_INFO(1, mxhosts)
ZEND_ARG_INFO(1, weight)
ZEND_END_ARG_INFO()

#define arginfo_getmxrr arginfo_dns_get_mx
/* }}} */

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
