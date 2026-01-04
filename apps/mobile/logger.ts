type LogLevel = "debug" | "info" | "warn" | "error";

const levelOrder: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const currentLevel = (process.env.EXPO_PUBLIC_LOG_LEVEL ?? "info") as LogLevel;

function shouldLog(level: LogLevel) {
  return levelOrder[level] >= levelOrder[currentLevel];
}

function formatMessage(level: LogLevel, message: string, data?: unknown) {
  const prefix = `[mobile:${level}]`;
  if (data === undefined) return `${prefix} ${message}`;
  try {
    return `${prefix} ${message} ${JSON.stringify(data)}`;
  } catch {
    return `${prefix} ${message}`;
  }
}

export function logDebug(message: string, data?: unknown) {
  if (!shouldLog("debug")) return;
  console.log(formatMessage("debug", message, data));
}

export function logInfo(message: string, data?: unknown) {
  if (!shouldLog("info")) return;
  console.log(formatMessage("info", message, data));
}

export function logWarn(message: string, data?: unknown) {
  if (!shouldLog("warn")) return;
  console.warn(formatMessage("warn", message, data));
}

export function logError(message: string, data?: unknown) {
  if (!shouldLog("error")) return;
  console.error(formatMessage("error", message, data));
}
