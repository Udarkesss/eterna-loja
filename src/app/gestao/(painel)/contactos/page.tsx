import { ContactsEditor } from "@/components/admin/ContactsEditor";
import { PageTop } from "@/components/admin/ui";
import { contactsPage } from "@/server/admin/contacts";
import { requireStaffPage } from "@/server/staff/access";

export const metadata = { title: "Contactos e redes sociais" };

/** EN: "Gestão · Contactos e redes sociais" of design V3-G-Contactos. PT: Contactos e redes sociais do V3. */
export default async function ContactsPage() {
  await requireStaffPage("content");
  const data = await contactsPage();
  return (
    <>
      <PageTop
        eyebrow="Site"
        title={
          <>
            Contactos e <em>redes sociais</em>
          </>
        }
      />
      <ContactsEditor stores={data.stores} contacts={data.contacts} />
    </>
  );
}
