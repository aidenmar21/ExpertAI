import { notFound } from "next/navigation";
import ModeNav from "@/components/ModeNav";
import WorkMapView from "@/components/WorkMapView";
import { listJobIds, loadJob } from "@/lib/db/jobs";

export default async function WorkMapPage({ searchParams }: PageProps<"/workmap">) {
  const { job = "returns-desk" } = await searchParams;
  const id = Array.isArray(job) ? job[0] : job;
  if (!(await listJobIds()).includes(id)) notFound();
  const name = (await loadJob(id)).job.name;
  return (
    <div className="flex min-h-screen flex-col">
      <ModeNav jobId={id} mode="workmap" />
      <WorkMapView jobId={id} jobName={name} />
    </div>
  );
}
