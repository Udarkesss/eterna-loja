"use client";

import s from "./admin.module.css";

/** EN: "Imprimir talão" (design): prints the order page. PT: "Imprimir talão": imprime a página da encomenda. */
export function PrintButton() {
  return (
    <button type="button" className={`${s.btnOutline} ${s.small}`} onClick={() => window.print()}>
      Imprimir talão
    </button>
  );
}
