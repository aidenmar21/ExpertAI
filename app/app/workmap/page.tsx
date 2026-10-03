import { notFound } from "next/navigation";
import WorkMapView from "@/components/WorkMapView";
import { listJobIds, loadJob } from "@/lib/job";

export default async function WorkMapPage({ searchParams }: PageProps<"/workmap">) {
  const { job = "returns-desk" } = await searchParams;
  const id = Array.isArray(job) ? job[0] : job;
  if (!listJobIds().includes(id)) notFound();
  return <WorkMapView jobId={id} jobName={loadJob(id).job.name} />;
}
