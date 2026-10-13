import { expect, test, type Page } from "@playwright/test";

async function openProfile(page: Page, jobId: string) {
  await page.goto(`/jobs/${jobId}/profile`);
  await page.getByRole("button", { name: "Развернуть все" }).click();
}

function skillCard(page: Page, name: string) {
  return page
    .locator("summary")
    .filter({ has: page.getByText(name, { exact: true }) })
    .locator("xpath=ancestor::details[1]");
}

test("программист: хранилище не во владении средствами, есть дерево запросов и консоль СКД", async ({ page }) => {
  await openProfile(page, "programmer");

  const tools = skillCard(page, "Владение средствами разработки и администрирования Платформы 1С 8.3");
  await expect(tools).toBeVisible();
  await expect(tools).not.toContainText(/хранилищ/i);
  await expect(tools).not.toContainText(/\bGit\b/);

  const queries = skillCard(page, "Производительность запросов и дерево запросов");
  await expect(queries).toContainText("Читает дерево запросов");

  const skd = skillCard(page, "Печатные формы и отчёты на СКД");
  await expect(skd).toContainText("консоли запросов СКД");

  const devops = skillCard(page, "DevOps");
  await expect(devops).toContainText("SonarQube / статический анализ кода");
});

test("слитые компетенции не показываются, старые формулировки тоже", async ({ page }) => {
  await openProfile(page, "lead");
  await expect(page.getByText("Работа с брокерами сообщений", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Управление выпусками и конфигурациями", { exact: true })).toHaveCount(0);
  await expect(page.getByText("1С:Элемент")).toHaveCount(0);
  await expect(page.getByText("неограниченной глубиной")).toHaveCount(0);
  await expect(page.getByText("Интеграционные платформы, ESB и брокеры сообщений")).toBeVisible();

  await openProfile(page, "programmer");
  await expect(page.getByText("Работа с хранилищем конфигурации", { exact: true })).toHaveCount(0);
  await expect(page.getByText("неограниченной глубиной")).toHaveCount(0);
  await expect(page.getByText("Ведёт ветки и слияния")).toHaveCount(0);
});

test("соседние грейды различаются, у младшего средства разработки базового уровня", async ({ page }) => {
  await openProfile(page, "junior");
  const juniorTools = skillCard(page, "Владение средствами разработки и администрирования Платформы 1С 8.3");
  await expect(juniorTools).toContainText("Уровень 1: базовый");
  await expect(juniorTools).toContainText("Сам разворачивает базу");
  const juniorText = await juniorTools.locator(".skill-criteria").innerText();

  await openProfile(page, "programmer");
  const programmerTools = skillCard(page, "Владение средствами разработки и администрирования Платформы 1С 8.3");
  const programmerText = await programmerTools.locator(".skill-criteria").innerText();
  expect(programmerText).not.toBe(juniorText);

  const seniorPage = page;
  await openProfile(seniorPage, "senior");
  const seniorCode = skillCard(page, "Навыки программирования на языке 1С");
  const seniorText = await seniorCode.locator(".skill-criteria").innerText();
  await openProfile(page, "lead");
  const leadCode = skillCard(page, "Навыки программирования на языке 1С");
  const leadText = await leadCode.locator(".skill-criteria").innerText();
  expect(leadText).not.toBe(seniorText);
  await expect(leadCode).toContainText("ревьюит переиспользуемый код команды");
});

test("у стажёра есть программирование на 1С и обучаемость базового уровня", async ({ page }) => {
  await openProfile(page, "intern");
  const code = skillCard(page, "Навыки программирования на языке 1С");
  await expect(code).toContainText("Уровень 1: базовый");
  await expect(code).toContainText("учебных задач");
  const learning = skillCard(page, "Обучаемость");
  await expect(learning).toContainText("Уровень 1: базовый");
  await expect(page.getByText("Эффективное взаимодействие в команде")).toBeVisible();
});
