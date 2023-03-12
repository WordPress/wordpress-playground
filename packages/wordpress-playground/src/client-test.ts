import * as Comlink from 'comlink';

const iframe = document.getElementById('wp') as HTMLIFrameElement;
iframe.src = "/wordpress.html";
const playground = Comlink.wrap(Comlink.windowEndpoint(iframe.contentWindow!)) as any;
await new Promise((resolve) => iframe.onload = resolve);

console.log("Calling is ready")
await playground.isReady();
console.log("Called is ready")
await new Promise((resolve) => setTimeout(resolve, 1000));
await playground.php.writeFile("/wordpress/test.php", "echo 'Hello World!';");
console.log(await playground.php.readFileAsText("/wordpress/test.php"));
console.log(await playground.php.listFiles("/"));
console.log("D");
await playground.wp.login('admin', 'password');
console.log("logged in?");

