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
import { FilesService } from "../../services/files/files.service";
import { NodeNames } from "./enum/node-names.enum";
import { StateAnnotation } from "./state/state-annotation";
import { GenerativeAIService } from "../../services/genai/genai.service";
import { PromptsService } from "../../services/genai/prompts.service";
import { RouterEndpointContext } from "./interfaces/router-endpoint-content.interface";
import { SwaggerDocumentedEndpoint } from "./interfaces/swagger-documented-endpoints.interface";
import { RouterBaseUrls } from "./interfaces/router-base-urls.interface";

export class SwaggerDocAgent {
  private astService: JavascriptAstService;
  private loggingService: LoggingService;
  private filesService: FilesService;
  private genAiService: GenerativeAIService;
  private promptService: PromptsService;

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
    this.promptService = new PromptsService();
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
      .addNode(
        NodeNames.EXTRACT_ROUTER_CONTEXTS,
        this.extractRouterContexts.bind(this),
      )
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
      .addEdge(NodeNames.SCAN_PROJECT, NodeNames.EXTRACT_ROUTER_CONTEXTS)
      .addEdge(NodeNames.EXTRACT_ROUTER_CONTEXTS, NodeNames.ANALYZE_ROUTES)
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
        state.moduleDirectories.map((dir) => `${dir}/routes`),
      );
      const controllerFiles = await this.filesService.findFiles(
        state.moduleDirectories.map((dir) => `${dir}/controllers`),
      );

      const result = { ...state, routeFiles, controllerFiles };

      return result;
    } catch (error) {
      return this.handleError(error, "Project scan failed");
    }
  }

  async extractRouterContexts(state: typeof StateAnnotation.State) {
    const routerBaseUrls: RouterBaseUrls[] = [];

    for (const routeFile of state.routerContentFiles) {
      try {
        const content = await this.filesService.readFile(routeFile);
        const prompt =
          this.promptService.buildRouterContextExtractionPrompt(content);
        const result = await this.genAiService.invoke<RouterBaseUrls[]>(
          prompt,
          {
            cacheKey: routeFile,
            isJsonResponse: true,
          },
        );

        routerBaseUrls.push(...result);
      } catch (error) {
        this.loggingService.log(
          `⚠️ Could not read route file ${routeFile}: ${error.message}`,
          LogLevel.WARNING,
        );
      }
    }

    return { ...state, routerBaseUrls };
  }

  async analyzeRoutes(state: typeof StateAnnotation.State) {
    const routerEndpoints: RouterEndpointContext[] = [];

    for (const routeFile of state.routeFiles) {
      try {
        const content = await this.filesService.readFile(routeFile);

        const baseUrlContext = state.routerBaseUrls
          .filter((url) => routeFile.includes(url.routerPath))
          .map((item) => item.apiPaths.join(", "))
          .join(", ");

        const discoveredRouteEndpoints = await this.extractEndpoints(
          content,
          routeFile,
          baseUrlContext,
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
      handler: endpoint.handler ? endpoint.handler.split(" / ")[0] : "",
    }));
    return parsedEndpoints;
  }

  async analyzeControllers(state: typeof StateAnnotation.State) {
    const controllerFunctions: ClassMethod[] = [];

    for (const controllerFile of state.controllerFiles) {
      try {
        const content = await this.filesService.readFile(controllerFile);

        const functions: ClassMethod[] =
          this.astService.getClassMethods(content);

        controllerFunctions.push(...functions);
      } catch (error) {
        this.loggingService.log(
          `⚠️ Could not analyze controller file ${controllerFile}: ${error.message}`,
          LogLevel.WARNING,
        );
      }
    }

    return { ...state, controllerFunctions };
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
        const prompt = this.promptService.buildSwaggerPrompt(endpoint);

        const swaggerDoc = await this.genAiService.invoke<string>(prompt, {
          cacheKey: `${endpoint.method} ${endpoint.fullPath}`,
          isJsonResponse: false,
        });

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
        swaggerDoc,
        fileContent,
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

  async run(moduleDirectories: string[], routerContentFiles: string[] = []) {
    const result = await this.graph.invoke({
      moduleDirectories,
      routerContentFiles,
      routeFiles: [],
      routerEndpoints: [],
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
