"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/index.ts
var import_fs = require("fs");
var import_tls = require("tls");

// src/outbound-ws-to-tcp-proxy.ts
var import_dns = __toESM(require("dns"));
var import_util = __toESM(require("util"));
var import_net2 = __toESM(require("net"));
var import_http = __toESM(require("http"));
var import_ws = require("ws");

// src/utils.ts
var import_net = __toESM(require("net"));

// src/config.ts
var DEBUG = "DEBUG" in process.env ? process.env.DEBUG : false;

// src/utils.ts
function debugLog(...args2) {
  if (DEBUG) {
    console.log(...args2);
  }
}
async function findFreePorts(n) {
  const serversPromises = [];
  for (let i = 0; i < n; i++) {
    serversPromises.push(listenOnRandomPort());
  }
  const servers = await Promise.all(serversPromises);
  const ports = [];
  for (const server of servers) {
    const address = server.address();
    ports.push(address.port);
    server.close();
  }
  return ports;
}
function listenOnRandomPort() {
  return new Promise((resolve) => {
    const server = import_net.default.createServer();
    server.listen(0, () => {
      resolve(server);
    });
  });
}

// src/outbound-ws-to-tcp-proxy.ts
function log(...args2) {
  debugLog("[WS Server]", ...args2);
}
var lookup = import_util.default.promisify(import_dns.default.lookup);
function prependByte(chunk, byte) {
  if (typeof chunk === "string") {
    chunk = String.fromCharCode(byte) + chunk;
  } else if (chunk instanceof ArrayBuffer) {
    const buffer = new Uint8Array(chunk.byteLength + 1);
    buffer[0] = byte;
    buffer.set(new Uint8Array(chunk), 1);
    chunk = buffer.buffer;
  } else {
    throw new Error("Unsupported chunk type");
  }
  return chunk;
}
var COMMAND_CHUNK = 1;
var COMMAND_SET_SOCKETOPT = 2;
function addSocketOptionsSupportToWebSocketClass(WebSocketConstructor) {
  return class PHPWasmWebSocketConstructor extends WebSocketConstructor {
    CONNECTING = 0;
    OPEN = 1;
    CLOSING = 2;
    CLOSED = 3;
    send(chunk, callback) {
      return this.sendCommand(COMMAND_CHUNK, chunk, callback);
    }
    setSocketOpt(optionClass, optionName, optionValue) {
      return this.sendCommand(
        COMMAND_SET_SOCKETOPT,
        new Uint8Array([optionClass, optionName, optionValue]).buffer,
        () => {
        }
      );
    }
    sendCommand(commandType, chunk, callback) {
      return WebSocketConstructor.prototype.send.call(
        this,
        prependByte(chunk, commandType),
        callback
      );
    }
  };
}
function initOutboundWebsocketProxyServer(listenPort, listenHost = "127.0.0.1") {
  log(`Binding the WebSockets server to ${listenHost}:${listenPort}...`);
  const webServer = import_http.default.createServer((request, response) => {
    response.writeHead(403, { "Content-Type": "text/plain" });
    response.write(
      "403 Permission Denied\nOnly websockets are allowed here.\n"
    );
    response.end();
  });
  return new Promise((resolve) => {
    webServer.listen(listenPort, listenHost, function() {
      const wsServer = new import_ws.WebSocketServer({ server: webServer });
      wsServer.on("connection", onWsConnect);
      resolve(webServer);
    });
  });
}
async function onWsConnect(client, request) {
  const clientAddr = client._socket.remoteAddress;
  const clientLog = function(...args2) {
    log(" " + clientAddr + ": ", ...args2);
  };
  clientLog(
    "WebSocket connection from : " + clientAddr + " at URL " + (request ? request.url : client.upgradeReq.url)
  );
  clientLog(
    "Version " + client.protocolVersion + ", subprotocol: " + client.protocol
  );
  const reqUrl = new URL(`ws://0.0.0.0` + request.url);
  const reqTargetPort = Number(reqUrl.searchParams.get("port"));
  const reqTargetHost = reqUrl.searchParams.get("host");
  if (!reqTargetPort || !reqTargetHost) {
    clientLog("Missing host or port information");
    client.close(3e3);
    return;
  }
  let target;
  const recvQueue = [];
  function flushMessagesQueue() {
    while (recvQueue.length > 0) {
      const msg = recvQueue.pop();
      const commandType = msg[0];
      clientLog("flushing", { commandType }, msg);
      if (commandType === COMMAND_CHUNK) {
        target.write(msg.slice(1));
      } else if (commandType === COMMAND_SET_SOCKETOPT) {
        const SOL_SOCKET = 1;
        const SO_KEEPALIVE = 9;
        const IPPROTO_TCP = 6;
        const TCP_NODELAY = 1;
        if (msg[1] === SOL_SOCKET && msg[2] === SO_KEEPALIVE) {
          target.setKeepAlive(msg[3]);
        } else if (msg[1] === IPPROTO_TCP && msg[2] === TCP_NODELAY) {
          target.setNoDelay(msg[3]);
        }
      } else {
        clientLog("Unknown command type: " + commandType);
        process.exit();
      }
    }
  }
  client.on("message", function(msg) {
    recvQueue.unshift(msg);
    if (target) {
      flushMessagesQueue();
    }
  });
  client.on("close", function(code, reason) {
    clientLog(
      "WebSocket client disconnected: " + code + " [" + reason + "]"
    );
    target.end();
  });
  client.on("error", function(a) {
    clientLog("WebSocket client error: " + a);
    target.end();
  });
  let reqTargetIp;
  if (import_net2.default.isIP(reqTargetHost) === 0) {
    clientLog("resolving " + reqTargetHost + "... ");
    const resolution = await lookup(reqTargetHost);
    reqTargetIp = resolution.address;
    clientLog("resolved " + reqTargetHost + " -> " + reqTargetIp);
  } else {
    reqTargetIp = reqTargetHost;
  }
  clientLog(
    "Opening a socket connection to " + reqTargetIp + ":" + reqTargetPort
  );
  target = import_net2.default.createConnection(reqTargetPort, reqTargetIp, function() {
    clientLog("Connected to target");
    flushMessagesQueue();
  });
  target.on("data", function(data) {
    try {
      client.send(data);
    } catch (e) {
      clientLog("Client closed, cleaning up target");
      target.end();
    }
  });
  target.on("end", function() {
    clientLog("target disconnected");
    client.close();
  });
  target.on("error", function(e) {
    clientLog("target connection error", e);
    target.end();
    client.close(3e3);
  });
}

