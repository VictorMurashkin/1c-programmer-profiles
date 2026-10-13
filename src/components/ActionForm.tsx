"use client";

import { useActionState, useCallback, useState } from "react";
import type { ActionResult } from "@/lib/action-result";

const DOT_DATE_RE = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/;

function toIsoDate(raw: string) {
  const value = raw.trim();
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const dotted = value.match(DOT_DATE_RE);
  if (!dotted) return null;
  return `${dotted[3]}-${dotted[2].padStart(2, "0")}-${dotted[1].padStart(2, "0")}`;
}

function prepareDates(form: HTMLFormElement) {
  const fields = form.querySelectorAll('input[type="date"]');
  for (const node of fields) {
    if (!(node instanceof HTMLInputElement)) continue;
    const iso = toIsoDate(node.value);
    if (node.value.trim() && iso == null) return "Срок: нужна дата ГГГГ-ММ-ДД";
    if (iso && node.min && iso < node.min) return "Срок должен быть внутри допустимого периода";
    if (iso && node.max && iso > node.max) return "Срок должен быть внутри допустимого периода";
    if (iso) node.value = iso;
  }
  return null;
}

/** `{имяПоля}` в шаблоне заменяется значением этого поля. Пустое поле — переход не делаем. */
function successLocation(template: string, formData: FormData) {
  let missing = false;
  const href = template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const value = String(formData.get(key) ?? "").trim();
    if (!value) missing = true;
    return encodeURIComponent(value);
  });
  return missing ? null : href;
}

function FormBody({
  className,
  error,
  pending,
  children,
}: {
  className?: string;
  error: string | null;
  pending: boolean;
  children: React.ReactNode;
}) {
  return (
    <>
      <fieldset disabled={pending} className={`form-fields col-span-full w-full ${className ?? ""}`}>
        {children}
      </fieldset>
      {error ? (
        <p className="form-error md:col-span-2" role="alert">
          {error}
        </p>
      ) : null}
      {pending ? (
        <p className="muted text-sm md:col-span-2" aria-live="polite">
          Сохраняем…
        </p>
      ) : null}
    </>
  );
}

export function ActionForm({
  action,
  children,
  className,
  beforeSubmit,
  successPath,
}: {
  action: (state: ActionResult, formData: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  className?: string;
  beforeSubmit?: (formData: FormData) => string | null;
  /** Куда перейти после успешного сохранения. `redirect()` из действия с `useActionState` вызывать нельзя. */
  successPath?: string;
}) {
  const runAndLeave = useCallback(
    async (prev: ActionResult, formData: FormData) => {
      const result = await action(prev, formData);
      if (!result?.error && successPath) {
        const fromAction = result && "href" in result ? result.href : "";
        const href = fromAction || successLocation(successPath, formData);
        // Переход здесь, а не в эффекте: после удаления страница уже 404 и форма размонтирована.
        if (href) window.location.assign(href);
      }
      return result;
    },
    [action, successPath],
  );
  // Без successPath действие сервера передаётся как раньше. Новая обёртка на каждый рендер
  // сбрасывает pending, и тест не ждёт «Сохраняем…».
  const [state, formAction, pending] = useActionState(successPath ? runAndLeave : action, null);
  const [localError, setLocalError] = useState<string | null>(null);
  const error = localError ?? state?.error ?? null;

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    setLocalError(null);
    const form = event.currentTarget;
    const custom = beforeSubmit?.(new FormData(form));
    if (custom) {
      event.preventDefault();
      setLocalError(custom);
      return;
    }
    const dateError = prepareDates(form);
    if (dateError) {
      event.preventDefault();
      setLocalError(dateError);
    }
  }

  return (
    <form action={formAction} className={className} noValidate onSubmit={onSubmit}>
      <FormBody className={className} error={error} pending={pending}>
        {children}
      </FormBody>
    </form>
  );
}
