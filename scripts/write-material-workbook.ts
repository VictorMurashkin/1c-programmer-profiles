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

function sameFile(left: string, right: string) {
  const samePath = process.platform === "win32" ? left.toLowerCase() === right.toLowerCase() : left === right;
  if (samePath) return true;
  try {
    const leftStat = fs.statSync(left, { bigint: true });
    const rightStat = fs.statSync(right, { bigint: true });
    return leftStat.dev === rightStat.dev && leftStat.ino === rightStat.ino;
  } catch {
    return false;
  }
}

function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] === "--help") fail(usage);
  const [input, output] = args;
  if (!input || !output) fail(usage);
  const source = path.resolve(input);
  const target = path.resolve(output);
  if (sameFile(source, target)) fail("Входной и выходной файл — один путь. Укажите другой файл книги.");
  const parsed = parseMaterialJson(fs.readFileSync(source, "utf8"));
  if (parsed.errors.length > 0) fail(parsed.errors.join("\n"));
  const rows = materialSheetRows(parsed.materials);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, writeXlsxSheet(rows));
  console.log(`Записано материалов: ${parsed.materials.length}. ${target}`);
}

main();
