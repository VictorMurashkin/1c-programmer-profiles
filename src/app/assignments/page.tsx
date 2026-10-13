import { redirect } from "next/navigation";
import { getSessionEmployee } from "@/lib/auth";
import { canEditAssignmentCatalog } from "@/lib/invariants";
import { getCompetency, listIdpAssignments } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AssignmentsPage() {
  const actor = await getSessionEmployee();
  if (!actor) redirect("/login");
  if (!canEditAssignmentCatalog(actor)) redirect("/idps");
  const items = listIdpAssignments();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="page-kicker">
          <span className="pulse-dot" />
          <h1 className="page-title">Задания ИПР</h1>
        </div>
        <a href="/assignments/new" className="btn-primary">
          Новое задание
        </a>
      </div>
      <ul className="panel">
        {items.map((row) => {
          const competency = getCompetency(row.competencyId);
          return (
            <li key={row.id} className="list-row">
              <div>
                <a href={`/assignments/${encodeURIComponent(row.id)}`} className="link-accent font-medium">
                  {row.name}
                </a>
                <div className="mt-1 text-xs muted">{competency?.name ?? row.competencyId}</div>
              </div>
              {row.archived === 1 ? <span className="chip">скрыто</span> : null}
            </li>
          );
        })}
        {items.length === 0 ? <li className="list-row muted">Заданий ещё нет</li> : null}
      </ul>
    </div>
  );
}
