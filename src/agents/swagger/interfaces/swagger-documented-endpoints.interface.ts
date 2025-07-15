import { RouterEndpointContext } from "./router-endpoint-content.interface";

export interface SwaggerDocumentedEndpoint extends RouterEndpointContext {
  swagger: string;
}
