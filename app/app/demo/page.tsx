import Link from "next/link";
import DemoReset from "@/components/DemoReset";
import { PageChrome } from "@/components/JobsDashboard";
import { listJobSummaries } from "@/lib/db/jobs";
import { page } from "@/components/ui/styles";

export const dynamic = "force-dynamic";
export const metadata = { title: "Demo operator · ExpertAI" };

/** Operator page for the live demo. Not linked from the main nav. */
export default async function DemoPage() {
  const jobs = (await listJobSummaries()).map(({ id, name }) => ({ id, name }));
  return (
    <div className="flex min-h-screen flex-col">
      <PageChrome>
        <Link
          href="/jobs"
          className="inline-flex min-h-11 items-center rounded-sm px-2 text-meta text-ink-secondary no-underline hover:text-link hover:underline pointer-fine:min-h-9"
        >
          All jobs
        </Link>
      </PageChrome>
      <main className={`${page} py-10`}>
        <DemoReset jobs={jobs} />
      </main>
    </div>
  );
}
