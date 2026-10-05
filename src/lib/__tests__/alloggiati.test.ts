import { describe, expect, it } from "vitest";
import { buildAlloggiatiRecords, guestRole, RECORD_LENGTH, stayDays, type CodeLookup } from "@/lib/alloggiati";
import type { Guest } from "@/lib/types";

const codes: CodeLookup = {
  comune: (name) => (name.toUpperCase() === "ROMA" ? "058091" : null),
  stato: (iso) => ({ ITA: "100000100", DEU: "100000216" })[iso] ?? null,
};

function guest(over: Partial<Guest>): Guest {
  return {
    id: "g", booking_id: "b", position: 0, first_name: "Mario", last_name: "Rossi", sex: "M",
    birth_date: "1980-05-17", birth_place: "Roma", birth_province: "RM", birth_country: "ITA", citizenship: "ITA",
    tax_code: "RSSMRA80E17H501X", residence_address: "Via Roma 1", residence_city: "Roma", residence_country: "ITA",
    document_type: "id_card", document_number: "CA12345AB", document_issue_place: "Roma", document_issue_country: "ITA",
    document_expiry: "2030-01-01", extraction: null, ...over,
  };
}

const booking = { check_in: "2026-10-10", check_out: "2026-10-13", party: "family" as const };

describe("tracciato Alloggiati", () => {
  it("produce righe da 168 caratteri con i campi nelle posizioni giuste", () => {
    const { lines, issues } = buildAlloggiatiRecords(booking, [guest({})], codes);
    expect(issues).toEqual([]);
    const [line] = lines;
    expect(line).toHaveLength(RECORD_LENGTH);
    expect(line.slice(0, 2)).toBe("16");
    expect(line.slice(2, 12)).toBe("10/10/2026");
    expect(line.slice(12, 14)).toBe("03");
    expect(line.slice(14, 64).trimEnd()).toBe("ROSSI");
    expect(line.slice(64, 94).trimEnd()).toBe("MARIO");
    expect(line.slice(94, 95)).toBe("1");
    expect(line.slice(95, 105)).toBe("17/05/1980");
    expect(line.slice(105, 114).trimEnd()).toBe("058091");
    expect(line.slice(114, 116)).toBe("RM");
    expect(line.slice(116, 125)).toBe("100000100");
    expect(line.slice(125, 134)).toBe("100000100");
    expect(line.slice(134, 139)).toBe("IDENT");
    expect(line.slice(139, 159).trimEnd()).toBe("CA12345AB");
    expect(line.slice(159, 168).trimEnd()).toBe("058091");
  });

  it("lascia vuoti comune e provincia per i nati all'estero e i dati documento per i familiari", () => {
    const foreign = guest({ id: "a", birth_country: "DEU", citizenship: "DEU", birth_place: "Berlin", birth_province: null, document_type: "passport", document_issue_country: "DEU", document_issue_place: null });
    const child = guest({ id: "b", position: 1, first_name: "Anna", birth_country: "DEU", citizenship: "DEU", birth_place: "Berlin", birth_province: null, document_number: null });
    const { lines, issues } = buildAlloggiatiRecords(booking, [foreign, child], codes);
    expect(issues).toEqual([]);
    expect(lines[0].slice(0, 2)).toBe("17");
    expect(lines[0].slice(105, 116).trim()).toBe("");
    expect(lines[0].slice(134, 139)).toBe("PASOR");
    expect(lines[0].slice(159, 168)).toBe("100000216");
    expect(lines[1].slice(0, 2)).toBe("19");
    expect(lines[1].slice(134, 168).trim()).toBe("");
  });

  it("toglie gli accenti e aggiunge l'ID appartamento se presente", () => {
    const { lines } = buildAlloggiatiRecords(booking, [guest({ last_name: "Niccolò D'Amà" })], codes, "000123");
    expect(lines[0]).toHaveLength(RECORD_LENGTH + 6);
    expect(lines[0].slice(14, 64).trimEnd()).toBe("NICCOLO D'AMA");
    expect(lines[0].slice(168)).toBe("000123");
  });

  it("segnala i codici mancanti", () => {
    const { issues } = buildAlloggiatiRecords(booking, [guest({ citizenship: "FRA", birth_place: "Paperopoli" })], codes);
    expect(issues.map((i) => i.field).sort()).toEqual(["birth_place", "citizenship"]);
  });

  it("calcola ruoli e giorni di permanenza", () => {
    expect(guestRole("single", 0, 1)).toBe(16);
    expect(guestRole("group", 0, 3)).toBe(18);
    expect(guestRole("group", 2, 3)).toBe(20);
    expect(stayDays("2026-10-10", "2026-12-31")).toBe(30);
  });
});
