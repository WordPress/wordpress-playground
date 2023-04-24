import { runCli } from "./run-cli";
import { startServer } from "./start-server";


if (process.env.NX_FILE_TO_RUN) {
  startServer();
} else {
  runCli()
}
