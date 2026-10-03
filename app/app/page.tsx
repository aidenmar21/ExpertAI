import { notFound } from "next/navigation";
import FakeApp from "@/components/FakeApp";
import ApprenticePanel from "@/components/ApprenticePanel";
import ModeNav from "@/components/ModeNav";
import TutorWorkspace from "@/components/TutorWorkspace";
import { listJobIds, loadJob, toClientJob } from "@/lib/job";

export default async function Home({ searchParams }: PageProps<"/">) {
  const { job = "returns-desk", mode } = await searchParams;
  const id = Array.isArray(job) ? job[0] : job;
  if (!listJobIds().includes(id)) notFound();
  const profile = toClientJob(loadJob(id));
  const tutor = mode === "tutor";

  return (
    <div className="flex h-screen flex-col">
      <ModeNav jobId={id} mode={tutor ? "tutor" : "expert"} />
      {tutor ? (
        <TutorWorkspace key={`tutor-${id}`} profile={profile} />
      ) : (
        <main className="grid min-h-0 flex-1 grid-cols-1 gap-6 px-6 pb-6 lg:grid-cols-3">
          <div className="min-h-[32rem] lg:col-span-2">
            <FakeApp key={`expert-${id}`} profile={profile} />
          </div>
          <div className="min-h-[24rem]">
            <ApprenticePanel jobId={id} escalateTo={profile.job.escalate_to} />
          </div>
        </main>
      )}
    </div>
  );
}
