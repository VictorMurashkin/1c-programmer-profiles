"use client";

import { useActionState } from "react";
import { importCompetencyLinksAction } from "@/app/actions";
import { MATERIAL_IMPORT_COLUMNS } from "@/lib/material-workbook";

export function MaterialImportForm() {
  const [state, action, pending] = useActionState(importCompetencyLinksAction, null);
  return (
    <form action={action} className="panel panel-pad space-y-3 text-sm" aria-label="Загрузка материалов">
      <h2 className="section-title mb-0">Загрузка материалов</h2>
      <p className="muted">
        Колонки: {MATERIAL_IMPORT_COLUMNS.join(", ")}. Вид: ИТС, обучение или видео. Один адрес у компетенции повторно не
        добавляется: если название или вид другие, ссылка обновляется.
      </p>
      <label className="lbl">
        Файл Excel
        <input className="field" type="file" name="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required />
      </label>
      <button className="btn-primary w-fit" type="submit">
        Загрузить
      </button>
      {state?.error ? (
        <p className="form-error whitespace-pre-line" role="alert">
          {state.error}
        </p>
      ) : null}
      {state?.notice ? (
        <p className="whitespace-pre-line" role="status">
          {state.notice}
        </p>
      ) : null}
      {pending ? <p className="muted text-sm">Сохраняем…</p> : null}
    </form>
  );
}
