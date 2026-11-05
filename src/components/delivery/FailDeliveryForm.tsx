"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { failDeliveryAction } from "@/app/gestao/actions/driver";
import { Icon } from "@/components/ui/Icon";
import s from "./driver.module.css";

/**
 * EN: "Não consegui entregar" of design V3-E-Falhou: the reason, a note for the store and an optional photo of the door.
 * PT: "Não consegui entregar" do V3: o motivo, uma nota para a loja e uma foto da porta (opcional).
 */
export function FailDeliveryForm({ orderId, reasons }: { orderId: string; reasons: string[] }) {
  const router = useRouter();
  const [reason, setReason] = useState(reasons[0]);
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const file = useRef<HTMLInputElement>(null);

  return (
    <form
      className={s.section}
      style={{ display: "flex", flexDirection: "column", gap: 14 }}
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const form = new FormData();
          form.set("reason", reason);
          form.set("note", note);
          if (photo) form.set("photo", photo);
          const r = await failDeliveryAction(orderId, form);
          if (!r.ok) return setError(r.message ?? "Não foi possível. Tente outra vez.");
          router.replace("/gestao/entregador");
        });
      }}
    >
      <fieldset style={{ border: 0, padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        <legend className={s.label} style={{ marginBottom: 6 }}>
          Motivo
        </legend>
        {reasons.map((r) => (
          <label key={r} className={s.card} style={{ flexDirection: "row", alignItems: "center", gap: 12, cursor: "pointer", borderColor: reason === r ? "var(--ink)" : undefined }}>
            <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} />
            <span>{r}</span>
          </label>
        ))}
      </fieldset>
      <label className={s.label} htmlFor="note">
        Nota para a loja
      </label>
      <textarea id="note" className={s.input} style={{ minHeight: 90, paddingTop: 12 }} maxLength={600} placeholder="Ex.: liguei 3 vezes às 16:25, 16:30 e 16:40. Ninguém na portaria." value={note} onChange={(e) => setNote(e.target.value)} />
      <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
      <button type="button" className={s.btnOutline} onClick={() => file.current?.click()}>
        <Icon name="camera" size={18} />
        {photo ? `Foto: ${photo.name.slice(0, 24)}` : "Tirar foto da porta (opcional)"}
      </button>
      <span className={s.muted}>A encomenda volta à loja. A gestão recebe o aviso e marca outro dia com a cliente.</span>
      {error && (
        <span role="alert" className={s.error}>
          {error}
        </span>
      )}
      <button type="submit" className={s.btn} disabled={pending}>
        Registar e voltar à loja
      </button>
    </form>
  );
}
