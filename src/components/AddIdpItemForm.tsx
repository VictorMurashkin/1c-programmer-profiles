"use client";

import { useState } from "react";
import { addIdpItemAction } from "@/app/idp-actions";
import { ActionForm } from "@/components/ActionForm";

type PoolRow = { competencyId: string; competencyName: string; requiredLevel: number | null };
type CatalogRow = { id: string; name: string; competencyId: string; competencyName: string };

export function AddIdpItemForm({
  idpId,
  periodStart,
  periodEnd,
  pool,
  catalog,
}: {
  idpId: string;
  periodStart: string;
  periodEnd: string;
  pool: PoolRow[];
  catalog: CatalogRow[];
}) {
  const [competencyId, setCompetencyId] = useState(pool[0]?.competencyId ?? "");
  const visible = catalog.filter((row) => row.competencyId === competencyId);

  return (
    <ActionForm
      action={addIdpItemAction}
      className="grid gap-2 text-sm md:grid-cols-2"
      beforeSubmit={(formData) => {
        if (String(formData.get("assignmentId") ?? "").trim()) return null;
        const name = String(formData.get("name") ?? "").trim();
        const learnText = String(formData.get("learnText") ?? "").trim();
        const verifyText = String(formData.get("verifyText") ?? "").trim();
        if (!name || !learnText || !verifyText) return "Нужны название, узнать и проверить";
        return null;
      }}
    >
      <h3 className="section-title md:col-span-2 mb-0">Добавить задание</h3>
      <input type="hidden" name="idpId" value={idpId} />
      <label className="lbl">
        Компетенция
        <select
          className="field"
          name="competencyId"
          required
          value={competencyId}
          onChange={(event) => setCompetencyId(event.target.value)}
        >
          {pool.map((row) => (
            <option key={row.competencyId} value={row.competencyId}>
              {row.competencyName}
              {row.requiredLevel != null ? ` · ур. ${row.requiredLevel}` : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="lbl">
        Из справочника
        <select key={competencyId} className="field" name="assignmentId" defaultValue="">
          <option value="">новое задание</option>
          {visible.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </select>
      </label>
      <label className="lbl md:col-span-2">
        Название (если новое)
        <input className="field" name="name" />
      </label>
      <label className="lbl">
        Узнать
        <textarea className="field" name="learnText" rows={3} />
      </label>
      <label className="lbl">
        Проверить
        <textarea className="field" name="verifyText" rows={3} />
      </label>
      <label className="lbl">
        Срок
        <input className="field" type="date" name="dueOn" min={periodStart} max={periodEnd} />
      </label>
      <button className="btn-primary w-fit" type="submit">
        Добавить
      </button>
    </ActionForm>
  );
}
