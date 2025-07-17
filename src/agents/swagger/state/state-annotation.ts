import { Annotation } from "@langchain/langgraph";
import { ClassMethod } from "../../../services/javascript-ast/javascript-ast-service";
import { RouterEndpointContext } from "../interfaces/router-endpoint-content.interface";
import { SwaggerDocumentedEndpoint } from "../interfaces/swagger-documented-endpoints.interface";

export const StateAnnotation = Annotation.Root({
  moduleDirectories: Annotation({
    reducer: (x: string[], y: string[]) => y,
    default: () => [],
  }),
  routeFiles: Annotation({
    reducer: (x: string[], y: string[]) => y,
    default: () => [],
  }),
  routerEndpoints: Annotation({
    reducer: (x: RouterEndpointContext[], y: RouterEndpointContext[]) => y,
    default: () => [],
  }),
  controllerFiles: Annotation({
    reducer: (x: string[], y: string[]) => y,
    default: () => [],
  }),
  controllerFunctions: Annotation({
    reducer: (x: ClassMethod[], y: ClassMethod[]) => y,
    default: () => [],
  }),
  swaggerEndpoints: Annotation({
    reducer: (x: SwaggerDocumentedEndpoint[], y: SwaggerDocumentedEndpoint[]) =>
      y,
    default: () => [],
  }),
  updatedFiles: Annotation({
    reducer: (x: string[], y: string[]) => y,
    default: () => [],
  }),
  errors: Annotation({
    reducer: (x: any, y: any) => y,
    default: () => [],
  }),
});
