import { RouterEndpointContext } from "../../agents/swagger/interfaces/router-endpoint-content.interface";

export class PromptsService {
  buildRouterContextExtractionPrompt(content: string) {
    return `
      Analyze the provided JavaScript code and extract the API subroutes along with their corresponding file paths.  Return a JSON array of base URLs with the following structure:
      {
        [ "routerPath": "[routerFilePath]",
          "apiPaths": [
            "[apiPath1]",
            "[apiPath2]"
        ]
      }

      Pay Attention To:
      - The file paths should be relative to the project root (without ./ prefix).
      - The API paths should be the full path including the base URL.
      - Do not include any code blocks or markdown formatting.

      File Content: ${content}
    `;
  }

  buildRouteAnalysisPrompt(
    filePath: string,
    content: string,
    routerContext: string,
  ): string {
    return `
      Analyze this Express.js route file and extract all endpoints with their details:

      Return a JSON array of endpoints with the following structure:
      [
        {
          "method": "GET|POST|PUT|DELETE|PATCH",
          "path": "example/:id",
          "fullPath": "/api/v1.5/example/:id",
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

      Base URL: ${routerContext || "No base URL provided."}
      File: ${filePath}
      Content:
      ${content}
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
      - If there is any user authentication requirement (req.session.user), add security: - bearerAuth: []
      - Always include the full path in the JSDoc comment, even if it is a subroute.

      Format:
      /**
       * @swagger
       * ${endpoint.fullPath}:
       *   ${endpoint.method.toLowerCase()}:
       *     tags:
       *       - [Controller Name (without Controller suffix and spacing between words)]
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
      - Path: ${endpoint.fullPath}
      - Handler: ${endpoint.handler}
      - Parameters: ${JSON.stringify(endpoint.parameters || [])} (Although there could be more parameters in the controller)

      Function Context:
      ${endpoint.controllerContent || "No controller content available."}
    `;
  }
}
