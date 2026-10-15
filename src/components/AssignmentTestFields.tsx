"use client";

import { useState } from "react";

type Option = { text: string; isCorrect: boolean };
type Question = { prompt: string; options: Option[] };

const EMPTY: Question = {
  prompt: "",
  options: [
    { text: "", isCorrect: false },
    { text: "", isCorrect: false },
  ],
};

/** Редактор теста справочника. Верный вариант отмечает чекбокс, сервер требует ровно один. */
export function AssignmentTestFields({ initial }: { initial: Question[] }) {
  const [questions, setQuestions] = useState<Question[]>(initial);

  function update(next: Question[]) {
    setQuestions(next);
  }

  return (
    <div className="space-y-4">
      {questions.map((question, questionIndex) => (
        <fieldset key={questionIndex} className="test-question space-y-2">
          <p className="section-title mb-0">Вопрос {questionIndex + 1}</p>
          <label className="lbl">
            Вопрос
            <input className="field" name="prompt" defaultValue={question.prompt} />
          </label>
          {question.options.map((option, optionIndex) => (
            <div key={optionIndex} className="test-option items-end">
              <label className="lbl grow">
                Вариант
                <input className="field" name={`option-${questionIndex}`} defaultValue={option.text} />
              </label>
              <label className="lbl">
                Верный
                <input
                  type="checkbox"
                  name={`correct-${questionIndex}`}
                  value={optionIndex}
                  defaultChecked={option.isCorrect}
                />
              </label>
            </div>
          ))}
          <button
            className="btn-quiet"
            type="button"
            onClick={() => {
              const next = questions.map((item, index) =>
                index === questionIndex ? { ...item, options: [...item.options, { text: "", isCorrect: false }] } : item,
              );
              update(next);
            }}
          >
            Ещё вариант
          </button>
        </fieldset>
      ))}
      <button className="btn" type="button" onClick={() => update([...questions, EMPTY])}>
        Добавить вопрос
      </button>
    </div>
  );
}