// src/inbound-tcp-to-ws-proxy.ts
var import_net3 = __toESM(require("net"));
var import_ws2 = require("ws");
function addTCPServerToWebSocketServerClass(wsListenPort, WebSocketServer2) {
  return class PHPWasmWebSocketServer extends WebSocketServer2 {
    constructor(options, callback) {
      const requestedPort = options.port;
      options.port = wsListenPort;
      listenTCPToWSProxy({
        tcpListenPort: requestedPort,
        wsConnectPort: wsListenPort
      });
      super(options, callback);
    }
  };
}
function log2(...args2) {
  debugLog("[TCP Server]", ...args2);
}
function listenTCPToWSProxy(options) {
  options = {
    wsConnectHost: "127.0.0.1",
    ...options
  };
  const { tcpListenPort, wsConnectHost, wsConnectPort } = options;
  const server = import_net3.default.createServer();
  server.on("connection", function handleConnection(tcpSource) {
    const inBuffer = [];
    const wsTarget = new import_ws2.WebSocket(
      `ws://${wsConnectHost}:${wsConnectPort}/`
    );
    wsTarget.binaryType = "arraybuffer";
    function wsSend(data) {
      wsTarget.send(new Uint8Array(data));
    }
    wsTarget.addEventListener("open", function() {
      log2("Outbound WebSocket connection established");
      while (inBuffer.length > 0) {
        wsSend(inBuffer.shift());
      }
    });
    wsTarget.addEventListener("message", (e) => {
      log2("WS->TCP message:", new TextDecoder().decode(e.data));
      tcpSource.write(Buffer.from(e.data));
    });
    wsTarget.addEventListener("close", () => {
      log2("WebSocket connection closed");
      tcpSource.end();
    });
    tcpSource.on("data", function(data) {
      log2("TCP->WS message:", data);
      if (wsTarget.readyState === import_ws2.WebSocket.OPEN) {
        while (inBuffer.length > 0) {
          wsSend(inBuffer.shift());
        }
        wsSend(data);
      } else {
        inBuffer.push(data);
      }
    });
    tcpSource.once("close", function() {
      log2("TCP connection closed");
      wsTarget.close();
    });
    tcpSource.on("error", function() {
      log2("TCP connection error");
      wsTarget.close();
    });
  });
  server.listen(tcpListenPort, function() {
    log2("TCP server listening");
  });
}

// src/php.ini
var php_default = "./php-SQD4XQQA.ini";

// src/index.ts
var args = process.argv.slice(2);
if (!args.length) {
  args = ["--help"];
}
var caBundlePath = __dirname + "/ca-bundle.crt";
if (!(0, import_fs.existsSync)(caBundlePath)) {
  (0, import_fs.writeFileSync)(caBundlePath, import_tls.rootCertificates.join("\n"));
}
async function main() {
  const { startPHP, getPHPLoaderModule } = await import("@wordpress/php-wasm/build/node/php.js");
  const phpVersion = process.env.PHP || "8.2";
  const [inboundProxyWsServerPort, outboundProxyWsServerPort] = await findFreePorts(2);
  await initOutboundWebsocketProxyServer(outboundProxyWsServerPort);
  const phpLoaderModule = await getPHPLoaderModule(phpVersion);
  const php = await startPHP(phpLoaderModule, "NODE", {
    ENV: {
      ...process.env,
      TERM: "xterm"
    },
    websocket: {
      url: (_, host, port) => {
        const query = new URLSearchParams({ host, port }).toString();
        return `ws://127.0.0.1:${outboundProxyWsServerPort}/?${query}`;
      },
      subprotocol: "binary",
      decorator: addSocketOptionsSupportToWebSocketClass,
      serverDecorator: addTCPServerToWebSocketServerClass.bind(
        null,
        inboundProxyWsServerPort
      )
    }
  });
  const hasMinusCOption = args.some((arg) => arg.startsWith("-c"));
  if (!hasMinusCOption) {
    args.unshift("-c", php_default);
  }
  php.writeFile(caBundlePath, import_tls.rootCertificates.join("\n"));
  args.unshift("-d", `openssl.cafile=${caBundlePath}`);
  php.cli(["php", ...args]).catch((result) => {
    if (result.name === "ExitStatus") {
      process.exit(result.status === void 0 ? 1 : result.status);
    }
    throw result;
  });
}
main();
