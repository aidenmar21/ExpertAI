import { knowledgeIndex } from "@understudy/brain/server";
import NewJobWizard from "@/components/NewJobWizard";

export const dynamic = "force-dynamic";

/** Four-step wizard: role, software, name, pasted company knowledge. Creates shared/jobs/<id>.json. */
export default function NewJobPage() {
  const { roles, software } = knowledgeIndex();
  return <NewJobWizard knowledge={{ roles, software }} />;
}
