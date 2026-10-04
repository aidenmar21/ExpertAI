import { notFound } from "next/navigation";
import FakeApp from "@/components/FakeApp";
import ApprenticePanel from "@/components/ApprenticePanel";
import ModeNav from "@/components/ModeNav";
import PopOut from "@/components/PopOut";
import TutorWorkspace from "@/components/TutorWorkspace";
import { listJobIds, loadJob } from "@/lib/db/jobs";

import { toClientJob } from "@/lib/job";
import { listJobSummaries } from "@/lib/db/jobs";
import JobsDashboard from "@/components/JobsDashboard";
import WorkMapView from "@/components/WorkMapView";
import DemoReset from "@/components/DemoReset";
export default async function Workspace({ searchParams }: { searchParams: Promise<{ job?: string; mode?: string; view?: string }> }) {
  const { job = "returns-desk", mode, view } = await searchParams;
  if (view === "/jobs") return <JobsDashboard jobs={await listJobSummaries()} />;
  if (view === "/demo") return <main className="p-8"><DemoReset jobs={(await listJobSummaries()).map(({ id, name }) => ({ id, name }))} /></main>;
  const id = job;
  if (!(await listJobIds()).includes(id)) notFound();
  const profile = toClientJob(await loadJob(id));
  const tutor = mode === "tutor";
  if (view === "/workmap") return <div className="flex min-h-screen flex-col"><ModeNav jobId={id} mode="workmap" /><WorkMapView jobId={id} jobName={profile.job.name} /></div>;
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
