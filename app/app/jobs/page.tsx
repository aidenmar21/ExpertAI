import JobsDashboard from "@/components/JobsDashboard";
import { listJobSummaries } from "@/lib/job";

export const dynamic = "force-dynamic";

/** Home for the team: every job in shared/jobs, what each has learned, and the gaps that need an expert. */
export default function JobsPage() {
  return <JobsDashboard jobs={listJobSummaries()} />;
}
