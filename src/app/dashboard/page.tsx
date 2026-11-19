import { cookies } from "next/headers";
import { requireWorkspace } from "@/lib/workspace";
import { overviewData } from "@/lib/data";
import { Overview } from "@/components/dashboard/overview";
export default async function Page() {
  const { workspaceId } = await requireWorkspace();
  const data = await overviewData(workspaceId);
  return (
    <Overview
      data={data}
      language={
        (await cookies()).get("duo-language")?.value === "en" ? "en" : "ar"
      }
    />
  );
}
