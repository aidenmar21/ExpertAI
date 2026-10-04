import { notFound } from "next/navigation";
import { roleById } from "@understudy/brain/server";
import ModeNav from "@/components/ModeNav";
import CoverageInterview from "@/components/coverage/CoverageInterview";
import { listJobIds, loadJob } from "@/lib/job";

/** "retail cashier, returns desk" -> "retail cashiers"; no role -> "people in this job". */
function rolePlural(name: string | undefined): string {
  const head = name?.split(",")[0]?.trim().toLowerCase();
  if (!head) return "people in this job";
  if (/[^aeiou]y$/.test(head)) return `${head.slice(0, -1)}ies`;
  if (/(s|x|ch|sh)$/.test(head)) return `${head}es`;
  return `${head}s`;
}

export default async function CoveragePage({ searchParams }: PageProps<"/coverage">) {
  const { job = "returns-desk" } = await searchParams;
  const id = Array.isArray(job) ? job[0] : job;
  if (!listJobIds().includes(id)) notFound();
  const profile = loadJob(id).job;
  return (
    <div className="flex min-h-screen flex-col">
      <ModeNav jobId={id} mode="workmap" />
      <CoverageInterview
        jobId={id}
        jobName={profile.name}
        rolePlural={rolePlural(roleById(profile.role_id)?.name)}
        escalateTo={profile.escalate_to}
      />
    </div>
  );
}
