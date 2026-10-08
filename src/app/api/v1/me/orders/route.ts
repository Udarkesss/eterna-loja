import { requireCustomer } from "@/server/accounts";
import { jsonData, withErrorHandling } from "@/server/errors";
import { listCustomerOrders } from "@/server/orders";

/** GET /api/v1/me/orders — EN: "As minhas encomendas". PT: As minhas encomendas. */
export const GET = withErrorHandling(async () => jsonData(await listCustomerOrders((await requireCustomer()).id)));
