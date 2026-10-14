import { expect, test, type Page } from "@playwright/test";
import { E2E_ADMIN, E2E_ADMIN_PASSWORD } from "./env";

test.describe.configure({ mode: "serial" });

const STAMP = Date.now();
const NAME = `Сдача ${STAMP}`;
const PROMPT = `Вопрос сдачи ${STAMP}`;
const RIGHT = `Верно ${STAMP}`;
const WRONG = `Неверно ${STAMP}`;
const STAFF = { login: `e2e.take.${STAMP}`, name: `Сдаёт ${STAMP}`, password: "e2e-take-password" };
const OTHER = { login: `e2e.take.other.${STAMP}`, name: `Чужой ${STAMP}`, password: "e2e-take-other-password" };
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

async function createPerson(page: Page, account: { login: string; name: string; password: string }) {
  await page.goto("/people");
  const form = page.locator("form", { has: page.getByRole("heading", { name: "Новый сотрудник" }) });
  await form.getByLabel("Логин").fill(account.login);
  await form.getByLabel("Имя").fill(account.name);
  await form.getByLabel("Пароль").fill(account.password);
  await form.getByLabel(/^Должность/).selectOption("junior");
  await form.getByRole("button", { name: "Создать" }).click();
  await expect(page.getByRole("link", { name: account.name, exact: true })).toBeVisible();
}

test("верный ответ показывает «сдан», строка не принята", async ({ page }) => {
  await login(page);
  await createPerson(page, STAFF);
  await createPerson(page, OTHER);
  await page.goto("/idps");
  await page.getByLabel(/^Сотрудник/).selectOption({ label: STAFF.name });
  await page.getByLabel(/^Цель/).selectOption("programmer");
  await page.getByLabel("Начало").fill("2026-03-01");
  await page.getByLabel("Конец").fill("2026-09-30");
  await page.getByRole("button", { name: "Создать" }).click();
  await page.locator("li", { hasText: STAFF.name }).getByRole("link", { name: "Младший программист → Программист" }).click();
  idpPath = new URL(page.url()).pathname;

  const add = page.locator("form", { has: page.getByRole("heading", { name: "Добавить задание" }) });
  const competencyLabel = await add.getByLabel(/^Компетенция/).locator("option").nth(0).innerText();
  const competency = competencyLabel.replace(/\s·\sур\.\s\d+$/, "");
  await page.goto("/assignments/new");
  const create = page.locator("form").filter({ has: page.getByRole("button", { name: "Создать" }) });
  await create.getByLabel(/^Компетенция/).selectOption({ label: competency });
  await create.getByLabel(/^Название/).fill(NAME);
  await create.getByLabel(/^Узнать/).fill("Узнать сдачу");
  await create.getByLabel(/^Проверить/).fill("Проверить сдачу");
  await create.getByRole("button", { name: "Создать" }).click();
  const testForm = page.locator("form", { has: page.getByRole("button", { name: "Сохранить тест" }) });
  await expect(async () => {
    await testForm.getByRole("button", { name: "Добавить вопрос" }).click();
    await expect(testForm.getByLabel("Вопрос")).toBeVisible({ timeout: 1000 });
  }).toPass();
  await testForm.getByLabel("Вопрос").fill(PROMPT);
  await testForm.getByLabel("Вариант").nth(0).fill(RIGHT);
  await testForm.getByLabel("Вариант").nth(1).fill(WRONG);
  await testForm.getByRole("checkbox", { name: /^Верный/ }).nth(0).check({ force: true });
  const saved = page.waitForResponse((response) => response.request().method() === "POST");
  await testForm.getByRole("button", { name: "Сохранить тест" }).click();
  await saved;

  await page.goto(idpPath);
  const addAgain = page.locator("form", { has: page.getByRole("heading", { name: "Добавить задание" }) });
  const catalog = addAgain.getByLabel(/^Из справочника/);
  await catalog.selectOption({ value: (await catalog.locator("option", { hasText: NAME }).getAttribute("value")) ?? "" });
  await addAgain.getByRole("button", { name: "Добавить" }).click();
  await addAgain.getByLabel(/^Компетенция/).selectOption({ label: competencyLabel });
  await addAgain.getByLabel("Название (если новое)").fill(`Держит план ${STAMP}`);
  await addAgain.getByLabel("Узнать").fill("Второе");
  await addAgain.getByLabel(/^Проверить/).fill("Второе");
  await addAgain.getByRole("button", { name: "Добавить" }).click();

  await login(page, STAFF);
  await page.goto(idpPath);
  const html = await page.content();
  expect(html).not.toContain("isCorrect");
  expect(html).not.toContain("is_correct");
  const row = page.getByRole("row", { name: new RegExp(NAME) });
  await row.getByRole("radio", { name: RIGHT, exact: true }).check();
  const posted = page.waitForResponse((response) => response.request().method() === "POST");
  await row.getByRole("button", { name: "Сдать тест" }).click();
  await posted;
  await expect(row.getByText("сдан", { exact: true })).toBeVisible();
  await expect(row.getByText("принято", { exact: true })).toHaveCount(0);
  await expect(row.getByText("Попыток: 1")).toBeVisible();
});

test("неверный ответ показывает «не сдан», сдать можно снова", async ({ page }) => {
  await login(page, STAFF);
  await page.goto(idpPath);
  const row = page.getByRole("row", { name: new RegExp(NAME) });
  await row.getByRole("radio", { name: WRONG, exact: true }).check();
  const posted = page.waitForResponse((response) => response.request().method() === "POST");
  await row.getByRole("button", { name: "Сдать тест" }).click();
  await posted;
  await expect(row.getByText("не сдан", { exact: true })).toBeVisible();
  await expect(row.getByText("Попыток: 2")).toBeVisible();
  await expect(row.getByRole("button", { name: "Сдать тест" })).toBeVisible();
});

test("после приёмки попытка не записывается", async ({ page }) => {
  await login(page);
  await page.goto(idpPath);
  const row = page.getByRole("row", { name: new RegExp(NAME) });
  await row.getByRole("button", { name: "Принять" }).click();
  await expect(row.getByText("принято", { exact: true }).filter({ visible: true })).toBeVisible();

  await login(page, STAFF);
  await page.goto(idpPath);
  const own = page.getByRole("row", { name: new RegExp(NAME) });
  await own.getByRole("radio", { name: RIGHT, exact: true }).check();
  await own.getByRole("button", { name: "Сдать тест" }).click();
  await expect(own.getByRole("alert")).toHaveText("После приёмки тест не сдаётся");
  await expect(own.getByText("Попыток: 2")).toBeVisible();
});

test("чужой сотрудник попытку не пишет", async ({ page }) => {
  await login(page, OTHER);
  await page.goto(idpPath);
  await expect(page.getByRole("button", { name: "Сдать тест" })).toHaveCount(0);

  await login(page, STAFF);
  await page.goto(idpPath);
  await expect(page.getByRole("row", { name: new RegExp(NAME) }).getByText("Попыток: 2")).toBeVisible();
});
