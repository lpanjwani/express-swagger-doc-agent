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
import { LoggingService } from "../../services/logging/logging.service";
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
    this.loggingService = new LoggingService(this.constructor.name);
    this.filesService = new FilesService();
    this.promptService = new PromptsService();
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
      .addNode(NodeNames.ANALYZE_MIDDLEWARES, this.analyzeMiddleware.bind(this))
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
      .addEdge(NodeNames.ANALYZE_CONTROLLERS, NodeNames.ANALYZE_MIDDLEWARES)
      .addEdge(
        NodeNames.ANALYZE_MIDDLEWARES,
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
      this.loggingService.wait("[%d/4] Scanning Project", 1);

      const routeFiles = await this.filesService.findFiles(
        state.moduleDirectories.map((dir) => `${dir}/routes`),
      );

      this.loggingService.success("[%d/4] Scanning Project", 1);

      this.loggingService.wait("[%d/4] Scanning Project", 2);
      const controllerFiles = await this.filesService.findFiles(
        state.moduleDirectories.map((dir) => `${dir}/controllers`),
      );

      this.loggingService.success("[%d/4] Scanning Project", 2);

      this.loggingService.wait("[%d/4] Scanning Project", 3);
      const middlewareFiles = await this.filesService.findFiles(
        state.moduleDirectories.map((dir) => `${dir}/middlewares`),
      );

      this.loggingService.success("[%d/4] Scanning Project", 3);

      this.loggingService.success("[%d/4] Scanning Project", 4);
      return { ...state, routeFiles, controllerFiles, middlewareFiles };
    } catch (error) {
      this.loggingService.error("Project scan failed: %s", error.message);

      this.loggingService.error("[%d/4] Scanning Project", 4);

      return { ...state, errors: [error.message] };
    }
  }

  async extractRouterContexts(state: typeof StateAnnotation.State) {
    const routerBaseUrls: RouterBaseUrls[] = [];

    const routerContentLength = state.routerContentFiles.length;
    for (const [index, routeFile] of state.routerContentFiles.entries()) {
      try {
        this.loggingService.wait(
          `[%d/%d] Extracting Router Contexts`,
          index + 1,
          routerContentLength,
        );

        const content = await this.filesService.readFile(routeFile);
        const prompt =
          this.promptService.buildRouterContextExtractionPrompt(content);
        const result = await this.genAiService.invoke<RouterBaseUrls[]>(
          prompt,
          { cacheKey: routeFile, isJsonResponse: true },
        );

        routerBaseUrls.push(...result);

        this.loggingService.success(
          `[%d/%d] Extracting Router Contexts`,
          index + 1,
          routerContentLength,
        );
      } catch (error) {
        this.loggingService.error(
          `Failed to extract router contexts from ${routeFile}: ${error.message}`,
        );
        this.loggingService.error(
          `[%d/%d] Extracting Router Contexts`,
          index + 1,
          routerContentLength,
        );
      }
    }

    return { ...state, routerBaseUrls };
  }

  async analyzeRoutes(state: typeof StateAnnotation.State) {
    const routerEndpoints: RouterEndpointContext[] = [];

    for (const [index, routeFile] of state.routeFiles.entries()) {
      try {
        this.loggingService.wait(
          `[%d/%d] Analyzing Routes`,
          index + 1,
          state.routeFiles.length,
        );

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

        this.loggingService.success(
          `[%d/%d] Analyzing Routes`,
          index + 1,
          state.routeFiles.length,
        );
      } catch (error) {
        this.loggingService.error(
          `Failed to analyze route file ${routeFile}: ${error.message}`,
        );
        this.loggingService.error(
          `[%d/%d] Analyzing Routes`,
          index + 1,
          state.routeFiles.length,
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
      handlers: endpoint.handlers ?? [],
      middlewareContents: endpoint.middlewareContents ?? [],
      controllerContents: endpoint.controllerContents ?? [],
    }));

    return parsedEndpoints;
  }

  async analyzeControllers(state: typeof StateAnnotation.State) {
    const controllerFunctions: ClassMethod[] = [];

    for (const [index, controllerFile] of state.controllerFiles.entries()) {
      try {
        this.loggingService.wait(
          `[%d/%d] Analyzing Controllers`,
          index + 1,
          state.controllerFiles.length,
        );

        const content = await this.filesService.readFile(controllerFile);

        const functions: ClassMethod[] =
          this.astService.getClassMethods(content);

        controllerFunctions.push(...functions);

        this.loggingService.success(
          `[%d/%d] Analyzing Controllers`,
          index + 1,
          state.controllerFiles.length,
        );
      } catch (error) {
        this.loggingService.error(
          `Failed to analyze controller file ${controllerFile}: ${error.message}`,
        );
        this.loggingService.error(
          `[%d/%d] Analyzing Controllers`,
          index + 1,
          state.controllerFiles.length,
        );
      }
    }

    return { ...state, controllerFunctions };
  }

  async analyzeMiddleware(state: typeof StateAnnotation.State) {
    const middlewareFunctions: ClassMethod[] = [];

    for (const [index, middlewareFile] of state.middlewareFiles.entries()) {
      try {
        this.loggingService.wait(
          `[%d/%d] Analyzing Middleware`,
          index + 1,
          state.middlewareFiles.length,
        );

        const content = await this.filesService.readFile(middlewareFile);

        const functions: ClassMethod[] =
          this.astService.getClassMethods(content);

        middlewareFunctions.push(...functions);

        this.loggingService.success(
          `[%d/%d] Analyzing Middleware`,
          index + 1,
          state.middlewareFiles.length,
        );
      } catch (error) {
        this.loggingService.error(
          `Failed to analyze middleware file ${middlewareFile}: ${error.message}`,
        );
        this.loggingService.error(
          `[%d/%d] Analyzing Middleware`,
          index + 1,
          state.middlewareFiles.length,
        );
      }
    }

    return { ...state, middlewareFunctions };
  }

  async mergeRoutesWithController(state: typeof StateAnnotation.State) {
    const matchedRouterEndpoints: RouterEndpointContext[] = [];

    for (const [index, endpoint] of state.routerEndpoints.entries()) {
      try {
        this.loggingService.wait(
          `[%d/%d] Merging Routes with Controllers`,
          index + 1,
          state.routerEndpoints.length,
        );

        const controllerFunctions = this.matchedEndpointsWithFunctions(
          endpoint.handlers,
          state.controllerFunctions,
        );

        if (controllerFunctions.length > 0) {
          endpoint.controllerContents = controllerFunctions;
        }

        const middlewareFunctions = this.matchedEndpointsWithFunctions(
          endpoint.middlewares ?? [],
          state.middlewareFunctions,
        );

        if (middlewareFunctions.length > 0) {
          endpoint.middlewareContents = middlewareFunctions;
        }

        matchedRouterEndpoints.push(endpoint);

        this.loggingService.success(
          `[%d/%d] Merging Routes with Controllers`,
          index + 1,
          state.routerEndpoints.length,
        );
      } catch (error) {
        this.loggingService.error(
          `Failed to merge routes with controllers for endpoint ${endpoint.path}: ${error.message}`,
        );
        this.loggingService.error(
          `[%d/%d] Merging Routes with Controllers`,
          index + 1,
          state.routerEndpoints.length,
        );
      }
    }

    return { ...state, routerEndpoints: matchedRouterEndpoints };
  }

  private matchedEndpointsWithFunctions(
    endpointItems: string[],
    functionsList: ClassMethod[] = [],
  ): string[] {
    const matchingUnions = functionsList.flatMap((functionItem) =>
      endpointItems
        .filter(
          (handler) =>
            handler.toLowerCase() === functionItem.id.name.toLowerCase(),
        )
        .map(() => functionItem.content),
    );

    return matchingUnions;
  }

  async generateSwagger(state: typeof StateAnnotation.State) {
    const swaggerEndpoints: SwaggerDocumentedEndpoint[] = [];

    for (const [index, endpoint] of state.routerEndpoints.entries()) {
      try {
        this.loggingService.wait(
          `[%d/%d] Generating Swagger Documentation`,
          index + 1,
          state.routerEndpoints.length,
        );

        const prompt = this.promptService.buildSwaggerPrompt(endpoint);

        const swaggerDoc = await this.genAiService.invoke<string>(prompt, {
          cacheKey: `${endpoint.method} ${endpoint.fullPath}`,
          isJsonResponse: false,
        });

        swaggerEndpoints.push({
          ...endpoint,
          swagger: swaggerDoc,
        });

        this.loggingService.success(
          `[%d/%d] Generating Swagger Documentation`,
          index + 1,
          state.routerEndpoints.length,
        );
      } catch (error) {
        this.loggingService.error(
          `Failed to generate Swagger for ${endpoint.path}: ${error.message}`,
        );
        this.loggingService.error(
          `[%d/%d] Generating Swagger Documentation`,
          index + 1,
          state.routerEndpoints.length,
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

    for (const [index, swaggerDoc] of state.swaggerEndpoints.entries()) {
      try {
        this.loggingService.wait(
          `[%d/%d] Validating Swagger Documentation`,
          index + 1,
          state.swaggerEndpoints.length,
        );

        this.astService.getAst(swaggerDoc.swagger);

        validatedSwaggerEndpoints.push(swaggerDoc);

        this.loggingService.success(
          `[%d/%d] Validating Swagger Documentation`,
          index + 1,
          state.swaggerEndpoints.length,
        );
      } catch (error) {
        this.loggingService.error(
          `Failed to validate Swagger for ${swaggerDoc.path}: ${error.message}`,
        );
        this.loggingService.error(
          `[%d/%d] Validating Swagger Documentation`,
          index + 1,
          state.swaggerEndpoints.length,
        );
      }
    }

    return { ...state, swaggerEndpoints: validatedSwaggerEndpoints };
  }

  async updateRoutersWithDocumentation(state: typeof StateAnnotation.State) {
    for (const [index, swaggerDoc] of state.swaggerEndpoints.entries()) {
      try {
        this.loggingService.wait(
          `[%d/%d] Updating Routers with Documentation`,
          index + 1,
          state.swaggerEndpoints.length,
        );

        const { path, swagger, filePath } = swaggerDoc;

        const fileContent = await this.filesService.readFile(filePath);

        const lineNumber =
          this.astService.getRouteDefinitionLineNumberByContent(
            swaggerDoc,
            fileContent,
          );

        if (lineNumber === -1) {
          this.loggingService.error(
            `Could not find route definition for ${path} in ${filePath}`,
          );
          this.loggingService.error(
            `[%d/%d] Updating Routers with Documentation`,
            index + 1,
            state.swaggerEndpoints.length,
          );
          continue;
        }

        await this.filesService.addContentsToFile(
          filePath,
          swagger,
          lineNumber,
        );

        this.loggingService.success(
          `[%d/%d] Updating Routers with Documentation`,
          index + 1,
          state.swaggerEndpoints.length,
        );
      } catch (error) {
        this.loggingService.error(
          `Failed to update router with documentation for ${swaggerDoc.path}: ${error.message}`,
        );
        this.loggingService.error(
          `[%d/%d] Updating Routers with Documentation`,
          index + 1,
          state.swaggerEndpoints.length,
        );
      }
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
