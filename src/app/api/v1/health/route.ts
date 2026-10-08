import { jsonData } from "@/server/errors";

/**
 * GET /api/v1/health
 * EN: Lets monitoring (and the mobile app) check that the API is up.
 * PT: Permite à monitorização (e à app móvel) verificar que a API está a funcionar.
 */
export function GET() {
  return jsonData({ status: "ok", version: "v1" });
}
