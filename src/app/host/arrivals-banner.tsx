"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { buttonClass } from "@/components/ui";
import { pendingArrivals } from "./bookings/[id]/identification-actions";

type Arrival = Awaited<ReturnType<typeof pendingArrivals>>[number];

function chime() {
  try {
    const ctx = new AudioContext();
    [880, 1175].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.25);
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + i * 0.25 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.25 + 0.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.25);
      osc.stop(ctx.currentTime + i * 0.25 + 0.45);
    });
  } catch {
    // Audio non disponibile finché l'host non ha interagito con la pagina.
  }
}

/** Avviso nell'area host quando un ospite è alla porta e aspetta la videochiamata. */
export function ArrivalsBanner() {
  const pathname = usePathname();
  const [arrivals, setArrivals] = useState<Arrival[]>([]);
  const [canNotify, setCanNotify] = useState(false);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    let stopped = false;
    const tick = async () => {
      const list = await pendingArrivals().catch(() => null);
      if (stopped || !list) return;
      setCanNotify(typeof Notification !== "undefined" && Notification.permission === "default");
      const fresh = list.filter((a) => !seen.current.has(`${a.id}:${a.at}`));
      fresh.forEach((a) => seen.current.add(`${a.id}:${a.at}`));
      if (fresh.length) {
        chime();
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          for (const a of fresh) new Notification("Ospite arrivato", { body: `${a.name} · ${a.property}: apri la videochiamata`, tag: a.id });
        }
      }
      setArrivals(list);
    };
    tick();
    const timer = setInterval(tick, 8000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, []);

  const visible = arrivals.filter((a) => pathname !== `/host/bookings/${a.id}/call`);
  if (!visible.length && !canNotify) return null;

  return (
    <div className="mb-4 flex flex-col gap-2">
      {visible.map((a) => (
        <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent/40 bg-accent/10 p-3">
          <p className="text-sm">
            <strong>{a.name}</strong> è arrivato a {a.property} e aspetta la videochiamata.
          </p>
          <Link href={`/host/bookings/${a.id}/call`} className={buttonClass()}>
            Rispondi
          </Link>
        </div>
      ))}
      {canNotify && (
        <button
          className="self-start text-xs text-fg-muted underline"
          onClick={() => Notification.requestPermission().then(() => setCanNotify(false))}
        >
          Attiva le notifiche per gli arrivi degli ospiti
        </button>
      )}
    </div>
  );
}
