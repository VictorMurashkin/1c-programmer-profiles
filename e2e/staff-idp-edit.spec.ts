import { expect, test, type Page } from "@playwright/test";
import { E2E_ADMIN, E2E_ADMIN_PASSWORD } from "./env";

test.describe.configure({ mode: "serial" });

const STAFF = { login: "e2e.idp.edit", name: "Правка ИПР E2E", password: "e2e-idp-edit-password" };
const OTHER = { login: "e2e.idp.other", name: "Чужой ИПР E2E", password: "e2e-idp-other-password" };
const GOAL = "Собрать отчёт";
let idpPath = "";

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
      await login(page, account);
      return;
    }
  } else {
    const form = page.locator('form:has(input[name="intent"][value="login"])');
    await form.getByLabel("Логин").fill(account.login);
    await form.getByLabel("Пароль", { exact: true }).fill(account.password);
    await form.getByRole("button", { name: "Войти" }).click();
  }
  await expect(page).toHaveURL(/\/me$/);
}

async function createEmployee(page: Page, account: { login: string; name: string; password: string }) {
  await page.goto("/people");
  const form = page.locator("form", { has: page.getByRole("heading", { name: "Новый сотрудник" }) });
  await form.getByLabel("Логин").fill(account.login);
  await form.getByLabel("Имя").fill(account.name);
  await form.getByLabel("Пароль").fill(account.password);
  await form.getByLabel(/^Должность/).selectOption("junior");
  await form.getByLabel(/^Руководитель/).selectOption({ label: E2E_ADMIN.name });
  await form.getByRole("button", { name: "Создать" }).click();
  await expect(page.getByRole("link", { name: account.name, exact: true })).toBeVisible();
}

test("форма правки строки закрыта, пока её не раскроют", async ({ page }) => {
  await login(page);
  await createEmployee(page, STAFF);
  await createEmployee(page, OTHER);

  await page.goto("/idps");
  await page.getByLabel(/^Сотрудник/).selectOption({ label: STAFF.name });
  await page.getByLabel(/^Цель/).selectOption("programmer");
  await page.getByLabel("Начало").fill("2026-03-01");
  await page.getByLabel("Конец").fill("2026-09-30");
  await page.getByRole("button", { name: "Создать" }).click();
  await page.locator("li", { hasText: STAFF.name }).getByRole("link", { name: "Младший программист → Программист" }).click();

  const add = page.locator("form", { has: page.getByRole("heading", { name: "Добавить задание" }) });
  await add.getByLabel(/^Компетенция/).selectOption({ index: 1 });
  await add.getByLabel("Название (если новое)").fill(GOAL);
  await add.getByLabel("Узнать").fill("Как собрать");
  await add.getByLabel("Проверить").fill("Отчёт есть");
  await add.getByRole("button", { name: "Добавить" }).click();

  idpPath = new URL(page.url()).pathname;
  const row = page.getByRole("row", { name: new RegExp(GOAL) });
  await expect(row.getByRole("button", { name: "Сохранить тексты" })).toBeHidden();
  await row.getByText("Править", { exact: true }).click();
  await expect(row.getByRole("button", { name: "Сохранить тексты" })).toBeVisible();
});

test("сотрудник меняет ход строки, после перезагрузки он на месте", async ({ page }) => {
  await login(page, STAFF);
  await page.goto(idpPath);
  const row = page.getByRole("row", { name: new RegExp(GOAL) });
  await row.getByLabel(/^Ход/).selectOption("in_progress");
  await row.getByRole("button", { name: "Ок" }).click();
  await expect(row.getByText("в работе", { exact: true }).filter({ visible: true })).toHaveCount(1);
  await page.reload();
  await expect(
    page.getByRole("row", { name: new RegExp(GOAL) }).getByText("в работе", { exact: true }).filter({ visible: true }),
  ).toHaveCount(1);
});

test("после приёмки сотрудник ход не меняет", async ({ page }) => {
  await login(page);
  await page.goto(idpPath);
  const row = page.getByRole("row", { name: new RegExp(GOAL) });
  await row.getByRole("button", { name: "Принять" }).click();
  await expect(row.getByText("принято", { exact: true }).filter({ visible: true })).toHaveCount(1);

  await login(page, STAFF);
  await page.goto(idpPath);
  const own = page.getByRole("row", { name: new RegExp(GOAL) });
  await expect(own.getByText("принято", { exact: true }).filter({ visible: true })).toHaveCount(1);
  await expect(own.getByLabel(/^Ход/)).toHaveCount(0);
  await expect(own.getByRole("button", { name: "Принять" })).toHaveCount(0);
});

test("чужой сотрудник не видит приёмку и правку", async ({ page }) => {
  await login(page, OTHER);
  await page.goto(idpPath);
  await expect(page.getByRole("button", { name: "Принять" })).toHaveCount(0);
  await expect(page.getByText("Править", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Сохранить тексты" })).toHaveCount(0);
});
