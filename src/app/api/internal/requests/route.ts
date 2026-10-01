import { getDb } from "@/lib/db";
import { internalRoute } from "@/lib/internal-api";
import { listRequests } from "@/lib/requests/repo";

export const dynamic = "force-dynamic";

export const GET = internalRoute(() => Response.json({ requests: listRequests(getDb()) }));
