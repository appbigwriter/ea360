"use server";

import { createClient } from "@/lib/supabase/server";
import { encrypt, decrypt } from "@/lib/meta/crypto";

export async function getMetaCredentials() {
  const supabase = await createClient();
  // get user business
  const { data: biz } = await supabase.from("businesses").select("id").limit(1).single();
  if (!biz) return null;

  const { data: creds } = await supabase
    .from("meta_integrations")
    .select("*")
    .eq("business_id", biz.id)
    .maybeSingle();

  if (creds) {
    return {
      ...creds,
      meta_access_token: decrypt(creds.meta_access_token),
    };
  }
  return null;
}

export async function saveMetaCredentials(data: {
  waba_id: string;
  meta_access_token: string;
  phone_number_id: string;
}) {
  const supabase = await createClient();
  const { data: biz } = await supabase.from("businesses").select("id").limit(1).single();
  if (!biz) throw new Error("Business not found");

  const encryptedToken = encrypt(data.meta_access_token);

  const { error } = await supabase.from("meta_integrations").upsert(
    {
      business_id: biz.id,
      waba_id: data.waba_id,
      meta_access_token: encryptedToken,
      phone_number_id: data.phone_number_id,
      is_verified: false,
    },
    { onConflict: "business_id" }
  );

  if (error) throw new Error(error.message);
  return { success: true };
}

export async function testMetaConnection() {
  const creds = await getMetaCredentials();
  if (!creds || !creds.meta_access_token) throw new Error("Credenciais não configuradas");

  const res = await fetch(`https://graph.facebook.com/v18.0/me`, {
    headers: {
      Authorization: `Bearer ${creds.meta_access_token}`,
    },
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "Falha na conexão com a Meta");
  }

  const result = await res.json();

  // Mark as verified
  const supabase = await createClient();
  await supabase.from("meta_integrations").update({ is_verified: true }).eq("id", creds.id);

  return { success: true, name: result.name };
}
