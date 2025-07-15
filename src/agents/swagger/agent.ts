import {
  StateGraph,
  START,
  END,
  CompiledStateGraph,
} from "@langchain/langgraph";
import {
  ClassMethod,
  JavascriptAstService,
} from "../../services/javascript-ast/javascript-ast-service";
import {
  LoggingService,
  LogLevel,
} from "../../services/logging/logging.service";
import { FilesService } from "../../services/files/files-service";
import { NodeNames } from "./enum/node-names.enum";
import { StateAnnotation } from "./state/state-annotation";
import { GenerativeAIService } from "../../services/genai/genai.service";
import { GenAiPromptService } from "../../services/genai/prompt.service";
import { RouterEndpointContext } from "./interfaces/router-endpoint-content.interface";
import { SwaggerDocumentedEndpoint } from "./interfaces/swagger-documented-endpoints.interface";

export class SwaggerDocAgent {
  private astService: JavascriptAstService;
  private loggingService: LoggingService;
  private filesService: FilesService;
  private genAiService: GenerativeAIService;
  private promptService: GenAiPromptService;

  workflow: any;

  constructor() {
    this.initControllers();
    this.createWorkflow();
  }

  private initControllers() {
    this.genAiService = new GenerativeAIService();
    this.astService = new JavascriptAstService();
    this.loggingService = new LoggingService();
    this.filesService = new FilesService();
    this.promptService = new GenAiPromptService();
  }

  private handleError(error: Error, errorMessage: string): void {
    this.loggingService.log(
      `❌ ${errorMessage}: ${error.message}`,
      LogLevel.ERROR,
    );
  }

  private createWorkflow() {
    this.workflow = new StateGraph(StateAnnotation)
      .addNode(NodeNames.SCAN_PROJECT, this.scanProject.bind(this))
      .addNode(NodeNames.ANALYZE_ROUTES, this.analyzeRoutes.bind(this))
      .addNode(
        NodeNames.ANALYZE_CONTROLLERS,
        this.analyzeControllers.bind(this),
      )
      .addNode(
        NodeNames.MERGE_ROUTES_WITH_CONTROLLER,
        this.mergeRoutesWithController.bind(this),
      )
      .addNode(NodeNames.GENERATE_SWAGGER, this.generateSwagger.bind(this))
      .addNode(NodeNames.VALIDATE_OUTPUT, this.validateOutput.bind(this))
      .addNode(
        NodeNames.UPDATE_ROUTES_WITH_DOCUMENTATION,
        this.updateRoutersWithDocumentation.bind(this),
      )
      .addEdge(START, NodeNames.SCAN_PROJECT)
      .addEdge(NodeNames.SCAN_PROJECT, NodeNames.ANALYZE_ROUTES)
      .addEdge(NodeNames.ANALYZE_ROUTES, NodeNames.ANALYZE_CONTROLLERS)
      .addEdge(
        NodeNames.ANALYZE_CONTROLLERS,
        NodeNames.MERGE_ROUTES_WITH_CONTROLLER,
      )
      .addEdge(
        NodeNames.MERGE_ROUTES_WITH_CONTROLLER,
        NodeNames.GENERATE_SWAGGER,
      )
      .addEdge(NodeNames.GENERATE_SWAGGER, NodeNames.VALIDATE_OUTPUT)
      .addEdge(
        NodeNames.VALIDATE_OUTPUT,
        NodeNames.UPDATE_ROUTES_WITH_DOCUMENTATION,
      )
      .addEdge(NodeNames.UPDATE_ROUTES_WITH_DOCUMENTATION, END);
  }

  get graph(): CompiledStateGraph<typeof StateAnnotation.State, any> {
    return this.workflow.compile();
  }

  async scanProject(state: typeof StateAnnotation.State) {
    try {
      const routeFiles = await this.filesService.findFiles(
        state.projectPath,
        state.routerDirectories,
      );
      const controllerFiles = await this.filesService.findFiles(
        state.projectPath,
        state.controllerDirectories,
      );

      const result = { ...state, routeFiles, controllerFiles };

      return result;
    } catch (error) {
      return this.handleError(error, "Project scan failed");
    }
  }

  async analyzeRoutes(state: typeof StateAnnotation.State) {
    const { matchingFiles: rootRouterFiles, nonMatchingFiles: nonRouterFiles } =
      this.filesService.groupFileNamesByKeyword(state.routeFiles, "index");

    const rootRouterFilesContent =
      await this.filesService.readFiles(rootRouterFiles);

    const routerEndpoints: RouterEndpointContext[] = [];

    for (const routeFile of nonRouterFiles) {
      try {
        const content = await this.filesService.readFile(routeFile);

        const discoveredRouteEndpoints = await this.extractEndpoints(
          content,
          routeFile,
          rootRouterFilesContent.join("\n"),
        );

        routerEndpoints.push(...discoveredRouteEndpoints);
      } catch (error) {
        this.loggingService.log(
          `⚠️ Could not analyze route file ${routeFile}: ${error.message}`,
          LogLevel.WARNING,
        );
      }
    }

    return { ...state, routerEndpoints };
  }

