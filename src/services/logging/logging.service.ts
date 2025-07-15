export enum LogLevel {
  INFO = "INFO",
  SUCCESS = "SUCCESS",
  ERROR = "ERROR",
  WARNING = "WARNING",
  TOOL = "TOOL",
  LLM = "LLM",
  VALIDATION = "VALIDATION",
  NODE = "NODE",
  CACHE = "CACHE",
}

const LogLevelPrefix: Record<LogLevel, string> = {
  [LogLevel.INFO]: "📘",
  [LogLevel.SUCCESS]: "✅",
  [LogLevel.ERROR]: "❌",
  [LogLevel.WARNING]: "⚠️",
  [LogLevel.TOOL]: "🔧",
  [LogLevel.LLM]: "🤖",
  [LogLevel.VALIDATION]: "🔍",
  [LogLevel.NODE]: "🏗️",
  [LogLevel.CACHE]: "🗄️",
};

export class LoggingService {
  log(message: string, level: LogLevel = LogLevel.INFO) {
    const timestamp = new Date().toISOString();
    const prefix = LogLevelPrefix[level] || LogLevelPrefix[LogLevel.INFO];
    console.log(`[${timestamp}] ${prefix} ${message}`);
  }
}
