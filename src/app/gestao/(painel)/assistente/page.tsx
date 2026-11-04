import { AssistantEditor } from "@/components/admin/AssistantEditor";
import { PageTop } from "@/components/admin/ui";
import { assistantStats, inbox } from "@/server/assistant/chat";
import { assistantSettings } from "@/server/assistant/engine";
import { whatsappConfigured } from "@/server/assistant/whatsapp";
import { storeWhatsappNumber } from "@/server/contacts";
import { deliveryEnabled } from "@/server/content";
import { requireStaffPage } from "@/server/staff/access";

export const metadata = { title: "Assistente" };

/** EN: "Gestão · Assistente: chat e WhatsApp" of design V3-G-Assistente. PT: Assistente do V3. */
export default async function AssistantPage() {
  await requireStaffPage("content");
  const [settings, stats, items, wa, delivery] = await Promise.all([assistantSettings(), assistantStats(), inbox(), storeWhatsappNumber(), deliveryEnabled()]);
  const waNumber = `+${wa.slice(0, 3)} ${wa.slice(3, 5)} ${wa.slice(5, 8)} ${wa.slice(8)}`;
  return (
    <>
      <PageTop
        eyebrow="Site"
        title={
          <>
            Assistente: <em>chat e WhatsApp</em>
          </>
        }
      />
      <AssistantEditor
        settings={settings}
        stats={stats}
        inbox={items.map((x) => ({ id: x.id, channel: x.channel, who: x.who, at: x.at, last: x.last, messages: x.messages.map((m) => ({ id: m.id, from: m.from, text: m.text, at: m.at })) }))}
        waNumber={waNumber}
        waReady={whatsappConfigured()}
        delivery={delivery}
      />
    </>
  );
}
