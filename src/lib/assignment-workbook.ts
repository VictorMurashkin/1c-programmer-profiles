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
  /** Колонки «Уровень» в файле не было. */
  levelProvided: boolean;
  /** Пустая ячейка — уровень не задавать. 1, 2 или 3 — записать. */
  level: number | null;
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
  levelProvided: boolean;
  level: number | null;
};

/** Разбор первой страницы. При ошибках действие не пишет, но список нужен, чтобы добавить ошибки справочника. */
export function parseAssignmentSheet(grid: string[][]): { errors: string[]; assignments: ParsedAssignment[] } {
  const header = grid[0] ?? [];
  const headerOk = ASSIGNMENT_IMPORT_COLUMNS.every((name, index) => (header[index] ?? "").trim() === name);
  const levelProvided = (header[7] ?? "").trim() === "Уровень";
  const stray = (header[7] ?? "").trim();
  if (!headerOk || (stray !== "" && !levelProvided)) {
    return {
      errors: [`В первой строке нужны колонки: ${ASSIGNMENT_IMPORT_COLUMNS.join(", ")}. Необязательная восьмая — Уровень.`],
      assignments: [],
    };
  }

  const errors: string[] = [];
  const rows: SheetRow[] = [];
  for (let index = 1; index < grid.length; index += 1) {
    const cells = ASSIGNMENT_IMPORT_COLUMNS.map((_, column) => (grid[index]?.[column] ?? "").trim());
    const levelCell = levelProvided ? (grid[index]?.[7] ?? "").trim() : "";
    if (cells.every((cell) => cell === "") && levelCell === "") continue;
    const level = levelCell === "" ? null : levelNumber(levelCell);
    if (levelProvided && levelCell !== "" && level == null) {
      errors.push(`Строка ${index + 1}: уровень — 1, 2, 3 или пусто`);
    }
    rows.push({
      row: index + 1,
      competencyId: cells[0] ?? "",
      name: cells[1] ?? "",
      learnText: cells[2] ?? "",
      verifyText: cells[3] ?? "",
      prompt: cells[4] ?? "",
      option: cells[5] ?? "",
      correct: cells[6] ?? "",
      levelProvided,
      level,
    });
  }
  if (rows.length === 0) return { errors: ["В файле нет строк"], assignments: [] };

  const groups = new Map<
    string,
    {
      competencyId: string;
      name: string;
      learnText: string;
      verifyText: string;
      levelProvided: boolean;
      level: number | null;
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
        levelProvided: row.levelProvided,
        level: row.level,
        questions: new Map(),
      });
    } else {
      if (row.learnText && row.learnText !== existing.learnText) {
        errors.push(`Строка ${row.row}: у задания «${existing.name}» другой текст «узнать»`);
      }
      if (row.verifyText && row.verifyText !== existing.verifyText) {
        errors.push(`Строка ${row.row}: у задания «${existing.name}» другой текст «проверить»`);
      }
      if (row.levelProvided && row.level !== existing.level) {
        errors.push(`Строка ${row.row}: у задания «${existing.name}» другой уровень`);
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
      levelProvided: group.levelProvided,
      level: group.level,
      questions,
    });
  }
  return { errors, assignments };
}

/** Строки первой страницы: заголовок и по одной строке на вариант. Пустой тест — одна строка без вопроса. */
export function assignmentSheetRows(assignments: ParsedAssignment[]): string[][] {
  const withLevel = assignments.some((item) => item.levelProvided);
  const header = withLevel ? [...ASSIGNMENT_IMPORT_COLUMNS, "Уровень"] : [...ASSIGNMENT_IMPORT_COLUMNS];
  const rows: string[][] = [header];
  for (const assignment of assignments) {
    const head = [assignment.competencyId, assignment.name, assignment.learnText, assignment.verifyText];
    const tail = withLevel ? [assignment.level == null ? "" : String(assignment.level)] : [];
    if (assignment.questions.length === 0) {
      rows.push([...head, "", "", "", ...tail]);
      continue;
    }
    for (const question of assignment.questions) {
      for (const option of question.options) {
        rows.push([...head, question.prompt, option.text, option.correct ? "да" : "нет", ...tail]);
      }
    }
  }
  return rows;
}

