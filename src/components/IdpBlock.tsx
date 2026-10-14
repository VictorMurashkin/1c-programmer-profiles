import { ActionForm } from "@/components/ActionForm";
import { AddIdpItemForm } from "@/components/AddIdpItemForm";
import { CompetencyLinks } from "@/components/CompetencyLinks";
import {
  acceptIdpItemAction,
  submitItemTestAction,
  cancelIdpAction,
  deleteIdpItemAction,
  refreshIdpPoolAction,
  setIdpItemStatusAction,
  unacceptIdpItemAction,
  updateIdpItemAction,
} from "@/app/idp-actions";
import type { SessionEmployee } from "@/lib/auth";
import { canManageEmployee, canTickIdpItem } from "@/lib/invariants";
import {
  getActiveIdp,
  getJob,
  listActiveIdpAssignmentsFor,
  listCompetencyLinks,
  listIdpItems,
  listItemAttemptState,
  listItemQuestionPrompts,
  listItemTestsForTake,
  listIdps,
} from "@/lib/queries";
import type { idpItems, idpPool, idps } from "@/db/schema";

const ITEM_STATUS: Record<string, string> = {
  not_started: "не начат",
  in_progress: "в работе",
  done: "сделал",
};

const IDP_STATUS: Record<string, string> = {
  active: "активен",
  completed: "выполнен",
  cancelled: "отменён",
};

