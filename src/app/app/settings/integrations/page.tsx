"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { saveMetaCredentials, testMetaConnection, getMetaCredentials } from "./actions";

export default function IntegrationsPage() {
  const [wabaId, setWabaId] = useState("");
  const [phoneId, setPhoneId] = useState("");
  const [token, setToken] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    getMetaCredentials().then((creds) => {
      if (creds) {
        setWabaId(creds.waba_id);
        setPhoneId(creds.phone_number_id);
        setToken(creds.meta_access_token);
        setIsVerified(creds.is_verified);
      }
      setLoading(false);
    });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setMessage("Salvando...");
    try {
      await saveMetaCredentials({
        waba_id: wabaId,
        phone_number_id: phoneId,
        meta_access_token: token,
      });
      setMessage("Credenciais salvas com sucesso!");
      setIsVerified(false);
    } catch (err: unknown) {
      setMessage(`Erro: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function handleTest() {
    setMessage("Testando conexão...");
    try {
      const res = await testMetaConnection();
      setMessage(`Conexão OK! Conta: ${res.name}`);
      setIsVerified(true);
    } catch (err: unknown) {
      setMessage(`Erro no teste: ${err instanceof Error ? err.message : String(err)}`);
      setIsVerified(false);
    }
  }

  if (loading) return <div className="p-8">Carregando...</div>;

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="mb-4 text-2xl font-bold">Integração Meta (WhatsApp Cloud API)</h1>
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">
            WhatsApp Business Account ID (WABA_ID)
          </label>
          <input
            required
            value={wabaId}
            onChange={(e) => setWabaId(e.target.value)}
            className="w-full rounded border p-2 text-black"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Phone Number ID</label>
          <input
            required
            value={phoneId}
            onChange={(e) => setPhoneId(e.target.value)}
            className="w-full rounded border p-2 text-black"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Meta Access Token</label>
          <input
            required
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="w-full rounded border p-2 text-black"
          />
        </div>

        <div className="flex gap-4 pt-4">
          <Button type="submit">Salvar Credenciais</Button>
          <Button type="button" variant="outline" onClick={handleTest}>
            Testar Conexão
          </Button>
        </div>

        {message && <div className="mt-4 rounded bg-zinc-100 p-3 dark:bg-zinc-800">{message}</div>}
        {isVerified && (
          <div className="font-medium text-green-600">✓ Conta verificada com a Meta.</div>
        )}
      </form>
    </div>
  );
}
