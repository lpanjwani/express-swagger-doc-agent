import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { RedisService } from "../redis/redis-service.service";
import { LoggingService, LogLevel } from "../logging/logging.service";

export class GenerativeAIService {
  llm: ChatGoogleGenerativeAI;
  redisService: RedisService;
  loggingService: LoggingService;

  constructor() {
    this.validateEnvironmentVariables();
    this.llm = this.buildClient();
    this.redisService = new RedisService();
    this.loggingService = new LoggingService();
  }

  private validateEnvironmentVariables(): void {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not defined in environment variables");
    }
  }

  private buildClient(): ChatGoogleGenerativeAI {
    const client = new ChatGoogleGenerativeAI({
      apiKey: process.env.GEMINI_API_KEY,
      model: "gemini-2.5-pro",
      temperature: 0.1,
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
