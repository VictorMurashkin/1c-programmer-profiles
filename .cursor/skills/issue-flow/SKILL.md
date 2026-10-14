---
name: issue-flow
description: Ведёт доработку этого репозитория по GitHub issue — ветка от main, код, e2e-тесты, проверки, коммит, push и pull request, затем стоп. Use when the user gives an issue number or link, says «сделай issue», «возьми issue», «проверь реализацию issue» или просит разобрать замечания к pull request.
---

# Доработка по issue

Порядок действий — `AGENTS.md` в корне, процесс и проверки — `docs/workflow.md`. Этот skill только добавляет то, что относится к Cursor.

## GitHub в Cursor

Через MCP `user-GitKraken`: provider `github`, организация `firstBitSportivnaya`, репозиторий `1c-programmer-profiles`. Перед первым вызовом инструмента — `GetDynamicTools` для него. `gh` не вызывать.

| Шаг `AGENTS.md` | Инструмент |
|---|---|
| Прочитать issue | `issues_get_detail` |
| Создать pull request | `pull_request_create` |
| Статус и замечания ревью | `pull_request_get_detail`, `pull_request_get_comments` |
| Комментарий в issue | `issues_add_comment` |

Коммит, push и ветки — `git` в shell.

## Карта приёмки

Перед кодом выписать по каждому критерию: формулировка, файл теста в `e2e/` или «проверено вручную», негативный случай. Эту же карту перенести в таблицу pull request.

## Сбой GitHub

Если `issues_create` или `pull_request_create` вернули ошибку, список `issues_assigned_to_me` не использовать: он неполный.

1. Перед вызовом запомнить наибольший номер, который уже встречался. Нумерация issue и pull request общая.
2. После ошибки — `issues_get_detail` по номерам выше него по очереди, пока не найдётся объект с тем же заголовком или не вернётся «не найдено». Для pull request сверить ветку через `pull_request_get_detail`.
3. Нашли — не повторять. Не нашли — один повтор.

## Субагенты

`spec-check` и `pr-review` сами MCP и shell не вызывают. Основной агент передаёт `spec-check` текст issue, а `pr-review` — текст issue и вывод `git diff origin/main...HEAD`.

## После pull request

По просьбе человека подписаться на CI через `subscribe_github_ci`. Если проверка упала — сводка субагента `ci-investigator`, без новой правки, пока человек не попросит.

## Ответ на ревью

Комментарии читать через `pull_request_get_comments`. Каждый — исправить или ответить отказом со ссылкой на ADR или правило.

## Вопросы человеку

Через `AskQuestion`, только в случаях из шага 1 `AGENTS.md`.

## Проверка чужой реализации

Если просят проверить готовый pull request или ветку: прочитать issue и diff (`git fetch`, `git diff origin/main...<ветка>`). Сопоставить каждый критерий приёмки с тестом в `e2e/`, прогнать проверки из шага 5 `AGENTS.md` без правок кода. Отчёт — по критериям: покрыт тестом и проходит / не покрыт / падает, с выводом команды.
