import { getDb } from "./db";
import { RequestService } from "./service";

const globalForSvc = globalThis as unknown as { __bacSvc?: RequestService };

export function getRequestService(): RequestService {
  if (!globalForSvc.__bacSvc) globalForSvc.__bacSvc = new RequestService(getDb());
  return globalForSvc.__bacSvc;
}

export { DomainError, RequestService } from "./service";
