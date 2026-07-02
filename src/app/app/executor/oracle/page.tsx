"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { queryOracle, QAResponse } from "./actions";

type Message = {
  role: "user" | "oracle";
  content: string;
  sources?: { title: string; url: string }[];
};

export default function OraclePage() {
  const [history, setHistory] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;

    const userMessage: Message = { role: "user", content: question.trim() };
    setHistory((prev) => [...prev, userMessage]);
    setQuestion("");
    setIsPending(true);

    const res: QAResponse = await queryOracle(userMessage.content);

    setIsPending(false);
    if (res.error) {
      setHistory((prev) => [...prev, { role: "oracle", content: `Erro: ${res.error}` }]);
      return;
    }

    setHistory((prev) => [...prev, { role: "oracle", content: res.answer, sources: res.sources }]);
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-64px)] max-w-4xl flex-col p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Oráculo</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Tire dúvidas sobre conformidade e políticas da Meta com base em nossa base de conhecimento
          vetorial.
        </p>
      </div>

      <div className="mb-4 flex-1 space-y-4 overflow-y-auto rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
        {history.length === 0 ? (
          <div className="flex h-full items-center justify-center text-zinc-500">
            Faça sua primeira pergunta abaixo para consultar o Oráculo.
          </div>
        ) : (
          history.map((msg, i) => (
            <div
              key={i}
              className={`flex max-w-[80%] flex-col rounded-lg p-4 ${
                msg.role === "user"
                  ? "ml-auto self-end bg-blue-600 text-white"
                  : "border border-zinc-200 bg-white text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              }`}
            >
              <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-700">
                  <p className="mb-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    Fontes Citadas:
                  </p>
                  <ul className="space-y-1 text-xs">
                    {msg.sources.map((src, idx) => (
                      <li key={idx}>
                        <a
                          href={src.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-500 hover:underline"
                        >
                          {src.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))
        )}
        {isPending && (
          <div className="flex max-w-[80%] flex-col rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
            <span className="animate-pulse text-sm text-zinc-500">Consultando Oráculo...</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={isPending}
          placeholder="Ex: O que é permitido na categoria Marketing?"
          className="flex-1 rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
        <Button type="submit" disabled={isPending || !question.trim()}>
          Perguntar
        </Button>
      </form>
    </div>
  );
}
