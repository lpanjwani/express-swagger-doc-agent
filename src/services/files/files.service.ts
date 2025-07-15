import path from "path";
import { glob } from "glob";
import { readFile, writeFile } from "fs/promises";

export class FilesService {
  async findFiles(
    basePath: string,
    directories: string[],
    extensions: string[] = [".js", ".ts"],
  ) {
    let files: string[] = [];
    for (const dir of directories) {
      const absDir = path.join(basePath, dir);
      const patterns = extensions.map((ext) => path.join(absDir, `**/*${ext}`));
      try {
        for (const pattern of patterns) {
          const matchedFiles = glob.sync(pattern, { nodir: true });
          files.push(...matchedFiles);
        }
      } catch (error) {}
    }
    return files;
  }

  async readFile(filePath: string): Promise<string> {
    return await readFile(filePath, "utf-8");
  }

  async readFiles(filePaths: string[]) {
    return Promise.all(filePaths.map((filePath) => this.readFile(filePath)));
  }

  groupFileNamesByKeyword(
    routeFiles: string[],
    keyword: string,
  ): { matchingFiles: string[]; nonMatchingFiles: string[] } {
    const matchingFiles = routeFiles.filter((file) => file.includes(keyword));
    const nonMatchingFiles = routeFiles.filter(
      (file) => !file.includes(keyword),
    );
    return { matchingFiles, nonMatchingFiles };
  }

  async addContentsToFile(
    filePath: string,
    newContents: string,
    lineNumber: number,
  ): Promise<void> {
    const fileContent = await this.readFile(filePath);
    const lines = fileContent.split("\n");
    lines.splice(lineNumber - 1, 0, newContents);
    return writeFile(filePath, lines.join("\n"), "utf-8");
  }
}
