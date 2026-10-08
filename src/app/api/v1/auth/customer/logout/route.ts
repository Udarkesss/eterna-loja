import { logoutCustomer } from "@/server/accounts";
import { jsonData, withErrorHandling } from "@/server/errors";

/** POST /api/v1/auth/customer/logout — EN: ends this session. PT: termina esta sessão. */
export const POST = withErrorHandling(async () => {
  await logoutCustomer();
  return jsonData({ signedOut: true });
});
