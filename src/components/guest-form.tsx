"use client";

import { useRef, useState, useTransition } from "react";
import { Button, Card, Field, Input, Select } from "@/components/ui";
import { COUNTRIES } from "@/lib/countries";
import type { Dictionary } from "@/lib/i18n";
import type { ExtractedGuest, ExtractionInfo, Guest } from "@/lib/types";

export type ExtractResult =
  | { ok: true; data: ExtractedGuest; info: ExtractionInfo }
  | { ok: false; message: string };

export type SaveResult = { ok: true } | { ok: false; message: string; missing?: (keyof Dictionary)[] };

interface Props {
  t: Dictionary;
  initial?: Partial<Guest> | null;
  isLead: boolean;
  extract: (formData: FormData) => Promise<ExtractResult>;
  save: (formData: FormData) => Promise<SaveResult>;
  onClose: () => void;
}

/** Riduce la foto lato client: meno dati in rete e lettura più veloce. */
async function downscale(file: File, maxSide = 2000): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob"))), "image/jpeg", 0.85),
  );
}

type Step = "capture" | "reading" | "review";

export function GuestForm({ t, initial, isLead, extract, save, onClose }: Props) {
  const [step, setStep] = useState<Step>(initial?.id ? "review" : "capture");
  const [values, setValues] = useState<Partial<Guest>>(initial ?? {});
  const [info, setInfo] = useState<ExtractionInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<(keyof Dictionary)[]>([]);
  const [saving, startSaving] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setError(null);
    setStep("reading");
    try {
      const fd = new FormData();
      fd.set("photo", await downscale(file), "document.jpg");
      const result = await extract(fd);
      if (!result.ok) {
        setError(result.message);
        setStep("capture");
        return;
      }
      // I dati già inseriti a mano restano se il documento non li riporta.
      setValues((v) => ({ ...v, ...Object.fromEntries(Object.entries(result.data).filter(([, x]) => x)) }));
      setInfo(result.info);
      setStep("review");
    } catch {
      setError(t.genericError);
      setStep("capture");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function onSubmit(formData: FormData) {
    if (info) formData.set("extraction", JSON.stringify(info));
    startSaving(async () => {
      const result = await save(formData);
      if (result.ok) onClose();
      else {
        setError(result.message);
        setMissing(result.missing ?? []);
      }
    });
  }

  const v = (k: keyof Guest) => (values[k] as string | null | undefined) ?? "";
  const set = (k: keyof Guest) => (e: { target: { value: string } }) => setValues((s) => ({ ...s, [k]: e.target.value }));

  const countrySelect = (name: keyof Guest, label: string, required = false) => (
    <Field label={label}>
      <Select name={name} value={v(name)} onChange={set(name)} required={required}>
        <option value="">{t.select}</option>
        {COUNTRIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
      </Select>
    </Field>
  );

  if (step !== "review") {
    return (
      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{t.scanDocument}</h2>
        <p className="text-sm text-fg-muted">{t.scanHint}</p>
        {error && <p className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{error}</p>}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => onPhoto(e.target.files?.[0])}
        />
        <Button type="button" disabled={step === "reading"} onClick={() => fileRef.current?.click()} className="min-h-14 text-base">
          {step === "reading" ? t.reading : t.scanDocument}
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" onClick={() => setStep("review")} disabled={step === "reading"}>
            {t.enterManually}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose} disabled={step === "reading"}>
            {t.cancel}
          </Button>
        </div>
      </Card>
    );
  }

  const isItalian = values.citizenship === "ITA";
  const bornInItaly = values.birth_country === "ITA";

  return (
    <Card>
      <form action={onSubmit} className="flex flex-col gap-4">
        {info && (
          <div className="rounded-xl bg-accent/10 p-3 text-sm">
            <p>{t.checkData}</p>
            {info.warnings.length > 0 && (
              <ul className="mt-2 list-disc pl-5 text-warn">
                {info.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.firstName}>
            <Input name="first_name" value={v("first_name")} onChange={set("first_name")} required autoComplete="given-name" />
          </Field>
          <Field label={t.lastName}>
            <Input name="last_name" value={v("last_name")} onChange={set("last_name")} required autoComplete="family-name" />
          </Field>
          <Field label={t.sex}>
            <Select name="sex" value={v("sex")} onChange={set("sex")} required>
              <option value="">{t.select}</option>
              <option value="M">{t.male}</option>
              <option value="F">{t.female}</option>
            </Select>
          </Field>
          <Field label={t.birthDate}>
            <Input name="birth_date" type="date" value={v("birth_date")} onChange={set("birth_date")} required />
          </Field>
          {countrySelect("birth_country", t.birthCountry, true)}
          <Field label={t.birthPlace}>
            <Input name="birth_place" value={v("birth_place")} onChange={set("birth_place")} required={bornInItaly} />
          </Field>
          {bornInItaly && (
            <Field label={t.birthProvince}>
              <Input name="birth_province" value={v("birth_province")} onChange={set("birth_province")} maxLength={2} required />
            </Field>
          )}
          {countrySelect("citizenship", t.citizenship, true)}
          {(isLead || isItalian) && (
            <Field label={t.taxCode} hint={t.taxCodeHint}>
              <Input name="tax_code" value={v("tax_code")} onChange={set("tax_code")} required={isLead && isItalian} autoCapitalize="characters" />
            </Field>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.documentType}>
            <Select name="document_type" value={v("document_type")} onChange={set("document_type")} required={isLead}>
              <option value="">{t.select}</option>
              <option value="passport">{t.passport}</option>
              <option value="id_card">{t.idCard}</option>
              <option value="driving_licence">{t.drivingLicence}</option>
              <option value="other">{t.other}</option>
            </Select>
          </Field>
          <Field label={t.documentNumber}>
            <Input name="document_number" value={v("document_number")} onChange={set("document_number")} required={isLead} autoCapitalize="characters" />
          </Field>
          {countrySelect("document_issue_country", t.documentIssueCountry, isLead)}
          <Field label={t.documentIssuePlace}>
            <Input name="document_issue_place" value={v("document_issue_place")} onChange={set("document_issue_place")} />
          </Field>
          <Field label={t.documentExpiry}>
            <Input name="document_expiry" type="date" value={v("document_expiry")} onChange={set("document_expiry")} />
          </Field>
        </div>

        {isLead && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.residenceAddress}>
              <Input name="residence_address" value={v("residence_address")} onChange={set("residence_address")} required autoComplete="street-address" />
            </Field>
            <Field label={t.residenceCity}>
              <Input name="residence_city" value={v("residence_city")} onChange={set("residence_city")} required autoComplete="address-level2" />
            </Field>
            {countrySelect("residence_country", t.residenceCountry, true)}
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-danger/10 p-3 text-sm text-danger">
            <p>{error}</p>
            {missing.length > 0 && (
              <p className="mt-1">
                {t.missingForLead} {missing.map((m) => String(t[m])).join(", ")}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? t.saving : t.save}
          </Button>
          <Button type="button" variant="secondary" onClick={() => setStep("capture")} disabled={saving}>
            {t.retake}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            {t.cancel}
          </Button>
        </div>
      </form>
    </Card>
  );
}
