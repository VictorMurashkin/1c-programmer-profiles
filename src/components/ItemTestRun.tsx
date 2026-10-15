"use client";

import { useState } from "react";
import { submitItemTestAction } from "@/app/idp-actions";
import { ActionForm } from "@/components/ActionForm";

type Question = { id: string; prompt: string; options: { id: string; text: string }[] };

/** Один вопрос на экране: вариант — полоса, «Дальше» открывает следующий. */
export function ItemTestRun({ itemId, questions }: { itemId: number; questions: Question[] }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const question = questions[step];
  if (!question) return null;
  const last = step === questions.length - 1;

  return (
    <ActionForm
      action={submitItemTestAction}
      className="panel panel-pad space-y-3 text-sm"
      beforeSubmit={(formData) =>
        questions.every((item) => String(formData.get(`answer-${item.id}`) ?? "")) ? null : "Выберите вариант"
      }
    >
      <input type="hidden" name="itemId" value={itemId} />
      {questions
        .filter((item) => item.id !== question.id)
        .map((item) => (
          <input key={item.id} type="hidden" name={`answer-${item.id}`} value={answers[item.id] ?? ""} />
        ))}
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium">{question.prompt}</p>
        <p className="muted shrink-0">
          {step + 1} / {questions.length}
        </p>
      </div>
      <div key={question.id} className="space-y-2">
        {question.options.map((option) => (
          <label key={option.id} className="test-option">
            <input
              type="radio"
              name={`answer-${question.id}`}
              value={option.id}
              defaultChecked={answers[question.id] === option.id}
              onChange={() => setAnswers((prev) => ({ ...prev, [question.id]: option.id }))}
            />
            <span>{option.text}</span>
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {step > 0 ? (
          <button className="btn" type="button" onClick={() => setStep((current) => current - 1)}>
            Назад
          </button>
        ) : null}
        {last ? (
          <button className="btn-primary" type="submit">
            Сдать тест
          </button>
        ) : (
          <button
            className="btn-primary"
            type="button"
            onClick={(event) => {
              const form = event.currentTarget.closest("form");
              const chosen = form?.querySelector<HTMLInputElement>(`input[name="answer-${question.id}"]:checked`);
              if (!chosen) return;
              setAnswers((prev) => ({ ...prev, [question.id]: chosen.value }));
              setStep((current) => current + 1);
            }}
          >
            Дальше
          </button>
        )}
      </div>
    </ActionForm>
  );
}
