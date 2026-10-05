import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { createProperty } from "./actions";
import { PropertyForm } from "./property-form";

export default async function PropertiesPage({ searchParams }: PageProps<"/host/properties">) {
  const { new: isNew } = await searchParams;
  const supabase = await createClient();
  const { data: properties } = await supabase.from("properties").select("id, name, city, cin").order("name");

  if (isNew === "1" || !properties?.length) {
    return (
      <>
        <PageHeader title="Nuovo appartamento" />
        <PropertyForm action={createProperty} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Appartamenti"
        actions={
          <Link href="/host/properties?new=1" className="inline-flex min-h-11 items-center rounded-xl bg-accent px-4 text-sm font-medium text-accent-fg">
            Aggiungi
          </Link>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {properties.map((p) => (
          <Link key={p.id} href={`/host/properties/${p.id}`}>
            <Card className="transition hover:border-accent">
              <p className="font-medium">{p.name}</p>
              <p className="text-sm text-fg-muted">{[p.city, p.cin && `CIN ${p.cin}`].filter(Boolean).join(" · ")}</p>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
