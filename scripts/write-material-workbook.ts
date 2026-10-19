/**
 * Книга для загрузки материалов на /admin/competencies.
 * Описание: docs/material-import.md.
 * Файл книги в git не класть.
 */
import fs from "node:fs";
import path from "node:path";
import type { CompetencyLinkKind } from "../src/db/schema";
import { materialSheetRows, parseMaterialSheet, type ParsedMaterial } from "../src/lib/material-workbook";
import { writeXlsxSheet } from "../src/lib/xlsx-sheet";

const usage = `npm run materials:xlsx -- <материалы.json> <книга.xlsx>`;
const KINDS = new Set<CompetencyLinkKind>(["its", "training", "video"]);

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readText(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") fail(label);
  return value.trim();
}

function readJson(file: string): unknown {
  const text = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  try {
    return JSON.parse(text) as unknown;
  } catch {
    fail(`Не разобрать JSON: ${file}`);
  }
}

function readMaterial(value: unknown, index: number): ParsedMaterial {
  if (!isRecord(value)) fail(`Материал ${index + 1}: нужен объект`);
  const kind = value.kind;
  if (typeof kind !== "string" || !KINDS.has(kind as CompetencyLinkKind)) {
    fail(`Материал ${index + 1}: kind — its, training или video`);
  }
  return {
    competencyId: readText(value.competencyId, `Материал ${index + 1}: нужен competencyId`),
    kind: kind as CompetencyLinkKind,
    title: readText(value.title, `Материал ${index + 1}: нужно название`),
    url: readText(value.url, `Материал ${index + 1}: нужен адрес`),
  };
}

function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] === "--help") fail(usage);
  const [input, output] = args;
  if (!input || !output) fail(usage);
  const raw = readJson(path.resolve(input));
  const list = Array.isArray(raw) ? raw : isRecord(raw) && Array.isArray(raw.materials) ? raw.materials : null;
  if (!list) fail("Нужен JSON-массив или объект с полем materials");
  if (list.length === 0) fail("В файле нет материалов");
  const materials = list.map((item, index) => readMaterial(item, index));
  const rows = materialSheetRows(materials);
  const parsed = parseMaterialSheet(rows);
  if (parsed.errors.length > 0) fail(parsed.errors.join("\n"));
  const target = path.resolve(output);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, writeXlsxSheet(rows));
  console.log(`Записано материалов: ${parsed.materials.length}. ${target}`);
}

main();
