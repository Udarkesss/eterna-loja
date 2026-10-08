import { attachTransferProof } from "@/server/checkout";
import { AppError, jsonData, withErrorHandling } from "@/server/errors";
import { savePrivateUpload } from "@/server/uploads";

/**
 * POST /api/v1/orders/:id/proof  (multipart/form-data, field "file")
 * EN: Bank transfer proof — photo or PDF, up to 5 MB. PT: Comprovativo de transferência — foto ou PDF, até 5 MB.
 */
export const POST = withErrorHandling(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) throw new AppError("VALIDATION_ERROR", "Missing file", 400, { field: "file" });
    const ref = await savePrivateUpload(file, "proof");
    const status = await attachTransferProof(id, ref);
    if (!status) throw new AppError("NOT_FOUND", "Order not found", 404);
    return jsonData(status);
  },
);
