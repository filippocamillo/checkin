"use client";

import { useState, useTransition } from "react";
import { GuestForm } from "@/components/guest-form";
import { Badge, Button, Card, Input, cx } from "@/components/ui";
import { dictionaries, type Lang } from "@/lib/i18n";
import type { Guest, IdentificationRequest } from "@/lib/types";
import { acceptContract, guestExtract, guestSaveGuest } from "./actions";
import { Identify } from "./identify";

interface Props {
  token: string;
  initialLang: Lang;
  property: { name: string; city: string | null; checkInTime: string | null; instructions: Record<string, string> };
  booking: { checkIn: string; checkOut: string; expected: number; contractAcceptedAt: string | null };
  guests: Guest[];
  leadComplete: boolean;
  contractText: string;
  identification: {
    identified: boolean;
    request: IdentificationRequest | null;
    slotAt: string | null;
    accessCode: string | null;
    accessInstructions: Record<string, string>;
    iceServers: RTCIceServer[];
  };
}

type Step = "welcome" | "guests" | "contract" | "done";

function formatDay(iso: string, lang: Lang) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(lang === "it" ? "it-IT" : "en-GB", { weekday: "short", day: "numeric", month: "long" });
}

export function GuestFlow({ token, initialLang, property, booking, guests, leadComplete, contractText, identification }: Props) {
  const [lang, setLang] = useState<Lang>(initialLang);
  const t = dictionaries[lang];
  const allGuests = guests.length >= booking.expected;
  const initialStep: Step = booking.contractAcceptedAt && allGuests ? "done" : guests.length ? "guests" : "welcome";
  const [step, setStep] = useState<Step>(initialStep);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [fullName, setFullName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [accepting, startAccepting] = useTransition();

  const extract = (fd: FormData) => guestExtract(token, fd);
  const save = (id: string | null) => (fd: FormData) => guestSaveGuest(token, lang, id, fd);

  const steps: Step[] = ["guests", "contract", "done"];

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <header className="mb-5 flex items-center justify-between">
        <div className="min-w-0">
          <p className="truncate font-semibold">{property.name}</p>
          <p className="text-xs text-fg-muted">
            {formatDay(booking.checkIn, lang)} → {formatDay(booking.checkOut, lang)}
          </p>
        </div>
        <div className="flex rounded-full bg-muted p-1 text-xs">
          {(["it", "en"] as const).map((l) => (
            <button key={l} onClick={() => setLang(l)} className={cx("rounded-full px-3 py-1.5 uppercase", lang === l && "bg-surface font-semibold shadow-sm")}>
              {l}
            </button>
          ))}
        </div>
      </header>

      {step !== "welcome" && (
        <ol className="mb-5 flex gap-1.5">
          {steps.map((s, i) => (
            <li key={s} className={cx("h-1.5 flex-1 rounded-full", steps.indexOf(step) >= i ? "bg-accent" : "bg-line")} />
          ))}
        </ol>
      )}

      {step === "welcome" && (
        <div className="flex flex-1 flex-col gap-5">
          <div>
            <p className="text-sm text-fg-muted">{t.stayAt}</p>
            <h1 className="text-3xl font-semibold tracking-tight">{property.name}</h1>
          </div>
          <p>{t.intro}</p>
          <Card className="text-sm text-fg-muted">{t.privacy}</Card>
          <Button className="mt-auto min-h-14 text-base" onClick={() => setStep("guests")}>
            {t.start}
          </Button>
        </div>
      )}

      {step === "guests" && (
        <div className="flex flex-1 flex-col gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{t.guests}</h1>
            <p className="text-sm text-fg-muted">{t.guestsOf(guests.length, booking.expected)}</p>
          </div>

          {guests.map((g) =>
            editing === g.id ? (
              <GuestForm key={g.id} t={t} initial={g} isLead={g.position === 0} extract={extract} save={save(g.id)} onClose={() => setEditing(null)} />
            ) : (
              <Card key={g.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {g.first_name} {g.last_name}
                  </p>
                  {g.position === 0 && <Badge tone="info">{t.leadGuest}</Badge>}
                </div>
                <Button variant="secondary" onClick={() => setEditing(g.id)}>
                  {t.edit}
                </Button>
              </Card>
            ),
          )}

          {editing === "new" ? (
            <GuestForm t={t} isLead={guests.length === 0} extract={extract} save={save(null)} onClose={() => setEditing(null)} />
          ) : (
            !editing && (
              <div className="mt-auto flex flex-col gap-3">
                {!allGuests && (
                  <Button className="min-h-14 text-base" onClick={() => setEditing("new")}>
                    {guests.length === 0 ? t.scanDocument : t.addGuest}
                  </Button>
                )}
                {!leadComplete && guests.length > 0 && <p className="text-sm text-warn">{t.needLeadFirst}</p>}
                <Button
                  variant={allGuests ? "primary" : "secondary"}
                  className="min-h-14 text-base"
                  disabled={!allGuests || !leadComplete}
                  onClick={() => setStep(booking.contractAcceptedAt ? "done" : "contract")}
                >
                  {t.continue}
                </Button>
                {!allGuests && guests.length > 0 && <p className="text-center text-xs text-fg-muted">{t.needGuestsFirst}</p>}
              </div>
            )
          )}
        </div>
      )}

      {step === "contract" && (
        <div className="flex flex-1 flex-col gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">{t.contract}</h1>
          <p className="text-sm text-fg-muted">{t.contractIntro}</p>
          <Card className="max-h-[50dvh] overflow-y-auto text-sm leading-relaxed whitespace-pre-line">{contractText}</Card>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 size-5 accent-[var(--accent)]" />
            {t.acceptTerms}
          </label>
          <Input placeholder={t.typeFullName} value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
          <Button
            className="mt-auto min-h-14 text-base"
            disabled={!agreed || fullName.trim().length < 3 || accepting}
            onClick={() =>
              startAccepting(async () => {
                const res = await acceptContract(token, fullName);
                if (res.ok) setStep("done");
              })
            }
          >
            {t.accept}
          </Button>
        </div>
      )}

      {step === "done" && (
        <div className="flex flex-1 flex-col gap-5">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{t.done}</h1>
            {!identification.identified && <p className="mt-2">{t.doneIntro}</p>}
          </div>
          <Identify
            token={token}
            t={t}
            lang={lang}
            identified={identification.identified}
            accessCode={identification.accessCode}
            accessInstructions={identification.accessInstructions[lang] || identification.accessInstructions.it || null}
            request={identification.request}
            slotAt={identification.slotAt}
            iceServers={identification.iceServers}
          />
          {(property.instructions[lang] || property.instructions.it) && (
            <Card>
              <h2 className="mb-2 font-semibold">{t.instructions}</h2>
              <p className="text-sm whitespace-pre-line">{property.instructions[lang] || property.instructions.it}</p>
            </Card>
          )}
          <Button variant="ghost" onClick={() => setStep("guests")}>
            {t.guests}
          </Button>
        </div>
      )}
    </div>
  );
}
