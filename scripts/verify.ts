/**
 * Один прогон проверок перед коммитом.
 * Порт 3000 не освобождает: если он занят, выходит до первой команды.
 * Упавшая команда останавливает следующие, таблица для pull request печатается всё равно.
 */
import { spawn } from "node:child_process";
import net from "node:net";

type Row = { command: string; result: string };

const STEPS: { command: string; args: string[] }[] = [
  { command: "npm", args: ["run", "check:seed"] },
  { command: "npx", args: ["tsc", "--noEmit"] },
  { command: "npm", args: ["run", "lint"] },
  { command: "npm", args: ["run", "test:e2e"] },
  { command: "npm", args: ["run", "build"] },
];

function label(step: { command: string; args: string[] }): string {
  return [step.command, ...step.args].join(" ");
}

/** Что-то уже слушает 127.0.0.1:3000. Соединение не удерживаем. */
function portBusy(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port });
    const done = (busy: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(busy);
    };
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
  });
}

function run(step: { command: string; args: string[] }): Promise<{ code: number; output: string }> {
  return new Promise((resolve) => {
    const child = spawn(step.command, step.args, {
      cwd: process.cwd(),
      env: process.env,
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      output += text;
      process.stdout.write(text);
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      output += text;
      process.stderr.write(text);
    });
    child.on("close", (code) => resolve({ code: code ?? 1, output }));
    child.on("error", (error) => resolve({ code: 1, output: output + error.message }));
  });
}

/** Число прошедших сценариев Playwright, если строка итога есть. */
function e2eSummary(output: string): string | null {
  const match = output.match(/(\d+)\s+passed(?:\s+\((\d+)\s+skipped\))?/);
  if (!match) return null;
  return match[2] ? `${match[1]} passed, ${match[2]} skipped` : `${match[1]} passed`;
}

function firstError(output: string): string {
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const failed = lines.find((line) => /error TS\d+|\bError:|\b[1-9]\d* failed\b|✖|Failed to compile/.test(line));
  const text = (failed ?? lines.at(-1) ?? "код выхода не 0").replace(/\|/g, "/");
  return text.length > 240 ? `${text.slice(0, 237)}...` : text;
}

function printTable(rows: Row[]) {
  console.log("\n| Команда | Результат |");
  console.log("|---|---|");
  for (const row of rows) console.log(`| \`${row.command}\` | ${row.result} |`);
}

async function main() {
  const rows: Row[] = STEPS.map((step) => ({ command: label(step), result: "не запускалась" }));
  if (await portBusy(3000)) {
    console.error("Порт 3000 занят. Остановите dev-сервер и запустите npm run verify снова. Сервер не остановлен.");
    printTable(rows);
    process.exit(1);
  }

  let failed = false;
  for (let i = 0; i < STEPS.length; i++) {
    if (failed) break;
    const step = STEPS[i];
    console.log(`\n> ${label(step)}\n`);
    const { code, output } = await run(step);
    if (code === 0) {
      rows[i].result = step.args.includes("test:e2e") ? (e2eSummary(output) ?? "ok") : "ok";
    } else {
      rows[i].result = firstError(output);
      failed = true;
    }
  }
  printTable(rows);
  process.exit(failed ? 1 : 0);
}

main();
