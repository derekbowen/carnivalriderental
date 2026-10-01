import { getDb } from "@/lib/db";
import { internalRoute, jsonBody } from "@/lib/internal-api";
import { createSupplier, listSuppliers, RuleError } from "@/lib/requests/repo";

export const dynamic = "force-dynamic";

export const GET = internalRoute(() => Response.json({ suppliers: listSuppliers(getDb()) }));

export const POST = internalRoute(async (req) => {
  const b = await jsonBody(req);
  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name) throw new RuleError("Enter the supplier's business name.", "no_name", 400);
  const s = createSupplier(getDb(), {
    name,
    region: typeof b.region === "string" ? b.region : null,
    contact: typeof b.contact === "string" ? b.contact : null,
    notes: typeof b.notes === "string" ? b.notes : null,
  });
  return Response.json({ supplier: s }, { status: 201 });
});
