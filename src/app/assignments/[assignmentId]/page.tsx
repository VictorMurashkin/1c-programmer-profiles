import { notFound, redirect } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { archiveAssignmentAction, saveAssignmentAction } from "@/app/idp-actions";
import { getSessionEmployee } from "@/lib/auth";
import { canEditAssignmentCatalog } from "@/lib/invariants";
import { getCompetency, getIdpAssignment } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AssignmentPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  const actor = await getSessionEmployee();
  if (!actor) redirect("/login");
  if (!canEditAssignmentCatalog(actor)) redirect("/idps");
  const { assignmentId } = await params;
  const row = getIdpAssignment(assignmentId);
  if (!row) notFound();
  const competency = getCompetency(row.competencyId);

  return (
    <div className="space-y-6">
      <p className="text-sm">
        <a href="/assignments" className="link-accent">
          ← Все задания
        </a>
      </p>
      <div className="page-kicker">
        <span className="pulse-dot" />
        <h1 className="page-title">{row.name}</h1>
      </div>
      <p className="text-sm">
        <span className="lbl">Компетенция</span>
        <span className="mt-1 block">{competency?.name ?? row.competencyId}</span>
      </p>
      {row.archived === 0 ? (
        <ActionForm action={saveAssignmentAction} className="panel panel-pad grid gap-3 text-sm md:grid-cols-2">
          <input type="hidden" name="id" value={row.id} />
          <input type="hidden" name="competencyId" value={row.competencyId} />
          <label className="lbl md:col-span-2">
            Название
            <input className="field" name="name" defaultValue={row.name} />
          </label>
          <label className="lbl">
            Узнать
            <textarea className="field" name="learnText" rows={4} defaultValue={row.learnText} />
          </label>
          <label className="lbl">
            Проверить
            <textarea className="field" name="verifyText" rows={4} defaultValue={row.verifyText} />
          </label>
          <button className="btn-primary w-fit" type="submit">
            Сохранить
          </button>
        </ActionForm>
      ) : null}
      <ActionForm action={archiveAssignmentAction}>
        <input type="hidden" name="id" value={row.id} />
        <button className={row.archived === 1 ? "btn" : "btn-archive w-fit"} type="submit">
          {row.archived === 1 ? "Вернуть" : "Перенести в архив"}
        </button>
      </ActionForm>
    </div>
  );
}
