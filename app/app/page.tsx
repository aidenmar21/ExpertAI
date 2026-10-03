import FakeApp from "@/components/FakeApp";
import ApprenticePanel from "@/components/ApprenticePanel";
import { notFound } from "next/navigation";
import { listJobIds, loadJob, toClientJob } from "@/lib/job";

export default async function Home({ searchParams }: PageProps<"/">) {
  const { job = "returns-desk" } = await searchParams;
  const id = Array.isArray(job) ? job[0] : job;
  if (!listJobIds().includes(id)) notFound();
  const profile = toClientJob(loadJob(id));

  return (
    <main className="grid h-screen grid-cols-1 gap-6 p-6 lg:grid-cols-3">
      <div className="min-h-[32rem] lg:col-span-2">
        <FakeApp profile={profile} />
      </div>
      <div className="min-h-[24rem]">
        <ApprenticePanel jobId={id} escalateTo={profile.job.escalate_to} />
      </div>
    </main>
  );
}
