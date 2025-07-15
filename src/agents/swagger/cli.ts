import { agent } from "./agent";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

async function runSwaggerDocAgent() {
  const argv = await yargs(hideBin(process.argv))
    .option("projectDir", {
      type: "string",
      demandOption: true,
      description: "Path to the project directory",
    })
    .option("routeDirectories", {
      type: "array",
      demandOption: true,
      description: "List of route directories",
    })
    .option("controllerDirectories", {
      type: "array",
      demandOption: true,
      description: "List of controller directories",
    })
    .help().argv;

  await agent.run(
    argv.projectDir as string,
    argv.routeDirectories as string[],
    argv.controllerDirectories as string[],
  );

  console.log("🎉 Documentation generation completed!");

  process.exit(0);
}

runSwaggerDocAgent();
