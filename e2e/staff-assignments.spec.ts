import { expect, test, type Page } from "@playwright/test";
import { E2E_ADMIN, E2E_ADMIN_PASSWORD } from "./env";

test.describe.configure({ mode: "serial" });

const STAMP = Date.now();
const NAME = `E2E задание ${STAMP}`;
const LEARN = `Узнать ${STAMP}`;
const VERIFY = `Проверить ${STAMP}`;
const PLAIN = { login: `e2e.no-reports.${STAMP}`, name: `Без подчинённых ${STAMP}`, password: "e2e-plain-password" };
let cardPath = "";

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  try {
    await page.goto("/login");
    const form = page.locator("#bootstrap-admin");
    if ((await form.count()) === 0) return;
    await form.getByLabel("Пароль из .env.local").fill(E2E_ADMIN_PASSWORD);
    await form.getByLabel("Логин").fill(E2E_ADMIN.login);
    await form.getByLabel("Имя").fill(E2E_ADMIN.name);
    await form.getByLabel("Должность").selectOption("team-lead");
    await form.getByLabel("Пароль учётки").fill(E2E_ADMIN.password);
    await form.getByRole("button", { name: "Создать первого админа" }).click();
    await expect(page).toHaveURL(/\/me$/);
  } finally {
    await page.close();
  }
});

async function login(page: Page, account: { login: string; password: string }) {
  await page.goto("/login");
  const form = page.locator('form:has(input[name="intent"][value="login"])');
  await form.getByLabel("Логин").fill(account.login);
  await form.getByLabel("Пароль", { exact: true }).fill(account.password);
  await form.getByRole("button", { name: "Войти" }).click();
  await expect(page).toHaveURL(/\/me$/);
}

async function fillCreate(page: Page, name: string, learn: string, verify: string) {
  const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Создать" }) });
  await form.getByLabel(/^Компетенция/).selectOption({ index: 0 });
  await form.getByLabel(/^Название/).fill(name);
  await form.getByLabel(/^Узнать/).fill(learn);
  await form.getByLabel(/^Проверить/).fill(verify);
  return form;
}

