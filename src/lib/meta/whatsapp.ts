import { getMetaCredentials } from "@/app/app/settings/integrations/actions";

export async function sendTemplate(to: string, templateName: string, languageCode = "pt_BR") {
  const creds = await getMetaCredentials();
  if (!creds || !creds.meta_access_token) throw new Error("Credenciais da Meta não encontradas");

  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: templateName,
      language: {
        code: languageCode,
      },
    },
  };

  const res = await fetch(`https://graph.facebook.com/v18.0/${creds.phone_number_id}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${creds.meta_access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(`Failed to send WhatsApp template: ${JSON.stringify(error)}`);
  }

  return res.json();
}
