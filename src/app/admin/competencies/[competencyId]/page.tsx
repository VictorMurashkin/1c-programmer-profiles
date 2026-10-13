import { notFound, redirect } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { CompetencyFields } from "@/components/CompetencyFields";
import { CompetencyLinks, LINK_KINDS } from "@/components/CompetencyLinks";
import {
  addCompetencyLinkAction,
  deleteCompetencyAction,
  deleteCompetencyLinkAction,
  saveCompetencyAction,
} from "@/app/actions";
import { isAdmin } from "@/lib/auth";
import { getCompetency, listCompetencies, listCompetencyLinks } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function CompetencyPage({ params }: { params: Promise<{ competencyId: string }> }) {
  if (!(await isAdmin())) redirect("/admin/login");
  const { competencyId } = await params;
  const competency = getCompetency(decodeURIComponent(competencyId));
  if (!competency) notFound();
  const roots = listCompetencies().filter((item) => !item.parentId);
  const links = listCompetencyLinks().get(competency.id) ?? [];
  return (
    <div className="space-y-6">
      <p className="text-sm">
        <a href="/admin/competencies" className="link-accent">
          ← Все компетенции
        </a>
      </p>
      <div className="page-kicker">
        <span className="pulse-dot" />
        <h1 className="page-title">{competency.name}</h1>
      </div>
      <p className="text-xs muted">{competency.id}</p>
      <ActionForm action={saveCompetencyAction} className="panel panel-pad grid gap-3 text-sm md:grid-cols-2">
        <CompetencyFields competency={competency} roots={roots} />
        <button className="btn-primary w-fit" type="submit">
          Сохранить
        </button>
      </ActionForm>
      <div role="group" aria-label={`Материалы: ${competency.name}`} className="panel panel-pad">
        <h2 className="section-title">Материалы</h2>
        <CompetencyLinks
          links={links}
          action={(link) => (
            <ActionForm action={deleteCompetencyLinkAction}>
              <input type="hidden" name="linkId" value={link.id} />
              <button className="btn-danger" type="submit">
                Удалить ссылку
              </button>
            </ActionForm>
          )}
        />
        <ActionForm action={addCompetencyLinkAction} className="mt-3 grid gap-2 md:grid-cols-4">
          <input type="hidden" name="competencyId" value={competency.id} />
          <label className="lbl">
            Вид
            <select name="kind" className="field">
              {LINK_KINDS.map((kind) => (
                <option key={kind.value} value={kind.value}>
                  {kind.label}
                </option>
              ))}
            </select>
          </label>
          <label className="lbl">
            Название ссылки
            <input name="title" className="field" />
          </label>
          <label className="lbl">
            Адрес
            <input name="url" className="field" placeholder="https://" />
          </label>
          <button className="btn w-fit self-end" type="submit">
            Добавить ссылку
          </button>
        </ActionForm>
      </div>
      <ActionForm action={deleteCompetencyAction} successPath="/admin/competencies">
        <input type="hidden" name="id" value={competency.id} />
        <button className="btn-danger" type="submit">
          Удалить
        </button>
      </ActionForm>
    </div>
  );
}
