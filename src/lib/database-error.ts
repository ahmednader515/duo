function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

/** Extract safe diagnostics only: never log query arguments, URLs, or raw error messages. */
export function databaseErrorInfo(error: unknown) {
  const value = record(error);
  const meta = record(value.meta);
  const cause = record(record(meta.driverAdapterError).cause);
  const code = typeof value.code === "string" ? value.code : undefined;
  const databaseCode =
    typeof cause.originalCode === "string"
      ? cause.originalCode
      : typeof meta.code === "string"
        ? meta.code
        : undefined;
  const missingSchema =
    code === "P2021" ||
    code === "P2022" ||
    (code === "P2010" &&
      (databaseCode === "42P01" || databaseCode === "42703"));
  const unavailable = [
    "P1000",
    "P1001",
    "P1002",
    "P1003",
    "P1008",
    "P1010",
    "P1011",
    "P1017",
    "P2024",
    "P2037",
  ].includes(code || "");
  return { code, databaseCode, missingSchema, unavailable };
}
