export interface RouterEndpointContext {
  method: string;
  path: string;
  fullPath: string;
  handlers: string[];
  controllerContents: string[];
  parameters: RouterEndpointParameters[];
  filePath: string;
  middlewares?: string[];
  middlewareContents: string[];
}

export interface RouterEndpointParameters {
  name: string;
  in: "path" | "query" | "header" | "body";
  type: string;
  description?: string;
  required: boolean;
}