export function EmployeeIdpSummary({ employeeId }: { employeeId: string }) {
  const active = getActiveIdp(employeeId);
  const history = listIdps(employeeId).filter((row) => row.id !== active?.id);
  const items = active ? listIdpItems(active.id) : [];
  const accepted = items.filter((item) => item.acceptedAt != null).length;
  return (
    <section className="space-y-3">
      <h2 className="section-title">ИПР</h2>
      {active ? (
        <p>
          <a href={`/idps/${active.id}`} className="link-accent">
            Активный план: {getJob(active.sourceJobId)?.name ?? active.sourceJobId} →{" "}
            {getJob(active.targetJobId)?.name ?? active.targetJobId}
          </a>
          <span className="muted ml-2">
            принято {accepted} из {items.length}
          </span>
        </p>
      ) : (
        <p className="muted text-sm">
          Активного плана нет. Создать можно в разделе{" "}
          <a href="/idps" className="link-accent">
            ИПР
          </a>
          .
        </p>
      )}
      {history.length > 0 ? (
        <ul className="panel">
          {history.map((row) => (
            <li key={row.id} className="list-row text-sm">
              <a href={`/idps/${row.id}`} className="link-accent">
                {getJob(row.sourceJobId)?.name ?? row.sourceJobId} → {getJob(row.targetJobId)?.name ?? row.targetJobId}
              </a>
              <span className="chip">{IDP_STATUS[row.status] ?? row.status}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function groupItems(items: (typeof idpItems.$inferSelect)[]) {
  const order: string[] = [];
  const byComp = new Map<string, (typeof idpItems.$inferSelect)[]>();
  for (const item of items) {
    if (!byComp.has(item.competencyId)) {
      byComp.set(item.competencyId, []);
      order.push(item.competencyId);
    }
    byComp.get(item.competencyId)!.push(item);
  }
  return order.map((competencyId) => {
    const rows = byComp.get(competencyId)!;
    const confirmed = rows.length > 0 && rows.every((row) => row.acceptedAt != null);
    return { competencyId, name: rows[0].competencyName, requiredLevel: rows[0].requiredLevel, confirmed, rows };
  });
}

export function IdpBlock({
  actor,
  idp,
  items,
  pool,
}: {
  actor: SessionEmployee;
  idp: typeof idps.$inferSelect;
  items: (typeof idpItems.$inferSelect)[];
  pool: (typeof idpPool.$inferSelect)[];
}) {
  const open = idp.status === "active";
  const manage = open && canManageEmployee(actor, idp.employeeId);
  const reopen = idp.status === "completed" && canManageEmployee(actor, idp.employeeId);
  const tick = open && canTickIdpItem(actor, idp.employeeId);
  const accepted = items.filter((item) => item.acceptedAt != null).length;
  const groups = groupItems(items);
  const links = listCompetencyLinks();
  const prompts = listItemQuestionPrompts(items.map((item) => item.id));
  const tests = listItemTestsForTake(items.map((item) => item.id));
  const attempts = listItemAttemptState(items.map((item) => item.id));
  const competencyName = new Map(pool.map((row) => [row.competencyId, row.competencyName]));
  const catalog = listActiveIdpAssignmentsFor(pool.map((row) => row.competencyId)).map((assignment) => ({
    ...assignment,
    competencyName: competencyName.get(assignment.competencyId) ?? assignment.competencyId,
  }));

  return (
    <section className="space-y-4">
      <div className="panel panel-pad space-y-4">
        <p>
          <span className="chip">{IDP_STATUS[idp.status] ?? idp.status}</span>
          <span className="muted ml-2">
            принято {accepted} из {items.length}
          </span>
        </p>
        {manage ? (
          <div className="flex flex-wrap gap-2">
            <ActionForm action={refreshIdpPoolAction}>
              <input type="hidden" name="idpId" value={idp.id} />
              <button className="btn" type="submit">
                Обновить разрыв
              </button>
            </ActionForm>
            <ActionForm action={cancelIdpAction}>
              <input type="hidden" name="idpId" value={idp.id} />
              <button className="btn-quiet" type="submit">
                Отменить
              </button>
            </ActionForm>
          </div>
        ) : null}
        {groups.map((group) => (
          <div key={group.competencyId} className="space-y-2">
            <h3 className="section-title mb-0">
              {group.name}
              {group.requiredLevel != null ? (
                <span className="muted font-normal"> · уровень {group.requiredLevel}</span>
              ) : null}
              <span className="chip ml-2">{group.confirmed ? "компетенция подтверждена" : "не подтверждена"}</span>
            </h3>
            <div className="idp-table-scroll">
            <table className="idp-table">
              <thead>
                <tr>
                  <th>Цель</th>
                  <th>Узнать</th>
                  <th>Проверить</th>
                  <th>Срок</th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map((item) => {
                  const acceptedRow = item.acceptedAt != null;
                  const canTickRow = tick && !acceptedRow;
                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="font-medium">{item.assignmentName}</div>
                        <span className="chip mt-2">
                          {acceptedRow ? "принято" : ITEM_STATUS[item.status] ?? item.status}
                        </span>
                        {canTickRow ? (
                          <ActionForm action={setIdpItemStatusAction} className="mt-2 flex flex-wrap items-end gap-2">
                            <input type="hidden" name="itemId" value={item.id} />
                            <label className="lbl">
                              Ход
                              <select className="field" name="status" defaultValue={item.status}>
                                <option value="not_started">не начат</option>
                                <option value="in_progress">в работе</option>
                                <option value="done">сделал</option>
                              </select>
                            </label>
                            <button className="btn-quiet" type="submit">
                              Ок
                            </button>
                          </ActionForm>
                        ) : null}
                        {manage && !acceptedRow ? (
                          <ActionForm action={acceptIdpItemAction} className="mt-2">
                            <input type="hidden" name="itemId" value={item.id} />
                            <button className="btn" type="submit">
                              Принять
                            </button>
                          </ActionForm>
                        ) : null}
                        {(manage || reopen) && acceptedRow ? (
                          <ActionForm action={unacceptIdpItemAction} className="mt-2">
                            <input type="hidden" name="itemId" value={item.id} />
                            <button className="btn-quiet" type="submit">
                              Снять приёмку
                            </button>
                          </ActionForm>
                        ) : null}
                        {manage ? (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-sm">Править</summary>
                            <ActionForm action={updateIdpItemAction} className="mt-2 grid gap-2">
                              <input type="hidden" name="itemId" value={item.id} />
                              <label className="lbl">
                                Название
                                <input className="field" name="name" defaultValue={item.assignmentName} />
                              </label>
                              <label className="lbl">
                                Узнать
                                <textarea className="field" name="learnText" rows={3} defaultValue={item.learnText} />
                              </label>
                              <label className="lbl">
                                Проверить
                                <textarea className="field" name="verifyText" rows={3} defaultValue={item.verifyText} />
                              </label>
                              <label className="lbl">
                                Срок
                                <input className="field" type="date" name="dueOn" defaultValue={item.dueOn ?? ""} />
                              </label>
                              <button className="btn w-fit" type="submit">
                                Сохранить тексты
                              </button>
                            </ActionForm>
                            <ActionForm action={deleteIdpItemAction} className="mt-2">
                              <input type="hidden" name="itemId" value={item.id} />
                              <button className="btn-danger" type="submit">
                                Убрать из плана
                              </button>
                            </ActionForm>
                          </details>
                        ) : null}
                      </td>
                      <td>
                        <p className="whitespace-pre-wrap">{item.learnText}</p>
                        <CompetencyLinks links={links.get(group.competencyId) ?? []} />
                      </td>
                      <td className="whitespace-pre-wrap">
                        <p>{item.verifyText}</p>
                        {(prompts.get(item.id) ?? []).length > 0 ? (
                          <ul className="mt-2">
                            {(prompts.get(item.id) ?? []).map((prompt, index) => (
                              <li key={`${item.id}-${index}`}>{prompt}</li>
                            ))}
                          </ul>
                        ) : null}
                        {attempts.get(item.id)?.passed === true ? <p className="mt-2">сдан</p> : null}
                        {attempts.get(item.id)?.passed === false ? <p className="mt-2">не сдан</p> : null}
                        {(attempts.get(item.id)?.count ?? 0) > 0 ? (
                          <p className="muted mt-1 text-sm">Попыток: {attempts.get(item.id)?.count}</p>
                        ) : null}
                        {actor.id === idp.employeeId && open && (tests.get(item.id)?.length ?? 0) > 0 ? (
                          <ActionForm action={submitItemTestAction} className="mt-2 space-y-2">
                            <input type="hidden" name="itemId" value={item.id} />
                            {(tests.get(item.id) ?? []).map((question) => (
                              <fieldset key={question.id}>
                                <legend>{question.prompt}</legend>
                                {question.options.map((option) => (
                                  <label key={option.id} className="mt-1 block">
                                    <input type="radio" name={`answer-${question.id}`} value={option.id} required /> {option.text}
                                  </label>
                                ))}
                              </fieldset>
                            ))}
                            <button className="btn w-fit" type="submit">
                              Сдать тест
                            </button>
                          </ActionForm>
                        ) : null}
                      </td>
                      <td>{item.dueOn ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        ))}
        {items.length === 0 ? (
          <p className="muted text-sm">
            Заданий пока нет. ИПР станет выполненным, когда добавите хотя бы одно и примете все.
          </p>
        ) : null}
        {manage && pool.length > 0 ? (
          <AddIdpItemForm
            idpId={idp.id}
            periodStart={idp.periodStart}
            periodEnd={idp.periodEnd}
            pool={pool}
            catalog={catalog}
          />
        ) : null}
        {manage && pool.length === 0 ? (
          <p className="muted text-sm">В пуле нет компетенций. Нажмите «Обновить разрыв».</p>
        ) : null}
      </div>
    </section>
  );
}
