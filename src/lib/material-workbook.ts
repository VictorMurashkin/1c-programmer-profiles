import type { CompetencyLinkKind } from "@/db/schema";

export const MATERIAL_IMPORT_COLUMNS = ["Компетенция", "Вид", "Название", "Адрес"] as const;

export type ParsedMaterial = {
  competencyId: string;
  kind: CompetencyLinkKind;
  title: string;
  url: string;
};

const KINDS: Record<string, CompetencyLinkKind> = {
  its: "its",
  итс: "its",
  training: "training",
  обучение: "training",
  video: "video",
  видео: "video",
};

export function parseMaterialSheet(grid: string[][]): { errors: string[]; materials: ParsedMaterial[] } {
  const header = grid[0] ?? [];
  const headerOk = MATERIAL_IMPORT_COLUMNS.every((name, index) => (header[index] ?? "").trim() === name);
  if (!headerOk) {
    return { errors: [`В первой строке нужны колонки: ${MATERIAL_IMPORT_COLUMNS.join(", ")}`], materials: [] };
  }

  const errors: string[] = [];
  const materials: ParsedMaterial[] = [];
  const seen = new Map<string, ParsedMaterial>();
  for (let index = 1; index < grid.length; index += 1) {
    const cells = MATERIAL_IMPORT_COLUMNS.map((_, column) => (grid[index]?.[column] ?? "").trim());
    if (cells.every((cell) => cell === "")) continue;
    const [competencyId, kindCell, title, url] = cells;
    const row = index + 1;
    if (!competencyId) errors.push(`Строка ${row}: пустая компетенция`);
    if (!title) errors.push(`Строка ${row}: пустое название`);
    const kind = KINDS[(kindCell ?? "").toLowerCase()];
    if (!kind) errors.push(`Строка ${row}: вид — ИТС, обучение или видео`);
    if (!isHttpUrl(url ?? "")) errors.push(`Строка ${row}: адрес — только http:// или https://`);
    if (!competencyId || !title || !kind || !isHttpUrl(url ?? "")) continue;
    const key = `${competencyId}\0${url}`;
    const existing = seen.get(key);
    if (existing) {
      if (existing.title !== title || existing.kind !== kind) {
        errors.push(`Строка ${row}: у адреса «${url}» другое название или вид`);
      }
      continue;
    }
    const material = { competencyId, kind, title, url: url ?? "" };
    seen.set(key, material);
    materials.push(material);
  }
  if (materials.length === 0 && errors.length === 0) return { errors: ["В файле нет строк"], materials: [] };
  return { errors, materials };
}

export function materialSheetRows(materials: ParsedMaterial[]): string[][] {
  const kindLabel: Record<CompetencyLinkKind, string> = { its: "ИТС", training: "Обучение", video: "Видео" };
  return [
    [...MATERIAL_IMPORT_COLUMNS],
    ...materials.map((item) => [item.competencyId, kindLabel[item.kind], item.title, item.url]),
  ];
}

const JSON_KINDS = new Set<CompetencyLinkKind>(["its", "training", "video"]);

/** Тот же состав, что у книги: массив или объект с полем `materials`. */
export function parseMaterialJson(text: string): { errors: string[]; materials: ParsedMaterial[] } {
  let raw: unknown;
  try {
    raw = JSON.parse(text.replace(/^\uFEFF/, "")) as unknown;
  } catch {
    return { errors: ["Не разобрать JSON"], materials: [] };
  }
  const list = Array.isArray(raw) ? raw : isRecord(raw) && Array.isArray(raw.materials) ? raw.materials : null;
  if (!list) return { errors: ["Нужен JSON-массив или объект с полем materials"], materials: [] };
  if (list.length === 0) return { errors: ["В файле нет материалов"], materials: [] };
  const errors: string[] = [];
  const materials: ParsedMaterial[] = [];
  list.forEach((item, index) => {
    if (!isRecord(item)) {
      errors.push(`Материал ${index + 1}: нужен объект`);
      return;
    }
    const competencyId = jsonText(item.competencyId, `Материал ${index + 1}: нужен competencyId`, errors);
    const title = jsonText(item.title, `Материал ${index + 1}: нужно название`, errors);
    const url = jsonText(item.url, `Материал ${index + 1}: нужен адрес`, errors);
    const kind = item.kind;
    if (typeof kind !== "string" || !JSON_KINDS.has(kind as CompetencyLinkKind)) {
      errors.push(`Материал ${index + 1}: kind — its, training или video`);
      return;
    }
    if (!competencyId || !title || !url) return;
    materials.push({ competencyId, kind: kind as CompetencyLinkKind, title, url });
  });
  if (errors.length > 0) return { errors, materials: [] };
  return parseMaterialSheet(materialSheetRows(materials));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jsonText(value: unknown, label: string, errors: string[]): string | null {
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(label);
    return null;
  }
  return value.trim();
}

function isHttpUrl(raw: string) {
  const protocol = URL.canParse(raw) ? new URL(raw).protocol : "";
  return protocol === "http:" || protocol === "https:";
}
