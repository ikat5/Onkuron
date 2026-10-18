import { describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { connectDB, disconnectDB } from "@/lib/db";
import { ConfigError, getDbEnv } from "@/lib/env";
import { redact, redactString } from "@/lib/logger";
import { applyTestEnv } from "./helpers/setup";

describe("MongoDB connection singleton", () => {
  it("reuses one connection across calls and concurrent callers", async () => {
    await disconnectDB();
    const [a, b, c] = await Promise.all([connectDB(), connectDB(), connectDB()]);
    expect(a).toBe(b);
    expect(b).toBe(c);
    const before = mongoose.connections.length;
    const d = await connectDB();
    expect(d).toBe(a);
    expect(mongoose.connections.length).toBe(before);
    expect(mongoose.connection.readyState).toBe(1);
    expect(mongoose.connection.name).toBe("onkuron_test");
  });

  it("fails clearly when MONGODB_URI is missing, without opening a connection", async () => {
    await disconnectDB();
    applyTestEnv({ MONGODB_URI: undefined });
    await expect(connectDB()).rejects.toBeInstanceOf(ConfigError);
    await expect(connectDB()).rejects.toThrow(/MONGODB_URI/);
    expect(mongoose.connection.readyState).toBe(0);
    applyTestEnv();
    await connectDB(); // a later call can retry successfully
    expect(mongoose.connection.readyState).toBe(1);
  });

  it("rejects the unfilled <DB_PASSWORD> template", () => {
    applyTestEnv({ MONGODB_URI: "mongodb+srv://u:<DB_PASSWORD>@cluster.example.net/" });
    expect(() => getDbEnv()).toThrow(ConfigError);
  });

  it("never includes credentials in configuration errors or logs", () => {
    applyTestEnv({ MONGODB_URI: "not-a-uri-but-contains-SECRETPASS" });
    try {
      getDbEnv();
      expect.unreachable();
    } catch (e) {
      expect((e as Error).message).not.toContain("SECRETPASS");
    }
    expect(redactString("failed mongodb+srv://user:hunter2@host.net/db")).toBe("failed mongodb+srv://***:***@host.net/db");
    const out = JSON.stringify(redact({ password: "p", nested: { apiSecret: "s", token: "t", note: "ok" } }));
    expect(out).not.toMatch(/"p"|"s"|"t"/);
    expect(out).toContain("ok");
  });
});
