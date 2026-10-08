"use client";

import { useState, useTransition } from "react";
import { demoDataAction, type SettingsResult } from "@/app/gestao/actions/settings";
import s from "./admin.module.css";

/**
 * EN: Load / remove the demo data (only rows marked as demo; real data is never touched).
 * PT: Carregar / apagar os dados de exemplo (só as linhas marcadas; os dados reais nunca são tocados).
 */
export function DemoControls({ status }: { status: { orders: number; staff: number } }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<SettingsResult | null>(null);
  const loaded = status.orders > 0 || status.staff > 0;
  return (
    <section className={s.card}>
      <h2 className={s.h2}>Dados de exemplo</h2>
      <p className={s.muted}>
        Para ver o sistema a funcionar antes de abrir ao público: equipa de todos os papéis, clientes, encomendas em todos os estados, provas desta semana e registos de
        auditoria. Os nomes aparecem entre [parênteses rectos]. Apagar remove só estes dados. A palavra-passe da equipa de exemplo está em DEMO_PASSWORD no .env.local.
      </p>
      {loaded && (
        <span className={s.chip} data-tone="warn">
          Carregados: {status.orders} encomendas · {status.staff} pessoas da equipa
        </span>
      )}
      {result && <div className={result.ok ? s.notice : s.error}>{result.message}</div>}
      <div className={s.actions}>
        <button className={s.btn} disabled={pending} onClick={() => start(async () => setResult(await demoDataAction(true)))}>
          {loaded ? "Recarregar dados de exemplo" : "Carregar dados de exemplo"}
        </button>
        {loaded && (
          <button className={s.btnDanger} disabled={pending} onClick={() => window.confirm("Apagar todos os dados de exemplo?") && start(async () => setResult(await demoDataAction(false)))}>
            Apagar dados de exemplo
          </button>
        )}
      </div>
    </section>
  );
}
