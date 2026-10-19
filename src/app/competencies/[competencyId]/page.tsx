import { notFound, redirect } from "next/navigation";
import { CompetencyLinks } from "@/components/CompetencyLinks";
import { getSessionEmployee } from "@/lib/auth";
import { getCompetency, listCompetencyLinks } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function CompetencyMaterialsPage({ params }: { params: Promise<{ competencyId: string }> }) {
  const actor = await getSessionEmployee();
  if (!actor) redirect("/login");
  const { competencyId } = await params;
  const competency = getCompetency(decodeURIComponent(competencyId));
  if (!competency) notFound();
  const links = listCompetencyLinks().get(competency.id) ?? [];

  return (
    <article className="space-y-6">
      <div className="page-kicker">
        <span className="pulse-dot" />
        <h1 className="page-title">{competency.name}</h1>
      </div>
      <div role="group" aria-label={`Материалы: ${competency.name}`} className="panel panel-pad">
        <h2 className="section-title">Материалы</h2>
        {links.length === 0 ? <p className="muted">Материалов нет</p> : <CompetencyLinks links={links} />}
      </div>
    </article>
  );
}
