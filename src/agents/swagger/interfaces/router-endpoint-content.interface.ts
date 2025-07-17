export interface RouterEndpointContext {
  method: string;
  path: string;
  fullPath: string;
  handler: string;
  parameters: RouterEndointParameters[];
  filePath: string;
  controllerContent?: string;
}

export interface RouterEndointParameters {
  name: string;
  in: "path" | "query" | "header" | "body";
  type: string;
  description?: string;
  required: boolean;
}
