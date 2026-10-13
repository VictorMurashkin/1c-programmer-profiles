import { redirect } from "next/navigation";
import { CompetencyMarkBoard } from "@/components/CompetencyMarkBoard";
import { getSessionEmployee } from "@/lib/auth";
import { competencyMarkViews } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function MyMarksPage() {
  const employee = await getSessionEmployee();
  if (!employee) redirect("/login");
  const { current, outside } = competencyMarkViews(employee.id, employee.jobId);
  return (
    <article className="space-y-6">
      <div className="page-kicker">
        <a href="/me" className="link-accent text-sm">
          Кабинет
        </a>
        <h1 className="page-title">Мои пометки</h1>
      </div>
      <p className="muted text-sm">Видите только вы. На разрыв, ИПР и должность пометки не влияют.</p>
      <CompetencyMarkBoard rows={[...current, ...outside]} />
    </article>
  );
}
