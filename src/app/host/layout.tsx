import { signOut } from "@/app/login/actions";
import { HostNav } from "./nav";

export default function HostLayout({ children }: LayoutProps<"/host">) {
  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col justify-between border-r border-line bg-surface p-4 md:flex">
        <div>
          <p className="mb-6 px-3 text-lg font-semibold tracking-tight">Check-in</p>
          <HostNav variant="side" />
        </div>
        <form action={signOut}>
          <button className="w-full rounded-xl px-3 py-2.5 text-left text-sm text-fg-muted hover:bg-muted">Esci</button>
        </form>
      </aside>
      <main className="w-full min-w-0 flex-1 px-4 pt-6 pb-24 md:px-8 md:pb-10 lg:px-10">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
      <HostNav variant="bottom" />
    </div>
  );
}
