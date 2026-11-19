import { test } from "node:test";
import assert from "node:assert/strict";
import { postgresConnectionString } from "../src/lib/database-url";
import { databaseErrorInfo } from "../src/lib/database-error";

test("ambiguous pg TLS modes explicitly retain full certificate verification", () => {
  for (const mode of ["prefer", "require", "verify-ca"]) {
    const url = new URL(
      postgresConnectionString(
        `postgresql://user:password@db.example/duo?sslmode=${mode}&channel_binding=require`,
      ),
    );
    assert.equal(url.searchParams.get("sslmode"), "verify-full");
    assert.equal(url.searchParams.get("channel_binding"), "require");
  }
});
test("local database and explicitly configured TLS modes are preserved", () => {
  for (const query of [
    "sslmode=disable",
    "sslmode=verify-full",
    "uselibpqcompat=true&sslmode=require",
    "",
  ]) {
    const source = `postgresql://user:password@localhost:5432/duo${query ? `?${query}` : ""}`;
    assert.equal(postgresConnectionString(source), source);
  }
});
test("missing tables are recognized through Prisma raw-query adapter errors", () => {
  assert.equal(
    databaseErrorInfo({
      code: "P2010",
      meta: {
        driverAdapterError: {
          cause: {
            originalCode: "42P01",
            originalMessage: "private query details",
          },
        },
      },
    }).missingSchema,
    true,
  );
  assert.equal(
    databaseErrorInfo({ code: "P2010", meta: { code: "42703" } }).missingSchema,
    true,
  );
  assert.equal(databaseErrorInfo({ code: "P2021" }).missingSchema, true);
  assert.equal(databaseErrorInfo({ code: "P1001" }).unavailable, true);
  assert.equal(databaseErrorInfo({ code: "P2002" }).missingSchema, false);
  assert.equal(databaseErrorInfo(null).missingSchema, false);
});
