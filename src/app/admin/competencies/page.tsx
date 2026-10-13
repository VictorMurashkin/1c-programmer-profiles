import { redirect } from "next/navigation";
import { competencyTypeChip, competencyTypeLabel } from "@/components/CompetencyFields";
import { isAdmin } from "@/lib/auth";
import { listCompetencies } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function CompetenciesPage() {
  if (!(await isAdmin())) redirect("/admin/login");
  const items = listCompetencies();
  const nameById = new Map(items.map((item) => [item.id, item.name]));
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="page-kicker">
          <span className="pulse-dot" />
          <h1 className="page-title">Компетенции</h1>
        </div>
        <a href="/admin/competencies/new" className="btn-primary">
          Новая компетенция
        </a>
      </div>
      <ul className="panel">
        {items.map((item) => (
          <li key={item.id} className="list-row">
            <div>
              <a href={`/admin/competencies/${encodeURIComponent(item.id)}`} className="link-accent font-medium">
                {item.name}
              </a>
              {item.parentId ? (
                <div className="mt-1 text-xs muted">родитель: {nameById.get(item.parentId) ?? item.parentId}</div>
              ) : null}
            </div>
            <span className={competencyTypeChip(item.type)}>{competencyTypeLabel(item.type)}</span>
          </li>
        ))}
        {items.length === 0 ? <li className="list-row muted">Нет компетенций</li> : null}
      </ul>
    </div>
  );
}
