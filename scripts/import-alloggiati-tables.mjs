#!/usr/bin/env node
// Importa le tabelle ufficiali di Alloggiati Web (comuni, stati, documenti) nella
// tabella `alloggiati_codes`. I file si scaricano dal portale, sezione Supporto > Tabelle.
//
// Uso:
//   node scripts/import-alloggiati-tables.mjs comune  Comuni.csv
//   node scripts/import-alloggiati-tables.mjs stato   Stati.csv
//   node scripts/import-alloggiati-tables.mjs documento Documenti.csv
//
// Il CSV deve avere le colonne Codice, Descrizione e, per i comuni, Provincia e
// DataFineVal. Le intestazioni vengono riconosciute ignorando maiuscole e spazi.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const [kind, file] = process.argv.slice(2);
if (!["comune", "stato", "documento"].includes(kind) || !file) {
  console.error("Uso: node scripts/import-alloggiati-tables.mjs <comune|stato|documento> <file.csv>");
  process.exit(1);
}

const normalize = (s) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/['’`]/g, " ").replace(/\s+/g, " ").trim().toUpperCase();

const text = readFileSync(file, "latin1");
const [headerLine, ...lines] = text.split(/\r?\n/).filter((l) => l.trim());
const sep = headerLine.includes(";") ? ";" : ",";
const header = headerLine.split(sep).map((h) => h.replace(/"/g, "").replace(/\s/g, "").toLowerCase());
const col = (...names) => header.findIndex((h) => names.includes(h));
const iCode = col("codice", "code");
const iName = col("descrizione", "nome", "name");
const iProv = col("provincia", "prov");
const iEnd = col("datafineval", "datafinevalidita", "validofino");
if (iCode < 0 || iName < 0) {
  console.error("Colonne Codice/Descrizione non trovate in:", header.join(", "));
  process.exit(1);
}

const toDate = (v) => {
  const m = v?.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};

const rows = lines.map((l) => {
  const c = l.split(sep).map((v) => v.replace(/"/g, "").trim());
  return {
    kind,
    code: c[iCode],
    name: normalize(c[iName]),
    province: iProv >= 0 ? c[iProv]?.slice(0, 2) || null : null,
    valid_to: iEnd >= 0 ? toDate(c[iEnd]) : null,
  };
}).filter((r) => r.code && r.name);

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
for (let i = 0; i < rows.length; i += 1000) {
  const { error } = await supabase.from("alloggiati_codes").upsert(rows.slice(i, i + 1000));
  if (error) throw error;
}
console.log(`Importati ${rows.length} codici di tipo ${kind}`);
