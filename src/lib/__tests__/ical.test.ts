import { describe, expect, it } from "vitest";
import { parseIcal } from "@/lib/ical";

const AIRBNB = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART;VALUE=DATE:20261010
DTEND;VALUE=DATE:20261013
UID:abc-1@airbnb.com
SUMMARY:Reserved
DESCRIPTION:Reservation URL: https://www.airbnb.com/hosting/reservations/details/HMABC12345\\nPhone Number (Last 4 Digits): 4321
END:VEVENT
BEGIN:VEVENT
DTSTART;VALUE=DATE:20261020
DTEND;VALUE=DATE:20261022
UID:abc-2@airbnb.com
SUMMARY:Airbnb (Not available)
END:VEVENT
END:VCALENDAR`;

describe("iCal", () => {
  it("importa le prenotazioni Airbnb e salta i blocchi", () => {
    const events = parseIcal(AIRBNB, "airbnb");
    expect(events).toEqual([
      { uid: "abc-1@airbnb.com", check_in: "2026-10-10", check_out: "2026-10-13", external_ref: "HMABC12345", notes: "Telefono (ultime 4 cifre): 4321" },
    ]);
  });

  it("importa tutto da Booking", () => {
    expect(parseIcal(AIRBNB.replace(/Airbnb \(Not available\)/, "CLOSED - Not available"), "booking")).toHaveLength(2);
  });
});
