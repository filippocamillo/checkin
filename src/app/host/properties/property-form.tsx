import { Button, Card, Field, Input, Textarea } from "@/components/ui";
import { DEFAULT_CONTRACT_TEMPLATE } from "@/lib/contract";
import type { Property } from "@/lib/types";

export function PropertyForm({ property, action, hasNukiToken = false }: { property?: Property; action: (fd: FormData) => Promise<void>; hasNukiToken?: boolean }) {
  const p = property;
  return (
    <form action={action} className="flex flex-col gap-6">
      <Card className="grid gap-4 sm:grid-cols-2">
        <h2 className="font-semibold sm:col-span-2">Dati dell&apos;appartamento</h2>
        <Field label="Nome">
          <Input name="name" defaultValue={p?.name} required placeholder="La Casa Imperfetta" />
        </Field>
        <Field label="Locatore" hint="Nome e cognome o ragione sociale, appare nel contratto">
          <Input name="host_name" defaultValue={p?.host_name ?? ""} />
        </Field>
        <Field label="Codice fiscale / P. IVA del locatore">
          <Input name="host_tax_code" defaultValue={p?.host_tax_code ?? ""} />
        </Field>
        <Field label="CIN" hint="Codice Identificativo Nazionale">
          <Input name="cin" defaultValue={p?.cin ?? ""} />
        </Field>
        <Field label="Indirizzo">
          <Input name="address" defaultValue={p?.address ?? ""} />
        </Field>
        <div className="grid grid-cols-[1fr_5rem] gap-3">
          <Field label="Comune">
            <Input name="city" defaultValue={p?.city ?? ""} />
          </Field>
          <Field label="Prov.">
            <Input name="province" defaultValue={p?.province ?? ""} maxLength={2} />
          </Field>
        </div>
        <Field label="Orario check-in">
          <Input name="check_in_time" type="time" defaultValue={p?.check_in_time?.slice(0, 5) ?? "15:00"} />
        </Field>
        <Field label="Orario check-out">
          <Input name="check_out_time" type="time" defaultValue={p?.check_out_time?.slice(0, 5) ?? "10:00"} />
        </Field>
        <Field label="ID appartamento Alloggiati Web" hint="Solo se il tuo account Alloggiati gestisce più appartamenti">
          <Input name="alloggiati_apartment_id" defaultValue={p?.alloggiati_apartment_id ?? ""} />
        </Field>
      </Card>

      <Card className="grid gap-4 sm:grid-cols-3">
        <h2 className="font-semibold sm:col-span-3">Tassa di soggiorno</h2>
        <Field label="€ per persona a notte">
          <Input name="tax_rate_per_night" inputMode="decimal" defaultValue={p?.tax_rate_per_night ?? ""} />
        </Field>
        <Field label="Notti massime tassabili">
          <Input name="tax_max_nights" inputMode="numeric" defaultValue={p?.tax_max_nights ?? ""} />
        </Field>
        <Field label="Esenti sotto i (anni)">
          <Input name="tax_exempt_under_age" inputMode="numeric" defaultValue={p?.tax_exempt_under_age ?? ""} />
        </Field>
      </Card>

      <Card className="grid gap-4">
        <h2 className="font-semibold">Istruzioni per l&apos;ospite</h2>
        <Field label="Italiano" hint="Wi-Fi, parcheggio, regole della casa. L'ospite le vede appena completa il check-in.">
          <Textarea name="instructions_it" defaultValue={p?.guest_instructions?.it ?? ""} />
        </Field>
        <Field label="English">
          <Textarea name="instructions_en" defaultValue={p?.guest_instructions?.en ?? ""} />
        </Field>
      </Card>

      <Card className="grid gap-4">
        <div>
          <h2 className="font-semibold">Ingresso</h2>
          <p className="text-sm text-fg-muted">
            Le istruzioni d&apos;ingresso e il codice Nuki compaiono all&apos;ospite solo dopo che hai riconosciuto tutti gli ospiti, di persona o in videochiamata.
          </p>
        </div>
        <Field label="Istruzioni d'ingresso (italiano)" hint="Come trovare il portone, dove si trova il tastierino, piano e interno.">
          <Textarea name="access_it" defaultValue={p?.access_instructions?.it ?? ""} />
        </Field>
        <Field label="Entry instructions (English)">
          <Textarea name="access_en" defaultValue={p?.access_instructions?.en ?? ""} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="ID serratura Nuki" hint="Da web.nuki.io, scheda della serratura. Lascia vuoto se non usi Nuki.">
            <Input name="nuki_smartlock_id" defaultValue={p?.nuki_smartlock_id ?? ""} inputMode="numeric" />
          </Field>
          <Field label="Token API Nuki Web" hint={hasNukiToken ? "Già impostato: scrivi qui solo per sostituirlo." : "web.nuki.io → Menu → API → Genera token."}>
            <Input name="nuki_api_token" type="password" autoComplete="off" placeholder={hasNukiToken ? "••••••••" : ""} />
          </Field>
        </div>
      </Card>

      <Card className="grid gap-4">
        <h2 className="font-semibold">Contratto</h2>
        <Field
          label="Testo del contratto"
          hint="Segnaposto disponibili: {{host_nome}}, {{ospite_nome}}, {{ospite_cognome}}, {{ospite_codice_fiscale}}, {{ospite_indirizzo}}, {{check_in}}, {{check_out}}, {{notti}}, {{importo}}, {{cin}}… Lascia vuoto per usare il modello di base."
        >
          <Textarea name="contract_template" defaultValue={p?.contract_template ?? ""} placeholder={DEFAULT_CONTRACT_TEMPLATE} className="min-h-64 font-mono text-xs" />
        </Field>
      </Card>

      <div>
        <Button type="submit">Salva</Button>
      </div>
    </form>
  );
}
