import Link from "next/link";
import { Empty, btn } from "@/components/ui";

export default function NotFound() {
  return <Empty title="Not found" body="That idea or page is gone. It may have rolled out of the saved list." action={<Link href="/library" className={`${btn.base} ${btn.quiet}`}>Back to library</Link>} />;
}
