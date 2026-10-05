import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { countryName } from "@/lib/countries";
import type { Booking, Guest, Property } from "@/lib/types";

/**
 * Modello di base per una locazione a uso turistico (art. 1, comma 2, lettera c,
 * L. 431/1998). È un punto di partenza da far verificare: ogni appartamento può
 * avere il proprio testo in `properties.contract_template`.
 */
export const DEFAULT_CONTRACT_TEMPLATE = `CONTRATTO DI LOCAZIONE AD USO TURISTICO

Tra {{host_nome}}, codice fiscale {{host_codice_fiscale}} (locatore) e {{ospite_nome}} {{ospite_cognome}}, codice fiscale {{ospite_codice_fiscale}}, residente in {{ospite_indirizzo}} (conduttore), si conviene quanto segue.

1. Oggetto. Il locatore concede in locazione al conduttore l'immobile "{{appartamento}}" sito in {{appartamento_indirizzo}}, CIN {{cin}}, arredato e corredato, per esclusiva finalità turistica.

2. Durata. Dalle ore {{orario_check_in}} del {{check_in}} alle ore {{orario_check_out}} del {{check_out}}, per complessive {{notti}} notti, senza necessità di disdetta.

3. Ospiti. L'immobile sarà occupato da {{numero_ospiti}} persone, i cui dati sono comunicati all'Autorità di Pubblica Sicurezza ai sensi dell'art. 109 TULPS.

4. Corrispettivo. Il canone complessivo è di {{importo}}, oltre alla tassa di soggiorno se dovuta.

5. Obblighi del conduttore. Il conduttore si impegna a custodire l'immobile con la diligenza del buon padre di famiglia, a rispettare il regolamento della casa e a riconsegnarlo nello stato in cui lo ha ricevuto.

6. Trattamento dei dati. I dati personali sono trattati per l'esecuzione del contratto e per gli adempimenti di legge, secondo l'informativa privacy consegnata al conduttore.

Accettato elettronicamente da {{firma_nome}} il {{firma_data}}.`;

export interface ContractData {
  property: Property;
  booking: Booking;
  lead: Pick<Guest, "first_name" | "last_name" | "tax_code" | "residence_address" | "residence_city" | "residence_country"> | null;
}

function itDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function fillTemplate(template: string, { property, booking, lead }: ContractData): string {
  const nights = Math.round((Date.parse(booking.check_out) - Date.parse(booking.check_in)) / 86_400_000);
  const address = [lead?.residence_address, lead?.residence_city, countryName(lead?.residence_country)].filter(Boolean).join(", ");
  const values: Record<string, string> = {
    host_nome: property.host_name ?? "",
    host_codice_fiscale: property.host_tax_code ?? "",
    ospite_nome: lead?.first_name ?? "",
    ospite_cognome: lead?.last_name ?? "",
    ospite_codice_fiscale: lead?.tax_code || "non disponibile",
    ospite_indirizzo: address,
    appartamento: property.name,
    appartamento_indirizzo: [property.address, property.city].filter(Boolean).join(", "),
    cin: property.cin ?? "",
    check_in: itDate(booking.check_in),
    check_out: itDate(booking.check_out),
    orario_check_in: property.check_in_time?.slice(0, 5) ?? "",
    orario_check_out: property.check_out_time?.slice(0, 5) ?? "",
    notti: String(nights),
    numero_ospiti: String(booking.adults + booking.children + booking.infants),
    importo: booking.total_amount != null ? `€ ${booking.total_amount.toFixed(2).replace(".", ",")}` : "come da prenotazione",
    firma_nome: booking.contract_accepted_name ?? "",
    firma_data: booking.contract_accepted_at ? new Date(booking.contract_accepted_at).toLocaleString("it-IT", { timeZone: "Europe/Rome" }) : "",
  };
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => values[key] ?? "");
}

// I font standard PDF coprono solo il set WinAnsi: gli altri caratteri vengono traslitterati.
function winAnsiSafe(text: string, font: PDFFont): string {
  return [...text]
    .map((ch) => {
      try {
        font.encodeText(ch);
        return ch;
      } catch {
        return ch.normalize("NFD").replace(/[̀-ͯ]/g, "") || "?";
      }
    })
    .join("");
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(" ")) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) > width && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    lines.push(line);
  }
  return lines;
}

export async function renderContractPdf(data: ContractData): Promise<Uint8Array> {
  const text = fillTemplate(data.property.contract_template || DEFAULT_CONTRACT_TEMPLATE, data);
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const size = 10.5;
  const margin = 56;
  const lineHeight = size * 1.45;

  let page = pdf.addPage([595.28, 841.89]);
  const width = page.getWidth() - margin * 2;
  let y = page.getHeight() - margin;

  const [title, ...rest] = winAnsiSafe(text, font).split("\n");
  page.drawText(title, { x: margin, y, size: 13, font: bold, color: rgb(0.1, 0.1, 0.1) });
  y -= lineHeight * 2;

  for (const line of wrap(rest.join("\n").trim(), font, size, width)) {
    if (y < margin) {
      page = pdf.addPage([595.28, 841.89]);
      y = page.getHeight() - margin;
    }
    page.drawText(line, { x: margin, y, size, font, color: rgb(0.1, 0.1, 0.1) });
    y -= lineHeight;
  }

  return pdf.save();
}
