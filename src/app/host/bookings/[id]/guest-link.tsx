"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

export function GuestLink({ url, propertyName, phone }: { url: string; propertyName: string; phone: string | null }) {
  const [copied, setCopied] = useState<string | null>(null);
  const message = `Ciao! Per completare il check-in a ${propertyName} compila i dati degli ospiti qui / Hi! Please complete your check-in for ${propertyName} here: ${url}`;

  async function copy(text: string, what: string) {
    await navigator.clipboard.writeText(text);
    setCopied(what);
    setTimeout(() => setCopied(null), 2000);
  }

  const digits = phone?.replace(/[^\d]/g, "");

  return (
    <div className="flex flex-col gap-3">
      <p className="break-all rounded-xl bg-muted p-3 font-mono text-xs">{url}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => copy(url, "link")}>
          {copied === "link" ? "Copiato" : "Copia link"}
        </Button>
        <Button variant="secondary" onClick={() => copy(message, "msg")}>
          {copied === "msg" ? "Copiato" : "Copia messaggio IT/EN"}
        </Button>
        {digits && digits.length > 6 && (
          <a className="inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-medium hover:bg-muted" href={`https://wa.me/${digits}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">
            Invia su WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}
