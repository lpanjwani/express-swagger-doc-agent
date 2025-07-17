import { MessageFieldWithRole } from "@langchain/core/messages";
import { RouterEndpointContext } from "../../agents/swagger/interfaces/router-endpoint-content.interface";

export class PromptsService {
  buildRouterContextExtractionPrompt(content: string): MessageFieldWithRole[] {
    const systemMessage = `Analyze the provided JavaScript code and extract the API subroutes along with their corresponding file paths. Return a JSON array of base URLs with the following structure:
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
      - Do not include any code blocks or markdown formatting.`;

    const userMessage = `File Content: ${content}`;

    return [
      { role: "system", content: systemMessage },
      { role: "user", content: userMessage },
    ];
  }

  buildRouteAnalysisPrompt(
    filePath: string,
    content: string,
    routerContext: string,
  ): MessageFieldWithRole[] {
    const systemMessage = `Analyze this Express.js route file and extract all endpoints with their details. Return a JSON array of endpoints with the following structure:
      [
        {
          "method": "GET|POST|PUT|DELETE|PATCH",
          "path": "example/:id",
          "fullPath": "/api/v1.5/example/:id",
          "handlers": ["controllerFn1", "controllerFn2"],
          "middlewares": ["middleware1", "middleware2"],
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
      - Do not include any code blocks or markdown formatting.`;

    const userMessage = `
      Base URL: ${routerContext || "No base URL provided."}
      File: ${filePath}
      Content: ${content}
    `;

    return [
      { role: "system", content: systemMessage },
      { role: "user", content: userMessage },
    ];
  }

  buildSwaggerPrompt(endpoint: RouterEndpointContext): MessageFieldWithRole[] {
    const includeBearerAuth = endpoint.middlewareContents?.some((content) =>
      content.includes("authorization"),
    );
    const includeLanguage = endpoint.controllerContents?.some((controller) =>
      controller.includes("lang"),
    );

    const systemMessage = `
      Generate a comprehensive Swagger/OpenAPI JSDoc comment.
      Instructions:
      - Base the comment strictly on the endpoint's implementation details.
      - Include only explicitly provided parameters and response codes.
      - Exclude common responses like 200, 400, 404, and 500 unless they are specifically used in the code.
      - Provide meaningful descriptions derived from the endpoint path.
      - Ensure all path parameters are documented.
      - Return the JSDoc comment as a plain string. Do not include any type of formatting including markdown.
      - Only include status codes that are handled using .json or .status methods.
      - If there are no middlewares or controller contents, don't document the responses or parameters.

      Format:
      /**
       * @swagger
       * ${endpoint.fullPath}:
       *   ${endpoint.method.toLowerCase()}:
       *     tags:
       *       - [Controller Name (e.g., without "Controller" suffix)]
       *     summary: [Short description of the endpoint]
       *     description: [Detailed explanation of the endpoint]
       *     parameters:
       *       ${includeLanguage ? "- $ref: '#/components/parameters/LanguageHeader'" : ""}
       *       - name: [Parameter name]
       *         in: [path|query|header|body]
       *         required: [true|false]
       *         schema:
       *           type: [string|number|boolean|object]
       *         description: [Description of the parameter]
       *     requestBody:
       *       required: [true|false]
       *       content:
       *         application/json:
       *           schema:
       *             type: object
       *             properties:
       *               [property]:
       *                 type: [type]
       *                 description: [Description of the property]
       *     responses:
       *       [successCode]:
       *         description: [Description of the success response]
       *       [errorCode]:
       *         description: [Description of the error response]
       * ${includeBearerAuth ? "security:\n- bearerAuth: []" : ""}
       */

    `;

    const userMessage = `
      Endpoint Details:
      - Method: ${endpoint?.method}
      - Path: ${endpoint?.fullPath}
      - Parameters: ${JSON.stringify(endpoint?.parameters || [])} (Additional parameters may exist in the controller)

      Middleware Content:
      ${endpoint?.middlewareContents?.join("\n") || "No middleware content available."}
      Function Context:
      ${endpoint?.controllerContents?.join("\n") || "No controller content available."}`;

    return [
      { role: "system", content: systemMessage },
      { role: "user", content: userMessage },
    ];
  }
}
