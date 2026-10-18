import { MongoMemoryReplSet } from "mongodb-memory-server";

let replSet: MongoMemoryReplSet | undefined;

// A single-node replica set is required for multi-document transactions.
export async function setup() {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  process.env.TEST_MONGODB_URI = replSet.getUri();
}

export async function teardown() {
  await replSet?.stop();
}
