import mongoose, { type Model, type Schema } from "mongoose";

/** Reuse compiled models across hot reloads instead of recompiling them. */
export function model<T>(name: string, schema: Schema<T>): Model<T> {
  return (mongoose.models[name] as Model<T> | undefined) ?? mongoose.model<T>(name, schema);
}
