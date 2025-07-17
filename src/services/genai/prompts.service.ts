import { RouterEndpointContext } from "../../agents/swagger/interfaces/router-endpoint-content.interface";

export class PromptsService {
  buildRouteAnalysisPrompt(
    filePath: string,
    content: string,
    rootRouterFilesContent: string,
  ): string {
    return `
      Analyze this Express.js route file and extract all endpoints with their details:

      Return a JSON array of endpoints with the following structure:
      [
        {
          "method": "GET|POST|PUT|DELETE|PATCH",
          "path": "/api/v1.5/example/:id",
          "handler": "controllerFunction",
          "parameters": [
            {
              "name": "id",
              "in": "path", # Could be Path, Query, Header, Body
              "type": "string", # Could be string, number, boolean, object
              "description": "Description of the parameter",
              "required": true # If there is no default value, it is required
            }
          ]
        }
      ]

      Pay attention to:
      - Route patterns with parameters (e.g., :id, :hakbahId)
      - Controller function names
      - HTTP methods
      - Root-level routes (e.g., /api/v1.5/ or /api/callback/)
      - Do not include any code blocks or markdown formatting.

      File: ${filePath}
      Content:
      ${content}
      Router Root File Content: ${rootRouterFilesContent}
    `;
  }

  buildSwaggerPrompt(endpoint: RouterEndpointContext): string {
    return `
      Generate a comprehensive Swagger/OpenAPI JSDoc comment.

      Requirements:
      - Add meaningful descriptions based on the endpoint path
      - Include all path parameters from the endpoint
      - Include standard HTTP status codes based on the HTTP Method and code
      - There can be multiple responses with different status codes, so include them all.
      - Make it production-ready and comprehensive
      - Return the JSDoc comment as a string without any additional text.
      - Do not include any code blocks or markdown formatting.
      - If there is any user requirement, add security: - bearerAuth: []

      Format:
      /**
       * @swagger
       * ${endpoint.path}:
       *   ${endpoint.method.toLowerCase()}:
       *     tags:
       *       - [Controller Name]
       *     summary: [Brief description]
       *     description: [Detailed description]
       *     parameters:
       *       - name: [parameter name]
       *         in: [path|query|header|body]
       *         required: [true|false]
       *         schema:
       *           type: [string|number|boolean|object]
       *         description: [parameter description]
       *     requestBody:
       *       required: [true|false]
       *       content:
       *         application/json:
       *           schema:
       *             type: object
       *             properties:
       *               [property]:
       *                 type: [type]
       *                 description: [description]
       *     responses:
       *       [successCode]:
       *         description: [Success response description]
       *       [errorCode]:
       *         description: [Error response description]
       */

      Endpoint Details:
      - Method: ${endpoint.method}
      - Path: ${endpoint.path}
      - Handler: ${endpoint.handler}
      - Parameters: ${JSON.stringify(endpoint.parameters || [])} (Although there could be more parameters in the controller)

      Function Context:
      ${endpoint.controllerContent || "No controller content available."}
    `;
  }
}
