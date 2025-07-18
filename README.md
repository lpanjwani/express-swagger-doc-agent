# Swagger Doc Agent

## Overview

The Swagger Doc Agent is an AI-powered tool designed to generate Swagger documentation for Express.js applications. It leverages LangChain, Generative AI, and other modern libraries to analyze routes, controllers, and endpoints, producing comprehensive API documentation.

## Features

- **Automated Swagger Documentation**: Generate OpenAPI-compliant documentation for Express.js applications.
- **Route and Controller Analysis**: Analyze route files and controller logic to extract endpoint details.
- **Generative AI Integration**: Use Gemini AI for intelligent analysis and documentation generation.
- **Redis Caching**: Cache AI responses for faster processing.
- **Customizable Prompts**: Tailor AI prompts for specific analysis needs.

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/lpanjwani/swagger-doc-agent.git
   cd swagger-doc-agent
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Set up environment variables:
   - Create a `.env` file based on `.env.sample`.
   - Add your Gemini API key and Redis credentials.

# Assumptions

1. Typically, Express.js applications have a structure where routes and controllers are organized in a modular way. The agent assumes that the project follows a common pattern where:

   ```
   module-dir/
   ├── routes
   │   ├── index.ts
   │   ├── userRoutes.ts
   │   └── productRoutes.ts
   ├── controllers
   │   ├── userController.ts
   │   └── productController.ts
   ├── middlewares
   │   ├── authMiddleware.ts
   │   └── errorMiddleware.ts
   └── services
      ├── userService.ts
      └── productService.ts
   ```

## Usage

### Generate Documentation

Run the following command to generate Swagger documentation:

```bash
npm run generate \
  --modulesDir <module-dirs> \
  --routerContextFiles <router-context-files>
```

### Debugging

Use the VS Code launch configuration to debug the Swagger Agent:

1. Run `docker-compose up redis` to start Redis.
2. Run the "Debug Swagger Agent" configuration from VS Code.

### Format Code

Prettier is used for code formatting. In order to use it, run the following command:

```bash
npm run format
```
