import { describe, expect, it } from "vitest";
import { DEFAULT_CONTRACT_TEMPLATE, fillTemplate, renderContractPdf } from "@/lib/contract";
import type { Booking, Property } from "@/lib/types";

const property = { name: "La Casa Imperfetta", host_name: "Filippo", host_tax_code: "X", address: "Via 1", city: "Roma", cin: "IT058091C2", check_in_time: "15:00:00", check_out_time: "10:00:00", contract_template: null } as Property;
const booking = { check_in: "2026-10-10", check_out: "2026-10-13", adults: 2, children: 0, infants: 1, total_amount: 300, contract_accepted_at: null, contract_accepted_name: null } as unknown as Booking;
const lead = { first_name: "Anna", last_name: "Müller", tax_code: null, residence_address: "Hauptstr. 1", residence_city: "Berlin", residence_country: "DEU" };

describe("contratto", () => {
  it("compila i segnaposto", () => {
    const text = fillTemplate(DEFAULT_CONTRACT_TEMPLATE, { property, booking, lead });
    expect(text).toContain("Anna Müller");
    expect(text).toContain("dal 10/10/2026".replace("dal ", ""));
    expect(text).toContain("3 notti");
    expect(text).toContain("€ 300,00");
    expect(text).not.toMatch(/\{\{/);
  });

  it("genera un PDF", async () => {
    const pdf = await renderContractPdf({ property, booking, lead });
    expect(Buffer.from(pdf.slice(0, 4)).toString()).toBe("%PDF");
  });
});
