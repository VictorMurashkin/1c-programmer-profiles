import { expect, test, type Locator, type Page } from "@playwright/test";
import { E2E_ADMIN } from "./env";

// Файл идёт после session.spec.ts: админ там уже создан. Шаги делят одну базу.
test.describe.configure({ mode: "serial" });

const STAFF = { login: "e2e.plain", name: "Обычный E2E", password: "e2e-plain-password" };
let staffPath = "";

async function login(page: Page, account: { login: string; password: string }) {
  await page.goto("/login");
  const form = page.locator('form:has(input[name="intent"][value="login"])');
  await form.getByLabel("Логин").fill(account.login);
  await form.getByLabel("Пароль", { exact: true }).fill(account.password);
  await form.getByRole("button", { name: "Войти" }).click();
  await expect(page).toHaveURL(/\/me$/);
}

function editForm(page: Page) {
  return page.locator("form").filter({ has: page.getByRole("checkbox", { name: /^Админ/ }) });
}

async function boxMetrics(box: Locator) {
  return box.evaluate((el) => {
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return {
      width: rect.width,
      border: `${style.borderTopWidth} ${style.borderTopStyle} ${style.borderTopColor}`,
    };
  });
}

test("создание с отмеченным «Админ»: на карточке подпись сверху и ящик как у должности", async ({ page }) => {
  await login(page, E2E_ADMIN);
  await page.goto("/people");

  const create = page.locator("form").filter({ has: page.getByRole("heading", { name: "Новый сотрудник" }) });
  await create.getByLabel("Логин").fill(STAFF.login);
  await create.getByLabel("Имя").fill(STAFF.name);
  await create.getByLabel("Пароль").fill(STAFF.password);
  await create.getByRole("checkbox", { name: /^Админ/ }).check();
  await create.getByRole("button", { name: "Создать" }).click();
  await page.getByRole("link", { name: STAFF.name, exact: true }).click();
  staffPath = page.url();

  const edit = editForm(page);
  const checkbox = edit.getByRole("checkbox", { name: /^Админ/ });
  await expect(checkbox).toBeChecked();

  const label = edit.locator("label", { has: page.getByRole("checkbox", { name: /^Админ/ }) });
  const stacked = await label.evaluate((el) => {
    const box = el.querySelector(".field");
    const text = [...el.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim());
    if (!(box instanceof HTMLElement) || !text) return false;
    const range = document.createRange();
    range.selectNodeContents(text);
    const textRect = range.getBoundingClientRect();
    const boxRect = box.getBoundingClientRect();
    return boxRect.top >= textRect.bottom - 1;
  });
  expect(stacked).toBe(true);

  const adminBox = await boxMetrics(label.locator(".field"));
  const job = await boxMetrics(edit.locator("select[name='jobId']"));
  expect(adminBox.width).toBeCloseTo(job.width, 0);
  expect(adminBox.border).toBe(job.border);
});

test("снятие «Админ» у не единственного админа сохраняется", async ({ page }) => {
  await login(page, E2E_ADMIN);
  await page.goto(staffPath);
  const edit = editForm(page);
  await edit.getByRole("checkbox", { name: /^Админ/ }).uncheck();
  await Promise.all([
    page.waitForResponse((response) => response.request().method() === "POST"),
    edit.getByRole("button", { name: "Сохранить" }).click(),
  ]);
  await page.reload();
  await expect(editForm(page).getByRole("checkbox", { name: /^Админ/ })).not.toBeChecked();

  await page.goto("/people");
  const row = page.locator("li").filter({ has: page.getByRole("link", { name: STAFF.name, exact: true }) });
  await expect(row).not.toContainText("· админ");

  await page.getByRole("button", { name: "Выйти" }).click();
  await login(page, STAFF);
  await expect(page.getByRole("link", { name: "Компетенции", exact: true })).toHaveCount(0);
});

test("последнего админа снять нельзя", async ({ page }) => {
  await login(page, E2E_ADMIN);
  await page.goto("/people");
  await page.getByRole("link", { name: E2E_ADMIN.name, exact: true }).click();
  const edit = editForm(page);
  await edit.getByRole("checkbox", { name: /^Админ/ }).uncheck();
  await Promise.all([
    page.waitForResponse((response) => response.request().method() === "POST"),
    edit.getByRole("button", { name: "Сохранить" }).click(),
  ]);
  await expect(edit.getByRole("alert")).toHaveText("Нельзя убрать последнего админа");
  await page.reload();
  await expect(editForm(page).getByRole("checkbox", { name: /^Админ/ })).toBeChecked();
});

test("сотрудник без признака админа не видит поле «Админ»", async ({ page }) => {
  await login(page, STAFF);
  await page.goto(staffPath);
  await expect(page.getByRole("heading", { level: 1, name: STAFF.name })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /^Админ/ })).toHaveCount(0);
  await expect(page.getByText("Админ", { exact: true })).toHaveCount(0);
});
