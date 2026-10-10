/**
 * In-memory Prisma stand-in for route authorization tests.
 *
 * Honors `where` filters (scalar equality, `{ in: [...] }`, and to-one
 * relation filters declared in `relations`), so a test can tell a lookup
 * bound to its parent from one by child id alone: `findUnique({id})` finds
 * another tenant's row, `findFirst({id, parentId})` does not. Compound
 * unique keys (`userId_organizationId: {...}`) match on their sub-fields.
 */
import { vi } from "vitest";

export type Row = Record<string, unknown>;

/** model -> relation field -> [parent model, foreign key on the child row] */
export type Relations = Record<string, Record<string, [string, string]>>;

export function createFakePrisma(
  tables: Record<string, Row[]>,
  relations: Relations = {},
) {
  const rowsOf = (model: string): Row[] => (tables[model] ??= []);

  function matches(model: string, row: Row, where: Row = {}): boolean {
    return Object.entries(where).every(([key, cond]) => {
      if (cond !== null && typeof cond === "object" && !Array.isArray(cond)) {
        const obj = cond as Row;
        if ("in" in obj) return (obj.in as unknown[]).includes(row[key]);
        const rel = relations[model]?.[key];
        // Compound unique key, e.g. userId_organizationId: { userId, organizationId }
        if (!rel && key.split("_").every((f) => f in obj)) {
          return Object.entries(obj).every(([f, v]) => row[f] === v);
        }
        if (!rel) throw new Error(`fake-prisma: no relation ${model}.${key}`);
        const [parentModel, fk] = rel;
        const parent = rowsOf(parentModel).find((r) => r.id === row[fk]);
        return parent !== undefined && matches(parentModel, parent, obj);
      }
      return row[key] === cond;
    });
  }

  function delegate(model: string) {
    const filter = (where?: Row) =>
      rowsOf(model).filter((r) => matches(model, r, where));
    return {
      findUnique: vi.fn(
        async ({ where }: { where: Row }): Promise<Row | null> =>
          filter(where)[0] ?? null,
      ),
      findFirst: vi.fn(
        async (args: { where?: Row } = {}): Promise<Row | null> =>
          filter(args.where)[0] ?? null,
      ),
      findMany: vi.fn(async (args: { where?: Row } = {}) => filter(args.where)),
      count: vi.fn(
        async (args: { where?: Row } = {}) => filter(args.where).length,
      ),
      aggregate: vi.fn(async () => ({ _max: { order: null } })),
      create: vi.fn(async ({ data }: { data: Row }) => ({
        id: `new-${model}`,
        ...data,
      })),
      update: vi.fn(async ({ where, data }: { where: Row; data: Row }) => {
        const row = filter(where)[0];
        if (!row) throw new Error(`fake-prisma: ${model}.update found no row`);
        return { ...row, ...data };
      }),
      updateMany: vi.fn(async ({ where }: { where?: Row }) => ({
        count: filter(where).length,
      })),
      delete: vi.fn(async ({ where }: { where: Row }) => {
        const row = filter(where)[0];
        if (!row) throw new Error(`fake-prisma: ${model}.delete found no row`);
        return row;
      }),
      deleteMany: vi.fn(async ({ where }: { where?: Row }) => ({
        count: filter(where).length,
      })),
      upsert: vi.fn(async ({ create }: { create: Row }) => ({
        id: `new-${model}`,
        ...create,
      })),
    };
  }

  const cache = new Map<string, ReturnType<typeof delegate>>();
  return new Proxy({} as Record<string, ReturnType<typeof delegate>>, {
    get(_t, model: string) {
      if (typeof model !== "string" || model === "then") return undefined;
      if (!cache.has(model)) cache.set(model, delegate(model));
      return cache.get(model);
    },
  });
}
