import { loadCore } from "@/lib/load";
import { ErrorNote, PageHeader } from "@/components/ui";
import { Library } from "@/components/library";

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ focus?: string }> }) {
  const [d, sp] = await Promise.all([loadCore(), searchParams]);
  return (
    <>
      <PageHeader title="Idea Library" lead="Everything discovery has surfaced, best first." />
      {d.error && <div className="mb-4"><ErrorNote what="Could not load ideas." detail={d.error} /></div>}
      <Library ideas={d.ideas} states={d.states} focus={sp.focus === "1"} />
    </>
  );
}
