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
  const headers = row.locator("xpath=ancestor::table[1]").getByRole("columnheader");
  await expect(headers.nth(3)).toHaveText("Срок");
  await expect(headers.nth(4)).toHaveText("Статус");
  await expect(headers.nth(5)).toHaveText("Подтверждение");
  await expect(row.getByRole("button", { name: "Сохранить тексты" })).toBeHidden();
  await expect(row.getByLabel("Название")).toBeHidden();
  await row.getByText("Править", { exact: true }).click();
  await expect(row.getByRole("button", { name: "Сохранить тексты" })).toBeVisible();
  await expect(row.getByRole("button", { name: "Убрать из плана" })).toBeVisible();
  await expect(row.getByLabel("Название")).toBeVisible();
  await expect(row.getByLabel("Узнать")).toHaveValue("Как собрать");
  await expect(row.getByLabel("Проверить")).toHaveValue("Отчёт есть");
  await expect(row.locator("p").filter({ hasText: "Как собрать" })).toBeHidden();
  const due = row.getByLabel("Срок");
  await expect(due).toBeVisible();
  expect(await due.getAttribute("min")).toBeNull();
  expect(await due.getAttribute("max")).toBeNull();
});

test("новое название остаётся в ячейке после перезагрузки", async ({ page }) => {
  await login(page);
  await page.goto(idpPath);
  const row = page.getByRole("row", { name: new RegExp(GOAL) });
  await row.getByText("Править", { exact: true }).click();
  const editing = page.getByRole("row").filter({ has: page.getByRole("button", { name: "Сохранить тексты" }) });
  await editing.getByLabel("Название").fill("Собрать сводку");
  const posted = page.waitForResponse((response) => response.request().method() === "POST");
  await editing.getByRole("button", { name: "Сохранить тексты" }).click();
  await posted;
  await page.reload();
  const again = page.getByRole("row", { name: /Собрать сводку/ });
  await expect(again.getByText("Собрать сводку", { exact: true })).toBeVisible();
  await expect(again.getByLabel("Название")).toBeHidden();
  await again.getByText("Править", { exact: true }).click();
  const restore = page.getByRole("row").filter({ has: page.getByRole("button", { name: "Сохранить тексты" }) });
  await restore.getByLabel("Название").fill(GOAL);
  const restored = page.waitForResponse((response) => response.request().method() === "POST");
  await restore.getByRole("button", { name: "Сохранить тексты" }).click();
  await restored;
  await page.reload();
  await expect(page.getByRole("row", { name: new RegExp(GOAL) }).getByText(GOAL, { exact: true })).toBeVisible();
});

test("пустое название не записывается, прежний текст остаётся", async ({ page }) => {
  await login(page);
  await page.goto(idpPath);
  const row = page.getByRole("row", { name: new RegExp(GOAL) });
  await row.getByText("Править", { exact: true }).click();
  const editing = page.getByRole("row").filter({ has: page.getByRole("button", { name: "Сохранить тексты" }) });
  await editing.getByLabel("Название").fill("");
  await editing.getByRole("button", { name: "Сохранить тексты" }).click();
  await expect(editing.getByRole("alert")).toContainText("Нужны название, узнать и проверить");
  await expect(editing.getByLabel("Название")).toHaveValue(GOAL);
  await page.reload();
  const again = page.getByRole("row", { name: new RegExp(GOAL) });
  await expect(again.getByText(GOAL, { exact: true })).toBeVisible();
  await expect(again.getByLabel("Название")).toBeHidden();
});

