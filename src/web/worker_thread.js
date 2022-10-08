const {
    Worker, isMainThread, parentPort, workerData
  } = require('node:worker_threads');
  
  if (isMainThread) {
        const worker = new Worker(__filename);
        worker.on('message', console.log);
        worker.on('error', console.log);
        worker.on('exit', (code) => {
          if (code !== 0)
            reject(new Error(`Worker stopped with exit code ${code}`));
            console.log("exit");
        });
  } else {
    require('./web-worker');
  }