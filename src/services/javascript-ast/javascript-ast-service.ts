import * as acorn from "acorn";
import * as acornWalk from "acorn-walk";

export interface ClassMethod extends acorn.MethodDefinition {
  id: acorn.Identifier;
  content: string;
}

export class JavascriptAstService {
  getAst(fileContents: string): acorn.Program {
    const ast = acorn.parse(fileContents, {
      ecmaVersion: 2020,
      locations: true,
    });

    return ast;
  }

  getClassMethods(fileContents: string): ClassMethod[] {
    const ast = this.getAst(fileContents);
    const { className, methods } = this.filterForClassMethods(ast);
    const methodssWithCodeContent = methods.map((func) =>
      this.getClassMethodCode(fileContents, func, className),
    );
    return methodssWithCodeContent;
  }

  private filterForClassMethods(ast: acorn.Program): {
    className: string;
    methods: acorn.MethodDefinition[];
  } {
    let className = "";
    const methods: acorn.MethodDefinition[] = [];

    acornWalk.simple(ast, {
      ClassDeclaration(node) {
        className = node.id?.name ?? "";

        node.body.body.forEach((element) => {
          if (element.type === "MethodDefinition") {
            methods.push(element);
          }
        });
      },
    });

    return {
      className,
      methods,
    };
  }

  private getClassMethodCode(
    fileContents: string,
    methodNode: acorn.MethodDefinition,
    className: string,
  ): ClassMethod {
    const start = methodNode.start;
    const end = methodNode.end;

    if (!methodNode.key || methodNode.key.type !== "Identifier") {
      throw new Error("Method node does not have a valid identifier.");
    }

    return {
      ...methodNode,
      id: {
        ...methodNode.key,
        name: className + "." + methodNode.key.name,
      },
      content: fileContents.slice(start, end),
    };
  }

  getRouteDefinitionLineNumberByContent(
    endpoint: { path: string; method: string },
    fileContents: string,
  ): number {
    const ast = this.getAst(fileContents);
    return this.findRouteDefinitionLineNumber(endpoint, ast);
  }

  private findRouteDefinitionLineNumber(
    endpoint: { path: string; method: string },
    ast: acorn.Program,
  ): number {
    let lineNumber = -1;

    acornWalk.simple(ast, {
      ExpressionStatement(node) {
        if (
          node.expression.type === "CallExpression" &&
          node.expression.callee.type === "MemberExpression" &&
          node.expression.arguments.length > 0
        ) {
          const callee = node.expression.callee;
          const firstArgument = node.expression.arguments[0];

          if (
            callee.property.type === "Identifier" &&
            callee.property.name === endpoint.method.toLowerCase() &&
            firstArgument.type === "Literal" &&
            firstArgument.value === endpoint.path
          ) {
            if (node.loc) {
              lineNumber = node.loc.start.line;
            }
          }
        }
      },
    });

    return lineNumber;
  }
}
