import http from 'http'
import WPNow from "./wp-now"
import { HTTPMethod, PHPRequestHeaders } from '@php-wasm/common';
import { downloadWordPress } from './download-wordpress';


const PORT = 8881;

async function startServer() {
  const wpNow = await WPNow.create()
  await downloadWordPress()
  wpNow.mountWordpress()
  const listener = http.createServer(async (req, res) => {
    try {
      const result = await wpNow.php.request({
        url: req.url,
        method: req.method as HTTPMethod,
        headers: req.headers as PHPRequestHeaders
      });

      console.log({
        path: req.url,
        method: req.method,
        result: result.text
      })
      res.writeHead(result.httpStatusCode, wpNow.cleanHeaders(result.headers));
      res.end(result.text);
    } catch (error) {
      console.log(error)
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(error.message);
    }
  }).listen(PORT);

  listener.on('error', (err) => {
    console.log('wp-now found an error: ' + err)
  })
  listener.on('listening', () => {
    console.log('wp-now started at http://localhost:' + PORT)
  } )
}

startServer();
