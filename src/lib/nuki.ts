import "server-only";

const API = "https://api.nuki.io";

/**
 * Codice per il Keypad: 6 cifre da 1 a 9 (lo zero non c'è sul tastierino),
 * non può iniziare con "12".
 */
export function generateKeypadCode(random: () => number = Math.random): string {
  for (;;) {
    const code = Array.from({ length: 6 }, () => 1 + Math.floor(random() * 9)).join("");
    if (!code.startsWith("12")) return code;
  }
}

/**
 * Converte data e ora di Roma in un istante UTC (gestisce l'ora legale).
 */
export function romeToUtc(dateIso: string, time: string): Date {
  const [h, m] = time.split(":").map(Number);
  const guess = new Date(`${dateIso}T${String(h).padStart(2, "0")}:${String(m ?? 0).padStart(2, "0")}:00Z`);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(guess);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asRome = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return new Date(guess.getTime() - (asRome - guess.getTime()));
}

async function nuki(token: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...init.headers },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new NukiError(res.status, body.slice(0, 300));
  }
  return res;
}

export class NukiError extends Error {
  constructor(
    public status: number,
    body: string,
  ) {
    super(`Nuki Web API ${status}${body ? `: ${body}` : ""}`);
  }
}

interface NukiAuth {
  id: string;
  name: string;
  type: number;
  code?: number;
}

/**
 * Crea un codice Keypad valido da `from` a `until` e restituisce codice e id
 * dell'autorizzazione. Se il codice è già usato sulla serratura ne prova un altro.
 */
export async function createKeypadCode(opts: { token: string; smartlockId: string; name: string; from: Date; until: Date }) {
  const { token, smartlockId } = opts;
  const name = opts.name.slice(0, 20);
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateKeypadCode();
    try {
      await nuki(token, `/smartlock/${encodeURIComponent(smartlockId)}/auth`, {
        method: "PUT",
        body: JSON.stringify({
          name,
          type: 13,
          code: Number(code),
          allowedFromDate: opts.from.toISOString(),
          allowedUntilDate: opts.until.toISOString(),
          allowedWeekDays: 127,
          allowedFromTime: 0,
          allowedUntilTime: 0,
        }),
      });
    } catch (err) {
      lastError = err;
      // 409/422: codice già presente o non accettato, si riprova con un altro.
      if (err instanceof NukiError && (err.status === 409 || err.status === 422)) continue;
      throw err;
    }
    // La creazione non restituisce l'id: lo si cerca per nome (può comparire con qualche secondo di ritardo).
    let authId: string | null = null;
    for (let i = 0; i < 3 && !authId; i++) {
      const res = await nuki(token, `/smartlock/${encodeURIComponent(smartlockId)}/auth`);
      const auths = (await res.json()) as NukiAuth[];
      authId = auths.find((a) => a.type === 13 && a.name === name)?.id ?? null;
      if (!authId) await new Promise((r) => setTimeout(r, 1500));
    }
    return { code, authId };
  }
  throw lastError;
}
