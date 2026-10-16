export const ASSIGNMENT_IMPORT_COLUMNS = [
  "Компетенция",
  "Задание",
  "Узнать",
  "Проверить",
  "Вопрос",
  "Вариант",
  "Верный",
] as const;

export type ParsedAssignment = {
  competencyId: string;
  name: string;
  learnText: string;
  verifyText: string;
  questions: { prompt: string; options: { text: string; correct: boolean }[] }[];
};

type SheetRow = {
  row: number;
  competencyId: string;
  name: string;
  learnText: string;
  verifyText: string;
  prompt: string;
  option: string;
  correct: string;
};

/** Разбор первой страницы. При ошибках действие не пишет, но список нужен, чтобы добавить ошибки справочника. */
export function parseAssignmentSheet(grid: string[][]): { errors: string[]; assignments: ParsedAssignment[] } {
  const header = grid[0] ?? [];
  const headerOk = ASSIGNMENT_IMPORT_COLUMNS.every((name, index) => (header[index] ?? "").trim() === name);
  if (!headerOk) {
    return {
      errors: [`В первой строке нужны колонки: ${ASSIGNMENT_IMPORT_COLUMNS.join(", ")}`],
      assignments: [],
    };
  }

  const rows: SheetRow[] = [];
  for (let index = 1; index < grid.length; index += 1) {
    const cells = ASSIGNMENT_IMPORT_COLUMNS.map((_, column) => (grid[index]?.[column] ?? "").trim());
    if (cells.every((cell) => cell === "")) continue;
    rows.push({
      row: index + 1,
      competencyId: cells[0] ?? "",
      name: cells[1] ?? "",
      learnText: cells[2] ?? "",
      verifyText: cells[3] ?? "",
      prompt: cells[4] ?? "",
      option: cells[5] ?? "",
      correct: cells[6] ?? "",
    });
  }
  if (rows.length === 0) return { errors: ["В файле нет строк"], assignments: [] };

  const errors: string[] = [];
  const groups = new Map<
    string,
    {
      competencyId: string;
      name: string;
      learnText: string;
      verifyText: string;
      questions: Map<string, { prompt: string; options: { text: string; correct: boolean }[] }>;
    }
  >();

  for (const row of rows) {
    if (!row.competencyId) errors.push(`Строка ${row.row}: неизвестная компетенция`);
    if (!row.name) errors.push(`Строка ${row.row}: пустое название`);
    if (!row.learnText || !row.verifyText) errors.push(`Строка ${row.row}: нужны «узнать» и «проверить»`);

    const asked = row.prompt !== "" || row.option !== "" || row.correct !== "";
    let correct: boolean | null = null;
    if (asked) {
      if (!row.prompt) errors.push(`Строка ${row.row}: вариант без вопроса`);
      if (!row.option) errors.push(`Строка ${row.row}: нужен текст варианта`);
      correct = correctFlag(row.correct);
      if (correct == null) errors.push(`Строка ${row.row}: признак «верный» — да или нет`);
    }

    if (!row.competencyId || !row.name) continue;
    const key = `${row.competencyId}\0${row.name.toLowerCase()}`;
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        competencyId: row.competencyId,
        name: row.name,
        learnText: row.learnText,
        verifyText: row.verifyText,
        questions: new Map(),
      });
    } else {
      if (row.learnText && row.learnText !== existing.learnText) {
        errors.push(`Строка ${row.row}: у задания «${existing.name}» другой текст «узнать»`);
      }
      if (row.verifyText && row.verifyText !== existing.verifyText) {
        errors.push(`Строка ${row.row}: у задания «${existing.name}» другой текст «проверить»`);
      }
    }
    const group = groups.get(key);
    if (!group || !row.prompt || !row.option || correct == null) continue;
    const questionKey = row.prompt.toLowerCase();
    const question = group.questions.get(questionKey) ?? { prompt: row.prompt, options: [] };
    question.options.push({ text: row.option, correct });
    group.questions.set(questionKey, question);
  }

  const assignments: ParsedAssignment[] = [];
  for (const group of groups.values()) {
    const questions = [...group.questions.values()];
    for (const question of questions) {
      if (question.options.length < 2) {
        errors.push(`У вопроса «${question.prompt}» нужно хотя бы два варианта`);
        continue;
      }
      const correctCount = question.options.filter((option) => option.correct).length;
      if (correctCount !== 1) {
        errors.push(`У вопроса «${question.prompt}» должен быть ровно один верный вариант`);
      }
    }
    assignments.push({
      competencyId: group.competencyId,
      name: group.name,
      learnText: group.learnText,
      verifyText: group.verifyText,
      questions,
    });
  }
  return { errors, assignments };
}

function correctFlag(value: string): boolean | null {
  const flag = value.trim().toLowerCase();
  if (flag === "да" || flag === "1") return true;
  if (flag === "нет" || flag === "0") return false;
  return null;
}
