import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import d3 from "./Dashboard.module.css";

/** EN: "Módulo de entregas desligado" note of design V3. PT: Nota do módulo de entregas desligado (V3). */
export function DeliveryOffNote() {
  return (
    <div className={d3.deliveryOff}>
      <Icon name="truck" size={18} />
      <span>
        Módulo de entregas <strong>desligado</strong>: o site só oferece levantamento na loja. Liga-se em Definições → Módulo de entregas.
      </span>
      <Link href="/gestao/definicoes" className={d3.ulink}>
        Definições
      </Link>
    </div>
  );
}
