
import { connectToPlayground } from './wp-client'
import { login } from './features/login'

const iframe = document.getElementById('wp') as HTMLIFrameElement;
const playground = connectToPlayground(iframe, '/');

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

await login(playground, 'admin', 'password');
console.log("logged in?");

