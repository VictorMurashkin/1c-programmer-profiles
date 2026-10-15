import type { ReactNode } from "react";
import { deleteIdpItemAction, updateIdpItemAction } from "@/app/idp-actions";
import { ActionForm } from "@/components/ActionForm";

export function IdpItemEdit({
  itemId,
  name,
  learnText,
  verifyText,
  dueOn,
  manage,
  learnExtra,
  verifyExtra,
  status,
  confirm,
}: {
  itemId: number;
  name: string;
  learnText: string;
  verifyText: string;
  dueOn: string | null;
  manage: boolean;
  learnExtra: ReactNode;
  verifyExtra: ReactNode;
  status: ReactNode;
  confirm: ReactNode;
}) {
  const formId = `idp-item-${itemId}`;

  return (
    <>
      <td>
        <div className="idp-cell-read font-medium">{name}</div>
        {manage ? (
          <label className="idp-cell-edit lbl">
            Название
            <input className="field" name="name" form={formId} defaultValue={name} />
          </label>
        ) : null}
        {manage ? (
          <div className="mt-2">
            <label className="btn idp-edit-open">
              <input className="idp-edit-toggle" type="checkbox" />
              Править
            </label>
            <div className="idp-edit-actions">
              <ActionForm id={formId} action={updateIdpItemAction}>
                <input type="hidden" name="itemId" value={itemId} />
                <button className="btn" type="submit">
                  Сохранить тексты
                </button>
              </ActionForm>
              <ActionForm action={deleteIdpItemAction}>
                <input type="hidden" name="itemId" value={itemId} />
                <button className="btn-danger" type="submit">
                  Убрать из плана
                </button>
              </ActionForm>
            </div>
          </div>
        ) : null}
      </td>
      <td>
        <p className="idp-cell-read whitespace-pre-wrap">{learnText}</p>
        {manage ? (
          <label className="idp-cell-edit lbl">
            Узнать
            <textarea className="field" name="learnText" form={formId} rows={3} defaultValue={learnText} />
          </label>
        ) : null}
        {learnExtra}
      </td>
      <td>
        <p className="idp-cell-read whitespace-pre-wrap">{verifyText}</p>
        {manage ? (
          <label className="idp-cell-edit lbl">
            Проверить
            <textarea className="field" name="verifyText" form={formId} rows={3} defaultValue={verifyText} />
          </label>
        ) : null}
        {verifyExtra}
      </td>
      <td>
        <span className="idp-cell-read">{dueOn ?? "—"}</span>
        {manage ? (
          <label className="idp-cell-edit lbl">
            Срок
            <input className="field" type="date" name="dueOn" form={formId} defaultValue={dueOn ?? ""} />
          </label>
        ) : null}
      </td>
      <td>{status}</td>
      <td>{confirm}</td>
    </>
  );
}
