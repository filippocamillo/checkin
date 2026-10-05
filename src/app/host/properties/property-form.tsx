import { Button, Card, Field, Input, Textarea } from "@/components/ui";
import { DEFAULT_CONTRACT_TEMPLATE } from "@/lib/contract";
import type { Property } from "@/lib/types";

export function PropertyForm({ property, action }: { property?: Property; action: (fd: FormData) => Promise<void> }) {
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
        <Field label="Italiano" hint="Wi-Fi, parcheggio, regole della casa. Il codice d'accesso arriverà con l'integrazione Nuki.">
          <Textarea name="instructions_it" defaultValue={p?.guest_instructions?.it ?? ""} />
        </Field>
        <Field label="English">
          <Textarea name="instructions_en" defaultValue={p?.guest_instructions?.en ?? ""} />
        </Field>
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
