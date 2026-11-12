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

### Destination validation

The proxy resolves IPv4 addresses and rejects the request if any returned
address is private, reserved, or invalid. It pins the selected address for
the target URL's effective port: the explicit port, or 80 for HTTP and 443
for HTTPS. Custom ports remain supported. Empty DNS answers and port zero
are rejected.

cURL is restricted to IPv4 and connects directly to that pinned address.
Environment HTTP/SOCKS proxy settings are ignored because a forward proxy
could resolve the hostname independently and bypass destination validation.
Deployments that require an outbound forward proxy must enforce destination
validation there before adapting this behavior. IPv6-only targets are not
supported.

The URL's hostname remains the HTTP and TLS identity; cURL generates the
`Host` header including a custom port. Redirects are relayed to the caller
rather than followed by cURL, so a subsequent request goes through validation
again. Maintain outbound network rules that also deny private, loopback,
link-local, and metadata destinations as an independent layer of protection.

### Header isolation and framing

Header names and `Connection` nominations are matched case-insensitively. The
proxy reads the complete upstream header block before forwarding any of it, so
`Connection` can remove fields that appear before or after it. Response bodies
remain streamed; interim response fields and trailers are not relayed.

On requests, the proxy removes cookies (`Cookie` and `Cookie2`), `Host`,
`X-Kandelo-Proxy-Session`, and its internal `X-Cors-Proxy-*` control headers.
`X-Cors-Proxy-Allowed-Request-Headers` is consumed to determine `Authorization`
opt-in before being removed. Opt-in cannot override a blocked or
`Connection`-nominated field. The WP Cloud deployment's rate limiter explicitly
uses `X-Forwarded-For` and `X-IP-Proxy-Type`; these are removed from outgoing
requests without changing how the rate limiter reads them.

Both directions remove `Connection`, `Keep-Alive`, `Proxy-Authenticate`,
`Proxy-Authorization`, `TE`, `Trailer`, `Transfer-Encoding`, `Upgrade`, and every
field named by `Connection`. cURL generates outgoing request framing rather
than forwarding the client's `Content-Length`. For unchanged raw uploads it
uses PHP's server-provided input size when known, and chunked framing otherwise.
Reconstructed multipart uploads get cURL's new boundary and length.

Responses also remove `Set-Cookie2`, `Clear-Site-Data`, `Content-Security-Policy`,
`Content-Security-Policy-Report-Only`, `Cross-Origin-Opener-Policy`,
`Cross-Origin-Embedder-Policy`, `Cross-Origin-Resource-Policy`, `Vary`,
`X-Playground-Cors-Proxy`, `X-Kandelo-Proxy-Session`, and all `X-Spacefast-*`,
`X-Stattic-*`, and `Access-Control-*` fields. Existing cookie, authentication,
cache, HSTS, and server/CDN control-header filtering remains in place, including
`X-Accel-*`, `X-LiteSpeed-*`, sendfile instructions, and CDN cache controls.
Upstream fields cannot override headers already set by deployment configuration.

The proxy supplies its own CORS policy and legitimate `X-Playground-Cors-Proxy`
marker under the existing origin rules. It sends `Vary: Origin`, including on
preflight, denied-origin, and error responses, and
`Cross-Origin-Resource-Policy: cross-origin`. Upstream nominations cannot remove
these proxy-owned fields.

cURL removes upstream chunk framing. The PHP built-in server gets fresh
proxy-generated chunk framing; production servers receive plain body bytes and
generate downstream framing themselves. No upstream `Transfer-Encoding` is
forwarded, and any transfer encoding suppresses upstream `Content-Length`,
regardless of their order. HEAD and bodyless statuses do not generate chunks.
Content decompression in cURL is explicitly disabled, so unchanged compressed
bodies retain `Content-Encoding` and their correct `Content-Length` when no
transfer encoding is present. Any web-server compression or decoding must also
adjust response metadata. Unsolicited compressed transfer codings (for example,
`Transfer-Encoding: gzip, chunked`) are rejected by cURL with a proxy-generated
502 response; its error body carries no stale upstream encoding or length.
An upstream `Connection` nomination of a non-identity `Content-Encoding` also
gets a 502: removing that metadata would leave undecodable relayed bytes.

