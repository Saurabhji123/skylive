type LogLevel = "log" | "info" | "warn" | "error";

const isDevEnvironment = process.env.NODE_ENV !== "production";

export function clientLog(level: LogLevel, ...args: unknown[]): void {
  if (!isDevEnvironment) {
    return;
  }

  const target = console[level] ?? console.log;
  target(...args);
}
