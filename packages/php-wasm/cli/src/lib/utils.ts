import * as net from 'net';

export function debugLog(...args: any[]) {
  if (process.env['DEV']) {
    console.log(...args);
  }
}

export async function findFreePorts(n: number) {
  const serversPromises: Promise<net.Server>[] = [];
  for (let i = 0; i < n; i++) {
    serversPromises.push(listenOnRandomPort());
  }

  const servers = await Promise.all(serversPromises);
  const ports: number[] = [];
  for (const server of servers) {
    const address = server.address()! as net.AddressInfo;
    ports.push(address.port);
    server.close();
  }

  return ports;
}

function listenOnRandomPort(): Promise<net.Server> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(0, () => {
      resolve(server);
    });
  });
}
