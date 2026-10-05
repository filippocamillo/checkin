import { Card } from "@/components/ui";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const sent = params.sent === "1";
  const next = typeof params.next === "string" && params.next.startsWith("/host") ? params.next : "/host";

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Accesso host</h1>
      <Card>
        {sent ? (
          <p className="text-sm">Ti abbiamo inviato un link via email. Aprilo da questo dispositivo per entrare.</p>
        ) : (
          <LoginForm next={next} />
        )}
      </Card>
    </main>
  );
}
