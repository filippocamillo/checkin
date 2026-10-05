"use client";

import { useState } from "react";
import { GuestForm } from "@/components/guest-form";
import { Badge, Button, Card } from "@/components/ui";
import { countryName } from "@/lib/countries";
import { dictionaries } from "@/lib/i18n";
import type { Guest } from "@/lib/types";
import { deleteGuest, hostExtract, hostSaveGuest } from "../actions";

const t = dictionaries.it;

export function HostGuests({ bookingId, guests, expected }: { bookingId: string; guests: Guest[]; expected: number }) {
  const [editing, setEditing] = useState<string | "new" | null>(null);

  return (
    <div className="flex flex-col gap-3">
      {guests.map((g) =>
        editing === g.id ? (
          <GuestForm
            key={g.id}
            t={t}
            initial={g}
            isLead={g.position === 0}
            extract={hostExtract}
            save={(fd) => hostSaveGuest(bookingId, g.id, fd)}
            onClose={() => setEditing(null)}
          />
        ) : (
          <Card key={g.id} className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">
                  {g.first_name} {g.last_name}
                </p>
                {g.position === 0 && <Badge tone="info">{t.leadGuest}</Badge>}
                {g.extraction?.source === "mrz+vision" && <Badge tone="ok">MRZ verificata</Badge>}
                {g.extraction?.warnings?.length ? <Badge tone="warn">Da controllare</Badge> : null}
              </div>
              <p className="mt-1 text-sm text-fg-muted">
                {[g.birth_date, countryName(g.citizenship), g.document_number].filter(Boolean).join(" · ")}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setEditing(g.id)}>
                Modifica
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  if (confirm(`Eliminare ${g.first_name} ${g.last_name}?`)) deleteGuest(bookingId, g.id);
                }}
              >
                Elimina
              </Button>
            </div>
          </Card>
        ),
      )}

      {editing === "new" ? (
        <GuestForm
          t={t}
          isLead={guests.length === 0}
          extract={hostExtract}
          save={(fd) => hostSaveGuest(bookingId, null, fd)}
          onClose={() => setEditing(null)}
        />
      ) : (
        <div className="flex items-center gap-3">
          <Button variant={guests.length < expected ? "primary" : "secondary"} onClick={() => setEditing("new")}>
            Aggiungi ospite da documento
          </Button>
          <span className="text-sm text-fg-muted">
            {guests.length}/{expected} ospiti
          </span>
        </div>
      )}
    </div>
  );
}
