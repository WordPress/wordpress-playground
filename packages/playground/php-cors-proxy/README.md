## PHP CORS Proxy

A PHP CORS proxy need to integrate git clone via fetch().

### Usage

Request http://127.0.0.1:5263/proxy.php/https://w.org/?test=1 to get the response from https://w.org/?test=1 plus the CORS headers.

### Development and testing

-   Run `dev.sh` to start a local server, then go to http://127.0.0.1:5263/proxy.php/https://w.org/ and confirm it worked.
-   Run `test.sh` to run PHPUnit tests, confirm they all pass.
-   Run `test-watch.sh` to run PHPUnit tests in watch mode.

### Design decisions

-   Stream data both ways, don't buffer.
-   Don't pass auth headers in either direction.
-   Refuse to request private IPs.
-   Refuse to process non-GET non-POST non-OPTIONS requests.
-   Refuse to process POST request body larger than, say, 100KB.
-   Refuse to process responses larger than, say, 100MB.
