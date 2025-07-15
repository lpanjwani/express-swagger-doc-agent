import { createClient } from "redis";

export class RedisService {
  client: ReturnType<typeof createClient>;

  constructor() {
    this.createClient();
    this.connect();
  }

  createClient(): void {
    this.client = createClient({
      url: process.env.REDIS_URL || "redis://localhost:6380",
      password: process.env.REDIS_PASSWORD || "12345678",
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
