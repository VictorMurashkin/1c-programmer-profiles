"use client";

import { startTransition, useActionState, useEffect, useState, type ChangeEvent } from "react";
import { setIdpItemStatusAction } from "@/app/idp-actions";

const STATUS = [
  ["not_started", "не начат"],
  ["in_progress", "в работе"],
  ["done", "сделал"],
] as const;

export function IdpItemStatus({ itemId, status }: { itemId: number; status: string }) {
  const [current, setCurrent] = useState(status);
  const [state, submit] = useActionState(setIdpItemStatusAction, null);

  useEffect(() => {
    setCurrent(status);
  }, [status]);

  function onChange(event: ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value;
    setCurrent(next);
    const data = new FormData();
    data.set("itemId", String(itemId));
    data.set("status", next);
    startTransition(() => {
      submit(data);
    });
  }

  return (
    <>
      <select className="field" aria-label="Статус" value={current} onChange={onChange}>
        {STATUS.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      {state?.error ? (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      ) : null}
    </>
  );
}
