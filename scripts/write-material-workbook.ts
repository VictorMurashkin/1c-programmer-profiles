/**
 * Книга для загрузки материалов на /admin/competencies.
 * Описание: docs/material-import.md.
 * Файл книги в git не класть.
 */
import fs from "node:fs";
import path from "node:path";
import { materialSheetRows, parseMaterialJson } from "../src/lib/material-workbook";
import { writeXlsxSheet } from "../src/lib/xlsx-sheet";

const usage = `npm run materials:xlsx -- <материалы.json> <книга.xlsx>`;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] === "--help") fail(usage);
  const [input, output] = args;
  if (!input || !output) fail(usage);
  const parsed = parseMaterialJson(fs.readFileSync(path.resolve(input), "utf8"));
  if (parsed.errors.length > 0) fail(parsed.errors.join("\n"));
  const rows = materialSheetRows(parsed.materials);
  const target = path.resolve(output);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, writeXlsxSheet(rows));
  console.log(`Записано материалов: ${parsed.materials.length}. ${target}`);
}

main();
