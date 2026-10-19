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

function isHttpUrl(raw: string) {
  const protocol = URL.canParse(raw) ? new URL(raw).protocol : "";
  return protocol === "http:" || protocol === "https:";
}
