// Fixture: every call here USES the access decision. None may match.
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
  if (!(await canAccessThreatModel(userId, modelId))) {
    return { status: 403 };
  }
  const access = await checkThreatModelAccess(userId, modelId);
  if (!access.allowed) return { status: 403 };
  const ok = await canPerformAction(userId, "threat:edit");
  if (!ok) return { status: 403 };
  return { ok: await canPerformAction(userId, "threat:delete") };
}

export const check = (u: string, m: string) => canAccessThreatModel(u, m);

export async function more(userId: string, modelId: string) {
  let allowed = false;
  allowed = await canAccessThreatModel(userId, modelId);
  const [a, b] = await Promise.all([
    canPerformAction(userId, "a"),
    canPerformAction(userId, "b"),
  ]);
  const both = (await canPerformAction(userId, "c")) && allowed;
  const label = (await canAccessThreatModel(userId, modelId)) ? "yes" : "no";
  await canAccessThreatModel(userId, modelId).then((ok) => {
    if (!ok) throw new Error("forbidden");
  });
  return [a, b, both, label];
}