Size checks retain their existing declared-length semantics: POST requests of
1 MiB or larger and non-HEAD responses declaring 100 MiB or larger are rejected.
The proxy does not impose a hard byte-count limit on unknown-length streams.

### Range requests

The proxy forwards `Range` to the target and relays `206` and `416`
responses along with `Content-Range`, `Accept-Ranges`, and `ETag`. When a
request has a range, the proxy asks the target for
`Accept-Encoding: identity` so byte offsets refer to the unencoded body.

The proxy relays the target's `Content-Length` unless the target sends any
`Transfer-Encoding` or nominates `Content-Length` in `Connection`. `HEAD`
requests relay it too, so clients can learn a file's size before requesting ranges. `HEAD` requests also ask the target for
`Accept-Encoding: identity`, so the size matches the bytes ranges address.

If the target fails partway through a response, the proxy ends the response
early without adding anything to the body. When the client receives the
target's `Content-Length`, it sees fewer bytes than announced and can tell the
response is incomplete. When it doesn't, a server in front of PHP such as nginx
or Apache may still end the response normally, so the client can't tell it's
incomplete. That happens when the target sends a chunked response, and when a
server in front of PHP compresses the response and drops `Content-Length`. For
a `206`, compare the body length with `Content-Range` instead.

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

Run the suite through Nx with `npm exec -- nx test playground-php-cors-proxy`.
It requires PHP 8 or newer with curl and sockets, plus PHPUnit.

The suite covers the header policy through unit tests and real HTTP requests,
including mixed casing, repeated `Connection` fields, both nomination orders,
proxy-header forgery, gzip, conflicting transfer framing, delayed streaming,
range and HEAD requests, and raw, chunked, wrapped, and reconstructed uploads.

To additionally exercise a production SAPI, run the transport checks through
Apache 2.4 and PHP FastCGI. For example, on macOS with Apache and PHP installed:

```sh
CORS_PROXY_TEST_HTTPD=/usr/sbin/httpd npm exec -- nx test playground-php-cors-proxy
```

`CORS_PROXY_TEST_APACHE_MODULES` overrides the module directory (default
`/usr/libexec/apache2`), and `CORS_PROXY_TEST_PHP_CGI` overrides `php-cgi`
(default: alongside the PHP executable). Apache must support `mod_proxy_fcgi`
and loadable prefork, unixd, authz_core, proxy, and env modules. This optional
fixture binds unprivileged loopback ports, enables Authorization passthrough,
trusts response lengths from the proxy script, flushes FastCGI packets, and sets
`proxy-sendcl` so chunked request bodies reach PHP with a known length. Use an
Apache version supporting that setting. These fixture settings do not change
production deployment configuration. Other production stacks must likewise
make upload bodies available to PHP and configure response buffering as needed.

The custom-port test gives PHP's validation lookup a fixed loopback answer for
`proxy-target.test`, then uses the real handler to connect to the local
upstream. The upstream must return 200 and receive the original hostname and
port in its `Host` header. This verifies custom-port pinning; it does not count
DNS queries or simulate an attacker changing DNS answers.

### Design decisions

- Stream data both ways, don't buffer.
- Don't pass auth headers in either direction.
    - Opt-in for request headers possible using `X-Cors-Proxy-Allowed-Request-Headers`.
- Refuse to request private IPs.
- Refuse to process requests other than GET, HEAD, POST, and OPTIONS.
- Reject POST requests declaring at least 1 MiB.
- Reject non-HEAD responses declaring at least 100 MiB.
