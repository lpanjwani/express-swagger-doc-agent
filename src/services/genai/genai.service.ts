import { ChatOpenAI } from "@langchain/openai";
import { RedisService } from "../redis/redis-service.service";
import { LoggingService, LogLevel } from "../logging/logging.service";

export class GenerativeAIService {
  llm: ChatOpenAI;
  redisService: RedisService;
  loggingService: LoggingService;

  constructor() {
    this.llm = this.buildClient();
    this.redisService = new RedisService();
    this.loggingService = new LoggingService();
  }

  private getAndValidateApiKey(): string {
    const apiKey = process.env.GITHUB_API_KEY;
    if (!apiKey) {
      throw new Error("GITHUB_API_KEY is not defined in environment variables");
    }

    return apiKey;
  }

  private buildClient(): ChatOpenAI {
    const client = new ChatOpenAI({
      apiKey: this.getAndValidateApiKey(),
      model: "openai/gpt-4o",
      temperature: 0,
      configuration: {
        baseURL: "https://models.github.ai/inference",
      },
    });

    return client;
  }

  private async checkForCachedResponse(cacheKey: string): Promise<boolean> {
    const doesExist = await this.redisService.exists(cacheKey);

    if (!doesExist) {
      return false;
    }
    return true;
  }

  private async getCachedResponse<T>(
    cacheKey: string,
    isJsonResponse: boolean,
  ): Promise<T> {
    const result = (await this.redisService.get(cacheKey)) as string;

    this.loggingService.log(
      `✅ Cache hit for ${cacheKey}, returning cached response`,
      LogLevel.CACHE,
    );

    return isJsonResponse ? (JSON.parse(result) as T) : (result as T);
  }

  private async cacheResponse(
    cacheKey: string,
    response: string,
  ): Promise<void> {
    await this.redisService.set(cacheKey, response);
    this.loggingService.log(
      `✅ Response cached for ${cacheKey}`,
      LogLevel.CACHE,
    );
  }

  async invoke<T>(
    prompt: string,
    {
      cacheKey,
      isJsonResponse = false,
    }: { cacheKey: string; isJsonResponse?: boolean },
  ): Promise<T> {
    this.loggingService.log(`🤖 Calling LLM for ${cacheKey}`, LogLevel.LLM);

    if (await this.checkForCachedResponse(cacheKey)) {
      return await this.getCachedResponse<T>(cacheKey, isJsonResponse);
    }

    try {
      const response = await this.llm.invoke([
        { role: "user", content: prompt },
      ]);
      const content = response.content as string;

      this.loggingService.log(
        `✅ LLM response received for ${cacheKey}: ${content}`,
        LogLevel.SUCCESS,
      );

      await this.cacheResponse(cacheKey, content);

      return isJsonResponse ? (JSON.parse(content) as T) : (content as T);
    } catch (error) {
      console.error("Error invoking LLM:", error);
      throw new Error("Failed to invoke LLM");
    }
  }
}
