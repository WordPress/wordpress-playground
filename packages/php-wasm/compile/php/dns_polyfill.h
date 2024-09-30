#ifndef PHP_WASM_DNS_POLYFILL_H
#define PHP_WASM_DNS_POLYFILL_H

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

void register_dns_polyfill_symbols(int module_number);

#endif // PHP_WASM_DNS_POLYFILL_H