test("создание открывает карточку, и ссылка есть в списке", async ({ page }) => {
  await login(page, E2E_ADMIN);
  await page.goto("/assignments");
  await page.getByRole("link", { name: "Новое задание" }).click();
  await expect(page).toHaveURL(/\/assignments\/new$/);
  const form = await fillCreate(page, NAME, LEARN, VERIFY);
  const competencyId = await form.getByLabel(/^Компетенция/).inputValue();
  await form.getByRole("button", { name: "Создать" }).click();
  await expect(page).toHaveURL(/\/assignments\/asg/);
  await expect(page.getByRole("heading", { level: 1, name: NAME })).toBeVisible();
  cardPath = page.url();
  await page.getByRole("link", { name: "← Все задания" }).click();
  await expect(page.getByRole("link", { name: NAME, exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Новое задание" }).click();
  const second = page.locator("form").filter({ has: page.getByRole("button", { name: "Создать" }) });
  const otherId = await second.getByLabel(/^Компетенция/).evaluate((select, current) => {
    if (!(select instanceof HTMLSelectElement)) return "";
    return [...select.options].map((option) => option.value).find((value) => value !== current) ?? "";
  }, competencyId);
  if (!otherId) throw new Error("нет второй компетенции");
  await second.getByLabel(/^Компетенция/).selectOption(otherId);
  const otherAssignment = `E2E фильтр ${STAMP}`;
  await second.getByLabel(/^Название/).fill(otherAssignment);
  await second.getByLabel(/^Узнать/).fill(LEARN);
  await second.getByLabel(/^Проверить/).fill(VERIFY);
  await second.getByRole("button", { name: "Создать" }).click();
  await expect(page).toHaveURL(/\/assignments\/asg/);
  await page.getByRole("link", { name: "← Все задания" }).click();

  const filter = page.getByLabel("Фильтр компетенции");
  await filter.selectOption(otherId);
  await page.getByRole("button", { name: "Показать" }).click();
  await expect(page.getByRole("link", { name: NAME, exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: otherAssignment, exact: true })).toBeVisible();
  await filter.selectOption(competencyId);
  await page.getByRole("button", { name: "Показать" }).click();
  await expect(page.getByRole("link", { name: NAME, exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: otherAssignment, exact: true })).toHaveCount(0);
  await filter.selectOption("");
  await page.getByRole("button", { name: "Показать" }).click();
  await expect(page.getByRole("link", { name: NAME, exact: true })).toBeVisible();
});

test("правка названия, узнать и проверить сохраняется, компетенция та же", async ({ page }) => {
  await login(page, E2E_ADMIN);
  await page.goto(cardPath);
  const competency = await page.locator("p").filter({ hasText: "Компетенция" }).locator("span.block").innerText();
  const nextName = `${NAME} правка`;
  const nextLearn = `${LEARN} правка`;
  const nextVerify = `${VERIFY} правка`;
  await page.getByLabel(/^Название/).fill(nextName);
  await page.getByLabel(/^Узнать/).fill(nextLearn);
  await page.getByLabel(/^Проверить/).fill(nextVerify);
  await Promise.all([
    page.waitForResponse((response) => response.request().method() === "POST"),
    page.getByRole("button", { name: "Сохранить" }).click(),
  ]);
  await page.reload();
  await expect(page.getByLabel(/^Название/)).toHaveValue(nextName);
  await expect(page.getByLabel(/^Узнать/)).toHaveValue(nextLearn);
  await expect(page.getByLabel(/^Проверить/)).toHaveValue(nextVerify);
  await expect(page.locator("p").filter({ hasText: "Компетенция" })).toContainText(competency);
  await expect(page.getByLabel(/^Компетенция/)).toHaveCount(0);
});

test("скрытие убирает форму правки, возврат её возвращает", async ({ page }) => {
  await login(page, E2E_ADMIN);
  await page.goto(cardPath);
  const edited = `${NAME} правка`;
  await Promise.all([
    page.waitForResponse((response) => response.request().method() === "POST"),
    page.getByRole("button", { name: "Перенести в архив" }).click(),
  ]);
  await page.reload();
  await expect(page.getByLabel(/^Название/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Вернуть" })).toBeVisible();
  await page.goto("/assignments");
  const row = page.locator("li").filter({ has: page.getByRole("link", { name: edited, exact: true }) });
  await expect(row).toContainText("скрыто");
  await page.getByRole("link", { name: edited, exact: true }).click();
  await expect(page.getByRole("button", { name: "Вернуть" })).toBeVisible();
  await Promise.all([
    page.waitForResponse(
      (response) => response.request().method() === "POST" && response.url().includes("/assignments/"),
    ),
    page.getByRole("button", { name: "Вернуть" }).click(),
  ]);
  await expect(page.getByLabel(/^Название/)).toBeVisible();
});

test("сотрудник без подчинённых уходит на ИПР и задание не меняется", async ({ page }) => {
  await login(page, E2E_ADMIN);
  await page.goto("/people");
  const create = page.locator("form").filter({ has: page.getByRole("heading", { name: "Новый сотрудник" }) });
  await create.getByLabel("Логин").fill(PLAIN.login);
  await create.getByLabel("Имя").fill(PLAIN.name);
  await create.getByLabel("Пароль").fill(PLAIN.password);
  await create.getByLabel(/^Админ/).selectOption("");
  await create.getByRole("button", { name: "Создать" }).click();
  await page.goto(cardPath);
  const name = await page.getByLabel(/^Название/).inputValue();
  const learn = await page.getByLabel(/^Узнать/).inputValue();
  await page.getByRole("button", { name: "Выйти" }).click();
  await login(page, PLAIN);
  await page.goto("/assignments");
  await expect(page).toHaveURL(/\/idps$/);
  await page.goto("/assignments/new");
  await expect(page).toHaveURL(/\/idps$/);
  await page.goto(cardPath);
  await expect(page).toHaveURL(/\/idps$/);
  await page.getByRole("button", { name: "Выйти" }).click();
  await login(page, E2E_ADMIN);
  await page.goto(cardPath);
  await expect(page.getByLabel(/^Название/)).toHaveValue(name);
  await expect(page.getByLabel(/^Узнать/)).toHaveValue(learn);
});

test("пустые название, узнать или проверить не пишут строку", async ({ page }) => {
  await login(page, E2E_ADMIN);
  await page.goto("/assignments/new");
  const missing = `E2E пустое ${STAMP}`;
  const form = await fillCreate(page, missing, "", VERIFY);
  await form.getByRole("button", { name: "Создать" }).click();
  await expect(form.getByRole("alert")).toHaveText("Нужны название, узнать и проверить");
  await page.goto("/assignments");
  await expect(page.getByRole("link", { name: missing, exact: true })).toHaveCount(0);
});

test("то же название без учёта регистра не создаёт вторую строку", async ({ page }) => {
  await login(page, E2E_ADMIN);
  await page.goto("/assignments/new");
  const lower = `${NAME} правка`.toLowerCase();
  const form = await fillCreate(page, lower, LEARN, VERIFY);
  await form.getByRole("button", { name: "Создать" }).click();
  await expect(form.getByRole("alert")).toHaveText("Такое задание уже есть в справочнике этой компетенции");
  await page.goto("/assignments");
  await expect(page.getByRole("link", { name: lower, exact: true })).toHaveCount(0);
});

test("чужой идентификатор — 404", async ({ page }) => {
  await login(page, E2E_ADMIN);
  const response = await page.goto("/assignments/no-such-assignment");
  expect(response?.status()).toBe(404);
  const broken = await page.goto("/assignments/%25");
  expect(broken?.status()).toBe(404);
});
