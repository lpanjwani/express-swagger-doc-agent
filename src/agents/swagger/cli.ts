import { agent } from "./agent";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { LoggingService } from "../../services/logging/logging.service";

const loggingService = new LoggingService("SwaggerDocAgent");

async function runSwaggerDocAgent() {
  const argv = await yargs(hideBin(process.argv))
    .option("modulesDir", {
      type: "array",
      demandOption: true,
      description: "List of modules directories",
    })
    .option("routerContextFiles", {
      type: "array",
      demandOption: true,
      description: "List of router context files",
    })
    .help().argv;

  loggingService.wait("Generating Documentation");

  await agent.run(
    argv.modulesDir as string[],
    argv.routerContextFiles as string[],
  );

  loggingService.success("Generating Documentation");

  process.exit(0);
}

runSwaggerDocAgent();