  async extractEndpoints(
    fileContent: string,
    filePath: string,
    rootRouterFilesContent: string,
  ): Promise<RouterEndpointContext[]> {
    const prompt = this.promptService.buildRouteAnalysisPrompt(
      filePath,
      fileContent,
      rootRouterFilesContent,
    );

    const result = await this.genAiService.invoke<RouterEndpointContext[]>(
      prompt,
      {
        cacheKey: filePath,
        isJsonResponse: true,
      },
    );

    const parsedEndpoints = result.map((endpoint) => ({
      ...endpoint,
      filePath: filePath,
      handler: endpoint.handler.split(" / ")[0],
    }));
    return parsedEndpoints;
  }

  async analyzeControllers(state: typeof StateAnnotation.State) {
    for (const controllerFile of state.controllerFiles) {
      try {
        const content = await this.filesService.readFile(controllerFile);

        const functions: ClassMethod[] =
          this.astService.getClassMethods(content);

        return { ...state, controllerFunctions: functions };
      } catch (error) {
        this.loggingService.log(
          `⚠️ Could not analyze controller file ${controllerFile}: ${error.message}`,
          LogLevel.WARNING,
        );
      }
    }
  }

  async mergeRoutesWithController(state: typeof StateAnnotation.State) {
    const matchedRouterEndpoints: RouterEndpointContext[] = [];

    for (const endpoint of state.routerEndpoints) {
      const controllerFunction = state.controllerFunctions.find(
        (func) =>
          func?.id?.name.toLowerCase() === endpoint.handler.toLowerCase(),
      );

      if (!controllerFunction) {
        this.loggingService.log(
          `⚠️ No controller function found for endpoint ${endpoint.handler}`,
          LogLevel.WARNING,
        );
        continue;
      }

      matchedRouterEndpoints.push({
        ...endpoint,
        controllerContent: controllerFunction.content,
      });
    }

    return { ...state, routerEndpoints: matchedRouterEndpoints };
  }

  async generateSwagger(state: typeof StateAnnotation.State) {
    const swaggerEndpoints: SwaggerDocumentedEndpoint[] = [];

    for (const endpoint of state.routerEndpoints) {
      try {
        const swaggerDoc = await this.generateSwaggerForEndpoint(endpoint);

        swaggerEndpoints.push({
          ...endpoint,
          swagger: swaggerDoc,
        });
      } catch (error) {
        this.loggingService.log(
          `❌ Failed to generate Swagger for ${endpoint.path}: ${error.message}`,
          LogLevel.ERROR,
        );
      }
    }

    return {
      ...state,
      swaggerEndpoints,
    };
  }

  private async generateSwaggerForEndpoint(
    endpoint: RouterEndpointContext,
  ): Promise<string> {
    const prompt = this.promptService.buildSwaggerPrompt(endpoint);

    return this.genAiService.invoke<string>(prompt, {
      cacheKey: endpoint.path,
      isJsonResponse: false,
    });
  }

  async validateOutput(state: typeof StateAnnotation.State) {
    const validatedSwaggerEndpoints: SwaggerDocumentedEndpoint[] = [];

    for (const swaggerDoc of state.swaggerEndpoints) {
      try {
        this.astService.getAst(swaggerDoc.swagger);

        validatedSwaggerEndpoints.push(swaggerDoc);
      } catch (error) {
        this.loggingService.log(
          `⚠️ Failed to validate Swagger for ${swaggerDoc.path}: ${error.message}`,
          LogLevel.WARNING,
        );
      }
    }

    return { ...state, swaggerEndpoints: validatedSwaggerEndpoints };
  }

  async updateRoutersWithDocumentation(state: typeof StateAnnotation.State) {
    for (const swaggerDoc of state.swaggerEndpoints) {
      const { path, swagger, filePath } = swaggerDoc;

      const fileContent = await this.filesService.readFile(filePath);

      const lineNumber = this.astService.getRouteDefinitionLineNumberByContent(
        fileContent,
        path,
      );

      if (lineNumber === -1) {
        this.loggingService.log(
          `⚠️ Could not find route definition for ${path} in ${filePath}`,
          LogLevel.WARNING,
        );
        continue;
      }

      await this.filesService.addContentsToFile(filePath, swagger, lineNumber);
    }

    return state;
  }

  async run(
    projectPath: string,
    routerDirectories: string[],
    controllerDirectories: string[],
  ) {
    const result = await this.graph.invoke({
      projectPath,
      routerDirectories,
      routeFiles: [],
      routerEndpoints: [],
      controllerDirectories,
      controllerFiles: [],
      controllerFunctions: [],
      swaggerEndpoints: [],
      updatedFiles: [],
      errors: [],
    });

    return result;
  }
}

export const agent = new SwaggerDocAgent();

export const graph = agent.graph;
