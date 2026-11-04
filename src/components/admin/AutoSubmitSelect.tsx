"use client";

import type { ComponentProps } from "react";

/**
 * EN: A filter <select> that applies itself (design V3 has no "Filtrar" button): changing it submits its form.
 * PT: Um <select> de filtro que se aplica sozinho (o V3 não tem botão "Filtrar"): ao mudar, envia o formulário.
 */
export function AutoSubmitSelect(props: ComponentProps<"select">) {
  return <select {...props} onChange={(e) => e.currentTarget.form?.requestSubmit()} />;
}
