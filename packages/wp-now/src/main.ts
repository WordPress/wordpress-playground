import WPNow from "./wp-now"
import { HTTPMethod } from '@php-wasm/common';
import express from 'express';
import fileUpload from 'express-fileupload';


const PORT = 8881;

function generateMultipartFormDataString(json, boundary) {
  let multipartData = '';
  const eol = '\r\n';

  for (const key in json) {
    multipartData += `--${boundary}${eol}`;
    multipartData += `Content-Disposition: form-data; name="${key}"${eol}${eol}`;
    multipartData += `${json[key]}${eol}`;
  }

  multipartData += `--${boundary}--${eol}`;
  return multipartData;
}

const requestBodyToString = async (req) => await new Promise((resolve) => {
  let body = '';
  req.on('data', (chunk) => {
      body += chunk.toString(); // convert Buffer to string
  });
  req.on('end', () => {
      resolve(body);
  });
});


const app = express();
app.use(fileUpload());
async function startServer() {
  const wpNow = await WPNow.create()
  await wpNow.start()

  app.use('/', async (req, res) => {
    console.log('request>', req.url, req.method, req.headers['content-type'])
    try {
        const requestHeaders = {};
        if (req.rawHeaders && req.rawHeaders.length) {
            for (let i = 0; i < req.rawHeaders.length; i += 2) {
                requestHeaders[req.rawHeaders[i].toLowerCase()] = req.rawHeaders[i + 1];
            }
        }

        const body = requestHeaders['content-type']?.startsWith('multipart/form-data')
            ? generateMultipartFormDataString(
                req.body,
                requestHeaders['content-type'].split("; boundary=")[1]
            )
            : await requestBodyToString(req);

        const data = {
            url: req.url,
            headers: requestHeaders,
          method: req.method as HTTPMethod,
            files: Object.fromEntries(Object.entries((req as any).files || {}).map<any>(([key, file]: any) => ([key, {
                key,
                name: file.name,
                size: file.size,
                type: file.mimetype,
                arrayBuffer: () => file.data.buffer
            }]))),
            body: body as string,
        };
      const resp = await wpNow.php.request(data);
      res.statusCode = resp.httpStatusCode;
      Object.keys(resp.headers).forEach((key) => {
          res.setHeader(key, resp.headers[key]);
      });
      res.end(resp.bytes);
    } catch (e) {
        console.trace(e);
    }
  });

  app.listen(PORT, () => {
    console.log(`Server running at http://127.0.0.1:${PORT}/`);
  });

}

startServer();
