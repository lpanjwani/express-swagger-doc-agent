import { createClient } from "redis";

export class RedisService {
  client: ReturnType<typeof createClient>;

  constructor() {
    this.validateEnvironmentVariables();
    this.createClient();
    this.connect();
  }

  private validateEnvironmentVariables() {
    if (!process.env.REDIS_URL) {
      throw new Error("REDIS_URL is not defined in environment variables");
    }
    if (!process.env.REDIS_PASSWORD) {
      throw new Error("REDIS_PASSWORD is not defined in environment variables");
    }
  }

  private createClient(): void {
    this.client = createClient({
      url: process.env.REDIS_URL,
      password: process.env.REDIS_PASSWORD,
    });

    this.client.on("error", (err) => console.log("Redis Client Error", err));
  }

  async connect(): Promise<void> {
    if (!this.client.isOpen) {
      await this.client.connect();
    }
  }

  async exists(key: string) {
    return this.client.exists(key);
  }

  async get(key: string) {
    return this.client.get(key);
  }

  async set(key: string, value: string) {
    return this.client.set(key, value);
  }
}
