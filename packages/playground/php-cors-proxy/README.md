## PHP CORS Proxy

A PHP CORS proxy need to integrate git clone via fetch().

### Configuration

In order to avoid running a CORS proxy that is easy to abuse by default, the proxy requires administrators to explicitly declare what to do about rate-limiting, by doing one of the following:

- Provide a rate-limiting function `playground_cors_proxy_maybe_rate_limit()`.
- Define a truthy `PLAYGROUND_CORS_PROXY_DISABLE_RATE_LIMIT` to explicitly disable rate-limiting.

These can be provided in an optional `cors-proxy-config.php` file in the same directory as `cors-proxy.php` or in a PHP file that is loaded before all PHP execution via the [`auto_prepend_file`](https://www.php.net/manual/en/ini.core.php#ini.auto-prepend-file) php.ini option.

Allowed browser origins may be overridden with
`PLAYGROUND_CORS_PROXY_SUPPORTED_ORIGIN_RULES`. Each entry must be an array with
one of these types:

- `match-exact` compares the complete origin.
- `match-subdomain` matches exactly one hostname label beneath `host`, using
  the configured scheme and port.

Invalid entries and unrecognized rule types are ignored.

```php
define('PLAYGROUND_CORS_PROXY_SUPPORTED_ORIGIN_RULES', [
    [
        'type' => 'match-exact',
        'origin' => 'https://playground.example.com',
    ],
    [
        'type' => 'match-subdomain',
        'scheme' => 'https',
        'host' => 'preview.playground.example.com',
        'port' => null,
    ],
]);
```

The standalone proxy deployment accepts origins through the space-separated
`CUSTOM_SUPPORTED_ORIGINS_SPACE_SEPARATED` environment variable. For example,
`https://playground.example.com https://*.preview.playground.example.com`
generates the typed PHP rules above. The generator validates and parses these
values before deployment. Setting custom rules replaces the built-in rules, so
deployments must retain every origin they still need.

The previous `PLAYGROUND_CORS_PROXY_SUPPORTED_ORIGINS` string list is no longer
supported.

### Range requests

The proxy forwards `Range` to the target and relays `206` and `416`
responses along with `Content-Range`, `Accept-Ranges`, and `ETag`. When a
request has a range, the proxy asks the target for
`Accept-Encoding: identity` so byte offsets refer to the unencoded body.

The proxy relays the target's `Content-Length` unless the target sends a
chunked response. `HEAD` requests relay it too, so clients can learn a file's
size before requesting ranges. If the target fails partway through a
response, the proxy ends the response early without adding anything to the
body, and the client sees fewer bytes than `Content-Length` announced.

Every response relayed from a target has `Cache-Control: no-cache`, which
the WP Cloud edge cache honors by not storing the response. Keep it that
way: every range of a file shares one proxy URL, so a cached slice could be
served for another range.

**Workaround:** As of 2026-09-26, the WP Cloud front end of the production
deployment strips the `Range` header before the request reaches PHP. Until
that changes, clients can send the same value as
`X-Cors-Proxy-Range: bytes=0-15`. The proxy forwards it to the target as
`Range` and never forwards `X-Cors-Proxy-Range` itself.

Clients may send both headers with the same value, so they keep working once
the workaround is removed. `Range` takes priority: when both arrive with the
same value, the proxy forwards `Range` unchanged. When they disagree, the
proxy responds with `400 Bad Request` rather than guess which one is right.

Once `Range` reaches PHP on WP Cloud, remove the workaround from
`cors-proxy.php` along with this note.

### Usage

Request http://127.0.0.1:5263/proxy.php/https://w.org/?test=1 to get the response from https://w.org/?test=1 plus the CORS headers.

### Development and testing

- Run `dev.sh` to start a local server, then go to http://127.0.0.1:5263/proxy.php/https://w.org/ and confirm it worked.
- Run `test.sh` to run the PHPUnit tests and the end-to-end tests in `tests/e2e`, confirm they all pass.
- Run `test-watch.sh` to run PHPUnit tests in watch mode.

### Design decisions

- Stream data both ways, don't buffer.
- Don't pass auth headers in either direction.
    - Opt-in for request headers possible using `X-Cors-Proxy-Allowed-Request-Headers`.
- Refuse to request private IPs.
- Refuse to process requests other than GET, HEAD, POST, and OPTIONS.
- Refuse to process POST request body larger than, say, 100KB.
- Refuse to process responses larger than, say, 100MB.
