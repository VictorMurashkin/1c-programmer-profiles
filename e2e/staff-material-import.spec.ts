import { expect, test, type Page } from "@playwright/test";
import { MATERIAL_IMPORT_COLUMNS } from "../src/lib/material-workbook";
import { writeXlsxSheet } from "../src/lib/xlsx-sheet";
import { E2E_ADMIN, E2E_ADMIN_PASSWORD } from "./env";

test.describe.configure({ mode: "serial" });

const STAMP = Date.now();
const CMP = `e2emat${STAMP}`;
const CMP_NAME = `Материалы файла ${STAMP}`;
const TITLE = `Пособие ${STAMP}`;
const URL = `https://its.1c.ru/db/e2e/${STAMP}`;
const VIDEO = `Ролик ${STAMP}`;
const VIDEO_URL = `https://example.org/video/${STAMP}`;
const STAFF = { login: `e2e.mat.${STAMP}`, name: `Сотрудник материалов ${STAMP}`, password: "e2e-mat-password" };

function book(rows: string[][]) {
  return writeXlsxSheet([[...MATERIAL_IMPORT_COLUMNS], ...rows]);
}

async function login(page: Page, account: { login: string; password: string } = E2E_ADMIN) {
  await page.goto("/login");
  if (/\/me$/.test(page.url())) {
    await page.getByRole("button", { name: "Выйти" }).click();
    await page.goto("/login");
  }
  const bootstrap = page.locator("#bootstrap-admin");
  if (await bootstrap.isVisible()) {
    await bootstrap.getByLabel("Пароль из .env.local").fill(E2E_ADMIN_PASSWORD);
    await bootstrap.getByLabel("Логин").fill(E2E_ADMIN.login);
    await bootstrap.getByLabel("Имя").fill(E2E_ADMIN.name);
    await bootstrap.getByLabel("Должность").selectOption("team-lead");
    await bootstrap.getByLabel("Пароль учётки").fill(E2E_ADMIN.password);
    await bootstrap.getByRole("button", { name: "Создать первого админа" }).click();
    if (account.login !== E2E_ADMIN.login) {
      await page.getByRole("button", { name: "Выйти" }).click();
      await page.goto("/login");
    }
  }
  if (!/\/me$/.test(page.url())) {
    const form = page.locator('form:has(input[name="intent"][value="login"])');
    await form.getByLabel("Логин").fill(account.login);
    await form.getByLabel("Пароль", { exact: true }).fill(account.password);
    await form.getByRole("button", { name: "Войти" }).click();
  }
  await expect(page).toHaveURL(/\/me$/);
}

function uploadForm(page: Page) {
  return page.getByRole("form", { name: "Загрузка материалов" });
}

async function upload(page: Page, rows: string[][]) {
  await page.goto("/admin/competencies");
  await uploadForm(page).getByLabel("Файл Excel").setInputFiles({
    name: "materials.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: book(rows),
  });
  const done = page.waitForResponse(
    (response) => response.request().method() === "POST" && response.url().includes("/admin/competencies"),
  );
  await uploadForm(page).getByRole("button", { name: "Загрузить" }).click();
  await done;
}

test("файл добавляет ссылки на карточку компетенции", async ({ page }) => {
  await login(page);
  await page.goto("/admin/competencies/new");
  await page.getByLabel("Идентификатор").fill(CMP);
  await page.getByLabel("Название", { exact: true }).fill(CMP_NAME);
  await page.getByRole("button", { name: "Создать" }).click();
  await expect(page.getByRole("heading", { level: 1, name: CMP_NAME })).toBeVisible();

  await upload(page, [
    [CMP, "ИТС", TITLE, URL],
    [CMP, "видео", VIDEO, VIDEO_URL],
  ]);
  await expect(uploadForm(page).getByRole("status")).toContainText("Добавлено ссылок: 2.");

  await page.goto(`/admin/competencies/${CMP}`);
  const materials = page.getByRole("group", { name: `Материалы: ${CMP_NAME}` });
  const its = materials.getByRole("listitem").filter({ hasText: TITLE });
  await expect(its.getByRole("link", { name: TITLE })).toHaveAttribute("href", URL);
  await expect(its.getByText("ИТС", { exact: true })).toBeVisible();
  await expect(materials.getByRole("listitem").filter({ hasText: VIDEO }).getByText("Видео", { exact: true })).toBeVisible();
});

test("тот же адрес не дублируется, другое название обновляет ссылку", async ({ page }) => {
  await login(page);
  await upload(page, [
    [CMP, "ИТС", TITLE, URL],
    [CMP, "видео", VIDEO, VIDEO_URL],
  ]);
  await expect(uploadForm(page).getByRole("status")).toContainText("Уже были: 2.");

  const renamed = `Новое пособие ${STAMP}`;
  await upload(page, [[CMP, "Обучение", renamed, URL]]);
  await expect(uploadForm(page).getByRole("status")).toContainText("Обновлено: 1.");

  await page.goto(`/admin/competencies/${CMP}`);
  const materials = page.getByRole("group", { name: `Материалы: ${CMP_NAME}` });
  await expect(materials.getByRole("link", { name: renamed, exact: true })).toHaveAttribute("href", URL);
  await expect(materials.getByRole("link", { name: TITLE, exact: true })).toHaveCount(0);
  await expect(materials.getByRole("link")).toHaveCount(2);
  await expect(materials.getByRole("listitem").filter({ hasText: renamed }).getByText("Обучение", { exact: true })).toBeVisible();
});

test("ошибка в файле не записывает остальные строки", async ({ page }) => {
  await login(page);
  const fresh = `Не записано ${STAMP}`;
  await upload(page, [
    [CMP, "ИТС", fresh, `https://example.org/fresh/${STAMP}`],
    [CMP, "ИТС", "Битый адрес", "ftp://example.org/course"],
    [`no-such-${STAMP}`, "ИТС", "Чужая", "https://example.org/other"],
  ]);
  const alert = uploadForm(page).getByRole("alert");
  await expect(alert).toContainText("адрес — только http:// или https://");
  await expect(alert).toContainText("Неизвестная компетенция");
  await page.goto(`/admin/competencies/${CMP}`);
  await expect(page.getByRole("link", { name: fresh })).toHaveCount(0);
});

test("не админ не открывает загрузку материалов", async ({ page }) => {
  await login(page);
  await page.goto("/people");
  const person = page.locator("form", { has: page.getByRole("heading", { name: "Новый сотрудник" }) });
  await person.getByLabel("Логин").fill(STAFF.login);
  await person.getByLabel("Имя").fill(STAFF.name);
  await person.getByLabel("Пароль").fill(STAFF.password);
  await person.getByLabel(/^Должность/).selectOption("programmer");
  await person.getByRole("button", { name: "Создать" }).click();
  await expect(page.getByRole("link", { name: STAFF.name, exact: true })).toBeVisible();

  await login(page, STAFF);
  await page.goto("/admin/competencies");
  await expect(page).toHaveURL(/\/(login|me)$/);
  await expect(uploadForm(page)).toHaveCount(0);
});
