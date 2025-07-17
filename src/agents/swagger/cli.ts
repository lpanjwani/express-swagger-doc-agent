import { agent } from "./agent";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

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

  await agent.run(
    argv.modulesDir as string[],
    argv.routerContextFiles as string[],
  );

  console.log("🎉 Documentation generation completed!");

  process.exit(0);
}

runSwaggerDocAgent();
