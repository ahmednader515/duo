/** Preserve pg's current certificate and hostname verification explicitly. */
export function postgresConnectionString(connectionString: string): string {
  const url = new URL(connectionString);
  const mode = url.searchParams.get("sslmode");
  if (
    mode &&
    ["prefer", "require", "verify-ca"].includes(mode) &&
    url.searchParams.get("uselibpqcompat") !== "true"
  ) {
    url.searchParams.set("sslmode", "verify-full");
  }
  return url.toString();
}
