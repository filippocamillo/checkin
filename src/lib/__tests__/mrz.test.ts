import { describe, expect, it } from "vitest";
import { mrzDate, parseMrz } from "@/lib/mrz";

describe("MRZ", () => {
  it("legge un passaporto TD3", () => {
    const r = parseMrz(["P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<", "L898902C36UTO7408122F1204159ZE184226B<<<<<10"]);
    expect(r?.fields).toMatchObject({ first_name: "ANNA MARIA", last_name: "ERIKSSON", sex: "F", birth_date: "1974-08-12", document_number: "L898902C3", document_type: "passport" });
  });

  it("sceglie il secolo giusto per le date", () => {
    const now = new Date("2026-10-05");
    expect(mrzDate("990101", "birth", now)).toBe("1999-01-01");
    expect(mrzDate("150101", "birth", now)).toBe("2015-01-01");
    expect(mrzDate("310101", "expiry", now)).toBe("2031-01-01");
    expect(mrzDate("abc", "birth", now)).toBeNull();
  });

  it("ignora testo che non è MRZ", () => {
    expect(parseMrz(["ciao"])).toBeNull();
  });
});
