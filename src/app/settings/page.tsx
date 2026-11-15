import { Database, FolderOpen, Notebook, SlidersHorizontal, Broadcast, BellRinging } from "@phosphor-icons/react/dist/ssr";
import { loadCore } from "@/lib/load";
import { Badge, PageHeader, Section, type Tone } from "@/components/ui";
import { Accordion } from "@/components/accordion";

// Honest settings: this app owns no discovery configuration. It shows what is connected and where each knob lives.
const Row = ({ Icon, k, v, tone }: { Icon: typeof Database; k: string; v: string; tone?: Tone }) => (
  <li className="flex items-center gap-3 p-3.5"><span className={`grid size-10 place-items-center rounded-xl ${tone === "ok" ? "bg-[var(--ok-tint)] text-ok-700" : tone === "warn" ? "bg-[var(--warn-tint)] text-warn-700" : tone === "error" ? "bg-[var(--err-tint)] text-error-700" : "bg-surface text-ink"}`}><Icon size={20} aria-hidden /></span><span className="flex-1 text-[16px] font-medium">{k}</span><Badge tone={tone}>{v}</Badge></li>
);
const Note = ({ Icon, k, v }: { Icon: typeof Database; k: string; v: string }) => (
  <li><Accordion buttonClassName="flex min-h-14 w-full items-center gap-3 p-3.5 text-left" summary={<><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface text-ink"><Icon size={20} aria-hidden /></span><span className="text-[16px] font-medium">{k}</span></>}>
    <p className="t-meta px-3.5 pb-3.5 pl-[68px] text-[14px]">{v}</p>
  </Accordion></li>
);
const List = ({ children }: { children: React.ReactNode }) => <ul className="divide-y divide-line/70 rounded-card-lg bg-paper shadow-[var(--shadow-e2)]">{children}</ul>;

export default async function Settings() {
  const d = await loadCore();
  return (
    <>
      <PageHeader title="Settings" back="/more" lead="What is connected, and where things are set." />
      <Section title="Connections">
        <List>
          <Row Icon={Database} k="Ideas database" v={!d.connected ? "Not set" : d.source === "supabase" ? "Connected" : "Unreachable"} tone={!d.connected ? "warn" : d.source === "supabase" ? "ok" : "error"} />
          <Row Icon={Notebook} k="Ideas are read from" v={d.source === "supabase" ? "Supabase" : d.source === "local" ? "Local copy" : "Nothing"} tone={d.source === "supabase" ? "ok" : d.source === "local" ? "warn" : "error"} />
          <Row Icon={FolderOpen} k="Pipeline service" v={d.canRun ? "Linked" : "Not linked"} tone={d.canRun ? "ok" : "neutral"} />
          <Row Icon={Broadcast} k="Run logs" v={d.runsAvailable ? `${d.runs.length} found` : "Unavailable"} tone={d.runsAvailable ? "ok" : "neutral"} />
        </List>
      </Section>
      <Section title="Where things are configured">
        <List>
          <Note Icon={SlidersHorizontal} k="Ranking and scoring" v="Edit agent/discovery/rank.py in the discovery folder." />
          <Note Icon={SlidersHorizontal} k="Ideas per run, repeat window" v="Set in agent/discovery/service.py and run.py." />
          <Note Icon={Broadcast} k="Sources and queries" v="Edit agent/discovery/sources.py. Live status is on the Sources page." />
          <Note Icon={BellRinging} k="Telegram notifications" v="Set by TELEGRAM_BOT and TELEGRAM_CHAT_ID in the discovery folder's .env. This app sends none." />
        </List>
      </Section>
    </>
  );
}
