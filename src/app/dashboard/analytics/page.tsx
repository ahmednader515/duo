import { cookies } from "next/headers";
import { requireWorkspace } from "@/lib/workspace";
import { overviewData } from "@/lib/data";
import { Stats } from "@/components/dashboard/overview";
import { Card } from "@/components/ui";
export default async function Page() {
  const { workspaceId } = await requireWorkspace();
  const data = await overviewData(workspaceId);
  const ar = (await cookies()).get("duo-language")?.value !== "en";
  return (
    <>
      <Stats data={data} language={ar ? "ar" : "en"} />
      <Card>
        <h2>{ar ? "استخدام الذكاء الاصطناعي" : "AI generation usage"}</h2>
        <dl className="detail-grid">
          {[
            [ar ? "عمليات التوليد" : "Generations", data.usage._count],
            [
              ar ? "التوكنات المستخدمة" : "Tokens used",
              data.usage._sum.tokenUsage || 0,
            ],
            [
              ar ? "التكلفة المقدرة (USD)" : "Estimated cost (USD)",
              data.usage._sum.estimatedCost?.toString() || "0",
            ],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <p className="form-help">
          {ar
            ? "هذه الأرقام من سجلات مساحة عملك فقط."
            : "These figures come only from your workspace records."}
        </p>
      </Card>
      <Card>
        <h2>{ar ? "تكوين كتالوجك" : "Your catalog composition"}</h2>
        <div className="form-grid">
          {[
            [ar ? "نشط" : "Active", data.active, "#56ad86"],
            [ar ? "مسودة" : "Draft", data.draft, "#e9bb63"],
            [
              ar ? "مؤرشف" : "Archived",
              data.total - data.active - data.draft,
              "#b6a4cb",
            ],
          ].map(([label, count, color]) => (
            <div key={label}>
              <div className="stat-label">
                <span>{label}</span>
                <span>{count}</span>
              </div>
              <div
                style={{
                  height: 9,
                  background: "#f0eaf6",
                  borderRadius: 10,
                  marginTop: 10,
                }}
              >
                <div
                  style={{
                    height: "100%",
                    borderRadius: 10,
                    background: String(color),
                    width: `${data.total ? (Number(count) / data.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
