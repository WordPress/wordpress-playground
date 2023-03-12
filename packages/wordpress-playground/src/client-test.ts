
import { consumeAPI } from '@wordpress/php-wasm'
const iframe = document.getElementById('wp') as HTMLIFrameElement;
iframe.src = "/wordpress.html";
const playground = consumeAPI(iframe.contentWindow!) as any;

await new Promise((resolve) => iframe.onload = resolve);
await playground.onDownloadProgress(
    (x => { console.log('download progress', {x}) })
)
console.log("Calling is ready")
await playground.isReady();
console.log("Called is ready")
await new Promise((resolve) => setTimeout(resolve, 1000));
await playground.writeFile("/wordpress/test.php", "echo 'Hello World!';");
console.log(await playground.readFileAsText("/wordpress/test.php"));
console.log(await playground.listFiles("/"));
console.log("D");

import { login } from './wp-client';
await login(playground, 'admin', 'password');
console.log("logged in?");