/** Тот же состав, что у книги: массив или объект с полем `assignments`. `correct` — boolean. */
export function parseAssignmentJson(text: string): { errors: string[]; assignments: ParsedAssignment[] } {
  let raw: unknown;
  try {
    raw = JSON.parse(text.replace(/^\uFEFF/, "")) as unknown;
  } catch {
    return { errors: ["Не разобрать JSON"], assignments: [] };
  }
  const list = Array.isArray(raw) ? raw : isRecord(raw) && Array.isArray(raw.assignments) ? raw.assignments : null;
  if (!list) return { errors: ["Нужен JSON-массив или объект с полем assignments"], assignments: [] };
  if (list.length === 0) return { errors: ["В файле нет заданий"], assignments: [] };
  const errors: string[] = [];
  const assignments: ParsedAssignment[] = [];
  list.forEach((item, index) => {
    const parsed = readJsonAssignment(item, index, errors);
    if (parsed) assignments.push(parsed);
  });
  if (errors.length > 0) return { errors, assignments: [] };
  return parseAssignmentSheet(assignmentSheetRows(assignments));
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

function readJsonAssignment(value: unknown, index: number, errors: string[]): ParsedAssignment | null {
  if (!isRecord(value)) {
    errors.push(`Задание ${index + 1}: нужен объект`);
    return null;
  }
  const competencyId = jsonText(value.competencyId, `Задание ${index + 1}: нужен competencyId`, errors);
  const name = jsonText(value.name, `Задание ${index + 1}: нужно название`, errors);
  const learnText = jsonText(value.learnText, `Задание ${index + 1}: нужен текст «узнать»`, errors);
  const verifyText = jsonText(value.verifyText, `Задание ${index + 1}: нужен текст «проверить»`, errors);
  const questionsRaw = value.questions ?? [];
  if (!Array.isArray(questionsRaw)) {
    errors.push(`Задание ${index + 1}: questions — массив`);
    return null;
  }
  const questions: ParsedAssignment["questions"] = [];
  for (let questionIndex = 0; questionIndex < questionsRaw.length; questionIndex += 1) {
    const question = questionsRaw[questionIndex];
    if (!isRecord(question)) {
      errors.push(`Задание ${index + 1}, вопрос ${questionIndex + 1}: нужен объект`);
      continue;
    }
    const prompt = jsonText(question.prompt, `Задание ${index + 1}, вопрос ${questionIndex + 1}: нужен текст`, errors);
    if (!Array.isArray(question.options)) {
      errors.push(`Задание ${index + 1}, вопрос ${questionIndex + 1}: options — массив`);
      continue;
    }
    const options: { text: string; correct: boolean }[] = [];
    for (let optionIndex = 0; optionIndex < question.options.length; optionIndex += 1) {
      const option = question.options[optionIndex];
      if (!isRecord(option)) {
        errors.push(`Вопрос «${prompt ?? questionIndex + 1}», вариант ${optionIndex + 1}: нужен объект`);
        continue;
      }
      if (typeof option.correct !== "boolean") {
        errors.push(`Вопрос «${prompt ?? questionIndex + 1}»: у варианта correct — true или false`);
      }
      const text = jsonText(option.text, `Вопрос «${prompt ?? questionIndex + 1}», вариант ${optionIndex + 1}: нужен текст`, errors);
      if (text && typeof option.correct === "boolean") options.push({ text, correct: option.correct });
    }
    if (prompt) questions.push({ prompt, options });
  }
  const levelProvided = Object.prototype.hasOwnProperty.call(value, "level");
  let level: number | null = null;
  if (levelProvided && value.level != null && value.level !== "") {
    if (value.level === 1 || value.level === 2 || value.level === 3) level = value.level;
    else errors.push(`Задание ${index + 1}: уровень — 1, 2, 3 или null`);
  }
  if (!competencyId || !name || !learnText || !verifyText || errors.length > 0) return null;
  return { competencyId, name, learnText, verifyText, levelProvided, level, questions };
}

function levelNumber(value: string): number | null {
  if (value === "1" || value === "2" || value === "3") return Number(value);
  return null;
}

function correctFlag(value: string): boolean | null {
  const flag = value.trim().toLowerCase();
  if (flag === "да" || flag === "1") return true;
  if (flag === "нет" || flag === "0") return false;
  return null;
}
