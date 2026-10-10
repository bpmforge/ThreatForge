// Fixture: every call here discards the access decision. Each MUST match (7).
declare function canAccessThreatModel(
  userId: string,
  modelId: string,
): Promise<boolean>;
declare function checkThreatModelAccess(
  userId: string,
  modelId: string,
): Promise<{ allowed: boolean }>;
declare function canPerformAction(
  userId: string,
  action: string,
): Promise<boolean>;

export async function handler(userId: string, modelId: string) {
  await canAccessThreatModel(userId, modelId);
  await checkThreatModelAccess(userId, modelId);
  await canPerformAction(userId, "threat:edit");
  canAccessThreatModel(userId, modelId);
  void canPerformAction(userId, "threat:delete");
  return { ok: true };
}

// The real shape (gap-analysis.ts before b9f85277): the bare check sits inside
// a route callback that is itself a call argument.
declare const fastify: {
  get: (path: string, h: (req: unknown) => Promise<unknown>) => void;
};
fastify.get("/threat-models/:id/gap-analysis", async () => {
  await canAccessThreatModel("user", "model");
  await canPerformAction("user", "threat:read");
  return [];
});
