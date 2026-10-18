import "server-only";
import type { ClientSession } from "mongoose";
import { AuditLog, type IAuditLog } from "@/models/AuditLog";
import { logger } from "@/lib/logger";
import type { SessionUser } from "@/lib/auth/current";

export async function audit(
  entry: {
    action: string;
    actor?: Pick<SessionUser, "id" | "role"> | null;
    actorRole?: IAuditLog["actorRole"];
    targetType?: string;
    targetId?: string;
    ip?: string;
    metadata?: Record<string, unknown>;
  },
  session?: ClientSession,
) {
  try {
    await AuditLog.create(
      [
        {
          action: entry.action,
          actorId: entry.actor?.id,
          actorRole: entry.actorRole ?? entry.actor?.role ?? "anonymous",
          targetType: entry.targetType,
          targetId: entry.targetId,
          ip: entry.ip,
          metadata: entry.metadata,
        },
      ],
      { session },
    );
  } catch (err) {
    // Auditing must not break the user's action, but failures are surfaced in logs.
    logger.error("audit.write_failed", { action: entry.action, error: err });
    if (session) throw err;
  }
}
