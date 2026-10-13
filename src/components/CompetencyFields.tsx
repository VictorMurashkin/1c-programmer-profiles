export const COMPETENCY_TYPES = [
  { value: "professional", label: "Профессиональная" },
  { value: "universal", label: "Универсальная" },
  { value: "duty", label: "Обязанность" },
] as const;

export function competencyTypeLabel(type: string) {
  return COMPETENCY_TYPES.find((item) => item.value === type)?.label ?? type;
}

export function competencyTypeChip(type: string) {
  if (type === "professional") return "chip chip-frontend";
  if (type === "universal") return "chip chip-backend";
  return "chip chip-cloud";
}

type CompetencyDraft = {
  id: string;
  name: string;
  type: string;
  parentId: string | null;
  description: string | null;
};

/** Поля карточки компетенции. Без `competency` — форма создания, идентификатор вводит админ. */
export function CompetencyFields({
  competency,
  roots,
}: {
  competency?: CompetencyDraft;
  roots: { id: string; name: string }[];
}) {
  const parents = roots.filter((root) => root.id !== competency?.id);
  return (
    <>
      {competency ? (
        <input type="hidden" name="id" value={competency.id} />
      ) : (
        <label className="lbl">
          Идентификатор
          <input name="id" placeholder="латиница" className="field" required />
        </label>
      )}
      <label className="lbl">
        Название
        <input name="name" defaultValue={competency?.name ?? ""} className="field" required />
      </label>
      <label className="lbl">
        Тип
        <select name="type" defaultValue={competency?.type ?? "professional"} className="field">
          {COMPETENCY_TYPES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label className="lbl">
        Родитель
        <select name="parentId" defaultValue={competency?.parentId ?? ""} className="field">
          <option value="">без родителя</option>
          {parents.map((root) => (
            <option key={root.id} value={root.id}>
              {root.name}
            </option>
          ))}
        </select>
      </label>
      <label className="lbl md:col-span-2">
        Описание
        <textarea name="description" defaultValue={competency?.description ?? ""} className="field" />
      </label>
    </>
  );
}
