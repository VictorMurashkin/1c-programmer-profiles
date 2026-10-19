/**
 * Книга для загрузки заданий на /assignments.
 * Описание для агента: docs/assignment-import.md.
 * Файл книги в git не класть.
 */
import fs from "node:fs";
import path from "node:path";
import { assignmentSheetRows, parseAssignmentJson } from "../src/lib/assignment-workbook";
import { writeXlsxSheet } from "../src/lib/xlsx-sheet";

type Competency = { id: string; name: string; type: string };

const usage = `npm run assignments:xlsx -- --catalog
npm run assignments:xlsx -- <задания.json> <книга.xlsx>`;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function sameFile(left: string, right: string) {
  return process.platform === "win32" ? left.toLowerCase() === right.toLowerCase() : left === right;
}

function readJson(file: string): unknown {
  const text = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  try {
    return JSON.parse(text) as unknown;
  } catch {
    fail(`Не разобрать JSON: ${file}`);
  }
}

function printCatalog() {
  const seedPath = path.join(process.cwd(), "seed", "data.json");
  const seed = readJson(seedPath) as { competencies?: Competency[] };
  const rows = (seed.competencies ?? []).filter((item) => item.type !== "duty");
  for (const item of rows) console.log(`${item.id}\t${item.type}\t${item.name}`);
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === "--catalog") {
    printCatalog();
    return;
  }
  if (args.length !== 2 || args[0] === "--help") fail(usage);
  const [input, output] = args;
  if (!input || !output) fail(usage);
  const source = path.resolve(input);
  const target = path.resolve(output);
  if (sameFile(source, target)) fail("Входной и выходной файл — один путь. Укажите другой файл книги.");
  const parsed = parseAssignmentJson(fs.readFileSync(source, "utf8"));
  if (parsed.errors.length > 0) fail(parsed.errors.join("\n"));
  const rows = assignmentSheetRows(parsed.assignments);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, writeXlsxSheet(rows));
  const optionRows = rows.length - 1;
  console.log(`Записано заданий: ${parsed.assignments.length}. Строк вариантов: ${optionRows}. ${target}`);
}

main();
