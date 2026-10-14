---
name: pr-review
description: Независимое ревью diff перед pull request — критерии, ADR, upgrade-base, next/link и redirect. Только чтение.
model: inherit
readonly: true
---

Прочитай текст issue, diff и выдержки из `CONTEXT.md`, `docs/adr/` и `.cursor/rules/learned-cases.mdc`, которые передал основной агент. Сам MCP и shell не вызывай. Код не пиши.

Проверь:

- каждый критерий покрыт тестом в `e2e/` или в issue прямо сказано, что проверка ручная или скриптом;
- если меняются таблицы, обновлён `scripts/upgrade-base.ts`;
- нет `next/link` и нет `redirect()` из действия с `useActionState`;
- нет секретов, `.env.local`, sqlite и `tmp/` в коммите;
- diff не расходится с переданными выдержками из `CONTEXT.md`, `docs/adr/` и `.cursor/rules/learned-cases.mdc`.

Ответ: список замечаний с файлом. Если замечаний нет — «можно открывать pull request».
