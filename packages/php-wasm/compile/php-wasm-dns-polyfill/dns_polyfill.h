#ifndef PHP_WASM_DNS_POLYFILL_H
#define PHP_WASM_DNS_POLYFILL_H

#ifndef PHP_DNS_A
#define PHP_DNS_A 0x00000001
#endif
#ifndef PHP_DNS_NS
#define PHP_DNS_NS 0x00000002
#endif
#ifndef PHP_DNS_CNAME
#define PHP_DNS_CNAME 0x00000010
#endif
#ifndef PHP_DNS_SOA
#define PHP_DNS_SOA 0x00000020
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
#define PHP_DNS_MX 0x00004000
#endif
#ifndef PHP_DNS_TXT
#define PHP_DNS_TXT 0x00008000
#endif
#ifndef PHP_DNS_A6
#define PHP_DNS_A6 0x01000000
#endif
#ifndef PHP_DNS_SRV
#define PHP_DNS_SRV 0x02000000
#endif
#ifndef PHP_DNS_NAPTR
#define PHP_DNS_NAPTR 0x04000000
#endif
#ifndef PHP_DNS_AAAA
#define PHP_DNS_AAAA 0x08000000
#endif
#ifndef PHP_DNS_ANY
#define PHP_DNS_ANY 0x10000000
#endif
#ifndef PHP_DNS_NUM_TYPES
#define PHP_DNS_NUM_TYPES 13 /* Number of DNS Types Supported by PHP currently */
#endif
#ifndef PHP_DNS_ALL
#define PHP_DNS_ALL (PHP_DNS_A | PHP_DNS_NS | PHP_DNS_CNAME | PHP_DNS_SOA | PHP_DNS_PTR | PHP_DNS_HINFO | PHP_DNS_CAA | PHP_DNS_MX | PHP_DNS_TXT | PHP_DNS_A6 | PHP_DNS_SRV | PHP_DNS_NAPTR | PHP_DNS_AAAA)
#endif

extern zend_module_entry dns_polyfill_module_entry;
#define phpext_dns_polyfill_ptr &dns_polyfill_module_entry

ZEND_BEGIN_ARG_INFO_EX(arginfo_dns_check_record, 0, 0, 1)
ZEND_ARG_INFO(0, host)
ZEND_ARG_INFO(0, type)
ZEND_END_ARG_INFO()

#define arginfo_checkdnsrr arginfo_dns_check_record

PHP_FUNCTION(dns_check_record);

ZEND_BEGIN_ARG_INFO_EX(arginfo_dns_get_record, 0, 0, 1)
ZEND_ARG_INFO(0, hostname)
ZEND_ARG_INFO(0, type)
ZEND_ARG_ARRAY_INFO(1, authns, 1)
ZEND_ARG_ARRAY_INFO(1, addtl, 1)
ZEND_ARG_INFO(0, raw)
ZEND_END_ARG_INFO()

PHP_FUNCTION(dns_get_record);

ZEND_BEGIN_ARG_INFO_EX(arginfo_dns_get_mx, 0, 0, 2)
ZEND_ARG_INFO(0, hostname)
ZEND_ARG_INFO(1, mxhosts) /* ARRAY_INFO(1, mxhosts, 1) */
ZEND_ARG_INFO(1, weight)  /* ARRAY_INFO(1, weight, 1) */
ZEND_END_ARG_INFO()

#define arginfo_getmxrr arginfo_dns_get_mx

PHP_FUNCTION(dns_get_mx);

#define PHP_DNS_POLYFILL_VERSION "1.0.0"

#endif // PHP_WASM_DNS_POLYFILL_H