test("срок вне периода не записывается", async ({ page }) => {
  await login(page);
  await page.goto(idpPath);
  const row = page.getByRole("row", { name: new RegExp(GOAL) });
  await row.getByText("Править", { exact: true }).click();
  const editing = page.getByRole("row").filter({ has: page.getByRole("button", { name: "Сохранить тексты" }) });
  await editing.getByLabel("Срок").fill("2026-01-01");
  await editing.getByRole("button", { name: "Сохранить тексты" }).click();
  await expect(editing.getByRole("alert")).toContainText("Срок задания должен быть внутри периода ИПР");
  await page.reload();
  const again = page.getByRole("row", { name: new RegExp(GOAL) });
  await expect(again.getByText("—", { exact: true })).toBeVisible();
  await expect(again.getByLabel("Срок")).toHaveValue("");
});

test("сотрудник меняет статус строки, после перезагрузки он в колонке после срока", async ({ page }) => {
  await login(page, STAFF);
  await page.goto(idpPath);
  const row = page.getByRole("row", { name: new RegExp(GOAL) });
  await expect(row.getByRole("checkbox", { name: "Править" })).toHaveCount(0);
  await expect(row.getByLabel("Название")).toHaveCount(0);
  await expect(row.getByRole("button", { name: "Ок" })).toHaveCount(0);
  const posted = page.waitForResponse((response) => response.request().method() === "POST");
  await row.getByLabel("Статус").selectOption("in_progress");
  await posted;
  await expect(row.getByLabel("Статус")).toHaveValue("in_progress");
  await page.reload();
  const again = page.getByRole("row", { name: new RegExp(GOAL) });
  await expect(again.getByLabel("Статус")).toHaveValue("in_progress");
  const cells = again.getByRole("cell");
  await expect(cells.nth(4)).toContainText("Статус");
  await expect(cells.nth(3)).not.toContainText("Статус");
});

test("подтверждение в своей колонке, без теста строка тоже подтверждается", async ({ page }) => {
  await login(page);
  await page.goto(idpPath);
  const row = page.getByRole("row", { name: new RegExp(GOAL) });
  const confirm = row.getByRole("button", { name: "Подтвердить" });
  const neighbor = page.getByRole("button", { name: "Обновить разрыв" });
  const confirmBox = await confirm.evaluate((node) => {
    const style = getComputedStyle(node);
    return { border: style.borderTopWidth, pad: style.paddingTop, color: style.color };
  });
  const neighborBox = await neighbor.evaluate((node) => {
    const style = getComputedStyle(node);
    return { border: style.borderTopWidth, pad: style.paddingTop, color: style.color };
  });
  expect(confirmBox.border).toBe(neighborBox.border);
  expect(confirmBox.pad).toBe(neighborBox.pad);
  expect(confirmBox.border).not.toBe("0px");
  expect(confirmBox.color).not.toBe(neighborBox.color);
  await confirm.click();
  const undo = row.getByRole("button", { name: "Снять подтверждение" });
  const undoBox = await undo.evaluate((node) => {
    const style = getComputedStyle(node);
    return { border: style.borderTopWidth, pad: style.paddingTop, color: style.color };
  });
  expect(undoBox.border).toBe(neighborBox.border);
  expect(undoBox.pad).toBe(neighborBox.pad);
  expect(undoBox.color).not.toBe(confirmBox.color);
  await expect(row.getByText("принято", { exact: true }).filter({ visible: true })).toHaveCount(1);

  await login(page, STAFF);
  await page.goto(idpPath);
  const own = page.getByRole("row", { name: new RegExp(GOAL) });
  await expect(own.getByText("принято", { exact: true }).filter({ visible: true })).toHaveCount(1);
  await expect(own.getByLabel("Статус")).toHaveCount(0);
  await expect(own.getByRole("button", { name: "Подтвердить" })).toHaveCount(0);
});

test("чужой сотрудник не видит приёмку и правку", async ({ page }) => {
  await login(page, OTHER);
  await page.goto(idpPath);
  await expect(page.getByRole("button", { name: "Подтвердить" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Снять подтверждение" })).toHaveCount(0);
  await expect(page.getByLabel("Статус")).toHaveCount(0);
  await expect(page.getByText("Править", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Сохранить тексты" })).toHaveCount(0);
});
