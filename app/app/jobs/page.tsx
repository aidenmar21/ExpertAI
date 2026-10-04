import JobsDashboard from "@/components/JobsDashboard";
import { listJobSummaries } from "@/lib/db/jobs";

export const dynamic = "force-dynamic";

/** Home for the team: every job in shared/jobs, what each has learned, and the gaps that need an expert. */
export default async function JobsPage() {
  return <JobsDashboard jobs={await listJobSummaries()} />;
}
