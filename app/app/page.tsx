import { notFound } from "next/navigation";
import FakeApp from "@/components/FakeApp";
import ApprenticePanel from "@/components/ApprenticePanel";
import ModeNav from "@/components/ModeNav";
import PopOut from "@/components/PopOut";
import TutorWorkspace from "@/components/TutorWorkspace";
import { listJobIds, loadJob, toClientJob } from "@/lib/job";

export default async function Home({ searchParams }: PageProps<"/">) {
  const { job = "returns-desk", mode } = await searchParams;
  const id = Array.isArray(job) ? job[0] : job;
  if (!listJobIds().includes(id)) notFound();
  const profile = toClientJob(loadJob(id));
  const tutor = mode === "tutor";

  return (
    <div className="flex min-h-screen flex-col lg:h-screen">
      <ModeNav jobId={id} mode={tutor ? "tutor" : "expert"} />
      {tutor ? (
        <TutorWorkspace key={`tutor-${id}`} profile={profile} />
      ) : (
        <main className="mx-auto grid w-full max-w-[90rem] min-h-0 flex-1 grid-cols-1 gap-6 px-5 pb-6 pt-6 sm:px-6 md:px-8 lg:grid-cols-[minmax(0,1fr)_25rem]">
          <div className="min-h-[32rem] min-w-0">
            <FakeApp key={`expert-${id}`} profile={profile} />
          </div>
          <div className="min-h-[24rem] min-w-0">
            <PopOut>
              <ApprenticePanel jobId={id} escalateTo={profile.job.escalate_to} screenFields={profile.screen.fields.length} />
            </PopOut>
          </div>
        </main>
      )}
    </div>
  );
}
