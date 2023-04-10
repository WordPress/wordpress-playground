import { exec } from 'child_process';

const installWordPress = () => {
  // Implement the logic to install WordPress here
};

const startServer = (port: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    exec(`echo "wp server --port=${port}"`, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout.trim());
      }
    });
  });
};

const stopServer = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    exec('echo "wp server --stop"', (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout.trim());
      }
    });
  });
};

const runCommand = (command: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout.trim());
      }
    });
  });
};

export { installWordPress, startServer, stopServer, runCommand };
