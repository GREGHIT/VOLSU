import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { http } from "../api/http";
import { getUser } from "../auth/token";
import ConfirmDialog from "../components/ConfirmDialog";
import ActionButton from "../components/ui/ActionButton";
import {
  QUESTION_TYPE_OPTIONS,
  TYPE_LABELS,
  cleanQuestionPayload,
  createQuestionForm,
  defaultConfigByType,
  emptyOption,
  hydrateQuestionForm,
  questionTone,
} from "../utils/testDesigner";
import { sanitizeDomText } from "../utils/textEncoding";

function Field({ label, children, hint = "" }) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-semibold text-slate-700 theme-readable-soft">{label}</span>
      {children}
      {hint ? <span className="text-xs text-slate-500 theme-readable-muted">{hint}</span> : null}
    </label>
  );
}

function inputClassName() {
  return "w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 theme-surface-button theme-readable-strong";
}

function clampNumber(value, min, max, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, num));
}

function questionToneClasses(type) {
  switch (questionTone(type)) {
    case "emerald":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "violet":
      return "border-violet-200 bg-violet-50 text-violet-700";
    case "amber":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-blue-200 bg-blue-50 text-blue-700";
  }
}

function patchList(items, index, patch) {
  return items.map((item, currentIndex) => (currentIndex === index ? { ...item, ...patch } : item));
}

function updateTableAnswers(config, rows, columns) {
  const nextAnswers = {};
  rows.forEach((row) => {
    nextAnswers[row.key] = {};
    columns.forEach((column) => {
      nextAnswers[row.key][column.key] = config?.answers?.[row.key]?.[column.key] || "";
    });
  });
  return nextAnswers;
}

function ConfigEditor({ question, onPatch }) {
  const config = question.config || defaultConfigByType(question.type);

  function patchConfig(patch) {
    onPatch({ config: { ...config, ...patch } });
  }

  function setPrompt(prompt) {
    patchConfig({ prompt });
  }

  function patchOption(optionIndex, patch) {
    onPatch({
      options: patchList(question.options, optionIndex, patch),
    });
  }

  function setSingleCorrect(index) {
    onPatch({
      options: question.options.map((option, currentIndex) => ({
        ...option,
        isCorrect: currentIndex === index,
      })),
    });
  }

  function toggleMultiCorrect(index) {
    onPatch({
      options: question.options.map((option, currentIndex) =>
        currentIndex === index ? { ...option, isCorrect: !option.isCorrect } : option
      ),
    });
  }

  if (question.type === "SINGLE" || question.type === "MULTI") {
    const isSingle = question.type === "SINGLE";
    return (
      <div className="space-y-4 rounded-[22px] border border-slate-200 bg-slate-50/80 p-4 theme-surface-inset">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-slate-900 theme-readable-strong">Варианты ответа</div>
            <div className="text-xs text-slate-500 theme-readable-muted">
              {isSingle
                ? "Отметьте ровно один правильный вариант."
                : "Можно отметить несколько правильных вариантов."}
            </div>
          </div>
          <ActionButton tone="secondary" className="px-3 py-2 text-xs" onClick={() => onPatch({ options: [...question.options, emptyOption()] })}>
            Добавить вариант
          </ActionButton>
        </div>
        <div className="grid gap-3">
          {question.options.map((option, optionIndex) => (
            <div key={`${question.id || "new"}-option-${optionIndex}`} className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
              <input
                className={inputClassName()}
                value={option.text}
                onChange={(event) => patchOption(optionIndex, { text: event.target.value })}
                placeholder={`Вариант ${optionIndex + 1}`}
              />
              <ActionButton
                tone={option.isCorrect ? "success" : "secondary"}
                className="min-w-[170px]"
                onClick={() => (isSingle ? setSingleCorrect(optionIndex) : toggleMultiCorrect(optionIndex))}
              >
                {option.isCorrect ? "Правильный ответ" : "Сделать правильным"}
              </ActionButton>
              <ActionButton
                tone="danger"
                className="min-w-[120px]"
                onClick={() =>
                  onPatch({
                    options:
                      question.options.length > 2
                        ? question.options.filter((_, currentIndex) => currentIndex !== optionIndex)
                        : [emptyOption(), emptyOption()],
                  })
                }
              >
                Удалить
              </ActionButton>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (question.type === "OPEN") {
    return (
      <Field label="Подсказка или формулировка для открытого ответа" hint="Появится перед полем свободного ответа у студента.">
        <textarea
          rows={3}
          className={inputClassName()}
          value={config.prompt || ""}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Например: коротко опишите архитектуру проекта или объясните смысл термина."
        />
      </Field>
    );
  }

  if (question.type === "ORDER") {
    return (
      <div className="space-y-4">
        <Field label="Описание задания">
          <textarea
            rows={2}
            className={inputClassName()}
            value={config.prompt || ""}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Например: расположите этапы процесса в правильной последовательности."
          />
        </Field>
        <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4 theme-surface-inset">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-sm font-bold text-slate-900 theme-readable-strong">Элементы порядка</div>
            <ActionButton
              tone="secondary"
              className="px-3 py-2 text-xs"
              onClick={() => patchConfig({ items: [...(config.items || []), ""] })}
            >
              Добавить шаг
            </ActionButton>
          </div>
          <div className="grid gap-3">
            {(config.items || []).map((item, itemIndex) => (
              <div key={`order-item-${itemIndex}`} className="grid gap-3 lg:grid-cols-[1fr_auto]">
                <input
                  className={inputClassName()}
                  value={item}
                  onChange={(event) =>
                    patchConfig({
                      items: (config.items || []).map((current, currentIndex) => (currentIndex === itemIndex ? event.target.value : current)),
                    })
                  }
                  placeholder={`Шаг ${itemIndex + 1}`}
                />
                <ActionButton
                  tone="danger"
                  className="min-w-[120px]"
                  onClick={() =>
                    patchConfig({
                      items: (config.items || []).length > 2 ? (config.items || []).filter((_, currentIndex) => currentIndex !== itemIndex) : ["", ""],
                    })
                  }
                >
                  Удалить
                </ActionButton>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (question.type === "MATCH") {
    return (
      <div className="space-y-4">
        <Field label="Описание задания">
          <textarea
            rows={2}
            className={inputClassName()}
            value={config.prompt || ""}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Например: сопоставьте термин и определение."
          />
        </Field>
        <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4 theme-surface-inset">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-sm font-bold text-slate-900 theme-readable-strong">Пары для сопоставления</div>
            <ActionButton
              tone="secondary"
              className="px-3 py-2 text-xs"
              onClick={() => patchConfig({ pairs: [...(config.pairs || []), { left: "", right: "" }] })}
            >
              Добавить пару
            </ActionButton>
          </div>
          <div className="grid gap-3">
            {(config.pairs || []).map((pair, pairIndex) => (
              <div key={`match-pair-${pairIndex}`} className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
                <input
                  className={inputClassName()}
                  value={pair.left}
                  onChange={(event) =>
                    patchConfig({
                      pairs: patchList(config.pairs || [], pairIndex, { left: event.target.value }),
                    })
                  }
                  placeholder="Левая часть"
                />
                <input
                  className={inputClassName()}
                  value={pair.right}
                  onChange={(event) =>
                    patchConfig({
                      pairs: patchList(config.pairs || [], pairIndex, { right: event.target.value }),
                    })
                  }
                  placeholder="Правая часть"
                />
                <ActionButton
                  tone="danger"
                  className="min-w-[120px]"
                  onClick={() =>
                    patchConfig({
                      pairs: (config.pairs || []).length > 2 ? (config.pairs || []).filter((_, currentIndex) => currentIndex !== pairIndex) : [{ left: "", right: "" }, { left: "", right: "" }],
                    })
                  }
                >
                  Удалить
                </ActionButton>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (question.type === "CATEGORY") {
    return (
      <div className="space-y-4">
        <Field label="Описание задания">
          <textarea
            rows={2}
            className={inputClassName()}
            value={config.prompt || ""}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Например: распределите элементы по категориям."
          />
        </Field>
        <div className="space-y-4">
          {(config.categories || []).map((category, categoryIndex) => (
            <div key={`category-${categoryIndex}`} className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4 theme-surface-inset">
              <div className="mb-3 flex items-center justify-between gap-3">
                <input
                  className={inputClassName()}
                  value={category.name}
                  onChange={(event) =>
                    patchConfig({
                      categories: patchList(config.categories || [], categoryIndex, { name: event.target.value }),
                    })
                  }
                  placeholder={`Категория ${categoryIndex + 1}`}
                />
                <ActionButton
                  tone="danger"
                  className="min-w-[120px]"
                  onClick={() =>
                    patchConfig({
                      categories:
                        (config.categories || []).length > 2
                          ? (config.categories || []).filter((_, currentIndex) => currentIndex !== categoryIndex)
                          : [
                              { name: "Категория 1", items: [""] },
                              { name: "Категория 2", items: [""] },
                            ],
                    })
                  }
                >
                  Удалить
                </ActionButton>
              </div>
              <div className="grid gap-3">
                {(category.items || []).map((item, itemIndex) => (
                  <div key={`category-${categoryIndex}-item-${itemIndex}`} className="grid gap-3 lg:grid-cols-[1fr_auto]">
                    <input
                      className={inputClassName()}
                      value={item}
                      onChange={(event) =>
                        patchConfig({
                          categories: (config.categories || []).map((currentCategory, currentCategoryIndex) =>
                            currentCategoryIndex === categoryIndex
                              ? {
                                  ...currentCategory,
                                  items: (currentCategory.items || []).map((currentItem, currentItemIndex) =>
                                    currentItemIndex === itemIndex ? event.target.value : currentItem
                                  ),
                                }
                              : currentCategory
                          ),
                        })
                      }
                      placeholder="Элемент категории"
                    />
                    <ActionButton
                      tone="danger"
                      className="min-w-[120px]"
                      onClick={() =>
                        patchConfig({
                          categories: (config.categories || []).map((currentCategory, currentCategoryIndex) =>
                            currentCategoryIndex === categoryIndex
                              ? {
                                  ...currentCategory,
                                  items:
                                    (currentCategory.items || []).length > 1
                                      ? (currentCategory.items || []).filter((_, currentItemIndex) => currentItemIndex !== itemIndex)
                                      : [""],
                                }
                              : currentCategory
                          ),
                        })
                      }
                    >
                      Удалить
                    </ActionButton>
                  </div>
                ))}
              </div>
              <ActionButton
                tone="secondary"
                className="mt-3 px-3 py-2 text-xs"
                onClick={() =>
                  patchConfig({
                    categories: (config.categories || []).map((currentCategory, currentCategoryIndex) =>
                      currentCategoryIndex === categoryIndex
                        ? { ...currentCategory, items: [...(currentCategory.items || []), ""] }
                        : currentCategory
                    ),
                  })
                }
              >
                Добавить элемент
              </ActionButton>
            </div>
          ))}
          <ActionButton
            tone="secondary"
            className="px-3 py-2 text-xs"
            onClick={() =>
              patchConfig({
                categories: [...(config.categories || []), { name: `Категория ${(config.categories || []).length + 1}`, items: [""] }],
              })
            }
          >
            Добавить категорию
          </ActionButton>
        </div>
      </div>
    );
  }

  if (question.type === "KEYWORD" || question.type === "FORMULA") {
    const answers = config.answers || [""];
    return (
      <div className="space-y-4">
        <Field label="Описание задания">
          <textarea
            rows={2}
            className={inputClassName()}
            value={config.prompt || ""}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder={question.type === "FORMULA" ? "Например: введите формулу для закона Ньютона." : "Например: укажите ключевое слово или термин."}
          />
        </Field>
        {question.type === "KEYWORD" ? (
          <Field label="Маска ответа" hint="Например: П_Р_М_Р. Можно оставить пустой.">
            <input className={inputClassName()} value={config.mask || ""} onChange={(event) => patchConfig({ mask: event.target.value })} placeholder="Маска ответа" />
          </Field>
        ) : (
          <Field label="Подсказка в поле ответа">
            <input
              className={inputClassName()}
              value={config.placeholder || ""}
              onChange={(event) => patchConfig({ placeholder: event.target.value })}
              placeholder="Например: F = ma"
            />
          </Field>
        )}
        <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4 theme-surface-inset">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-sm font-bold text-slate-900 theme-readable-strong">Допустимые ответы</div>
            <ActionButton tone="secondary" className="px-3 py-2 text-xs" onClick={() => patchConfig({ answers: [...answers, ""] })}>
              Добавить ответ
            </ActionButton>
          </div>
          <div className="grid gap-3">
            {answers.map((answer, answerIndex) => (
              <div key={`answer-${answerIndex}`} className="grid gap-3 lg:grid-cols-[1fr_auto]">
                <input
                  className={inputClassName()}
                  value={answer}
                  onChange={(event) =>
                    patchConfig({
                      answers: answers.map((current, currentIndex) => (currentIndex === answerIndex ? event.target.value : current)),
                    })
                  }
                  placeholder="Допустимый ответ"
                />
                <ActionButton
                  tone="danger"
                  className="min-w-[120px]"
                  onClick={() =>
                    patchConfig({
                      answers: answers.length > 1 ? answers.filter((_, currentIndex) => currentIndex !== answerIndex) : [""],
                    })
                  }
                >
                  Удалить
                </ActionButton>
              </div>
            ))}
          </div>
        </div>
        {question.type === "KEYWORD" ? (
          <label className="flex min-h-[58px] items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm font-semibold theme-surface-inset theme-readable-soft">
            <input type="checkbox" checked={!!config.caseSensitive} onChange={(event) => patchConfig({ caseSensitive: event.target.checked })} />
            Учитывать регистр
          </label>
        ) : null}
      </div>
    );
  }

  if (question.type === "TABLE") {
    const rows = config.rows || [];
    const columns = config.columns || [];
    const answers = updateTableAnswers(config, rows, columns);
    return (
      <div className="space-y-4">
        <Field label="Описание задания">
          <textarea
            rows={2}
            className={inputClassName()}
            value={config.prompt || ""}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Например: заполните таблицу значениями."
          />
        </Field>
        <Field label="Подсказка в пустой ячейке">
          <input
            className={inputClassName()}
            value={config.placeholder || ""}
            onChange={(event) => patchConfig({ placeholder: event.target.value })}
            placeholder="Например: введите значение"
          />
        </Field>
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4 theme-surface-inset">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-sm font-bold text-slate-900 theme-readable-strong">Столбцы</div>
              <ActionButton
                tone="secondary"
                className="px-3 py-2 text-xs"
                onClick={() => {
                  const nextColumns = [...columns, { key: `col_${columns.length + 1}`, label: `Столбец ${columns.length + 1}` }];
                  patchConfig({ columns: nextColumns, answers: updateTableAnswers(config, rows, nextColumns) });
                }}
              >
                Добавить столбец
              </ActionButton>
            </div>
            <div className="grid gap-3">
              {columns.map((column, columnIndex) => (
                <div key={column.key} className="grid gap-3 lg:grid-cols-[1fr_auto]">
                  <input
                    className={inputClassName()}
                    value={column.label}
                    onChange={(event) => {
                      const nextColumns = columns.map((current, currentIndex) =>
                        currentIndex === columnIndex ? { ...current, label: event.target.value } : current
                      );
                      patchConfig({ columns: nextColumns });
                    }}
                    placeholder="Название столбца"
                  />
                  <ActionButton
                    tone="danger"
                    className="min-w-[120px]"
                    onClick={() => {
                      const nextColumns =
                        columns.length > 1
                          ? columns.filter((_, currentIndex) => currentIndex !== columnIndex)
                          : [{ key: "col_1", label: "Столбец 1" }];
                      patchConfig({ columns: nextColumns, answers: updateTableAnswers(config, rows, nextColumns) });
                    }}
                  >
                    Удалить
                  </ActionButton>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4 theme-surface-inset">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-sm font-bold text-slate-900 theme-readable-strong">Строки</div>
              <ActionButton
                tone="secondary"
                className="px-3 py-2 text-xs"
                onClick={() => {
                  const nextRows = [...rows, { key: `row_${rows.length + 1}`, label: `Строка ${rows.length + 1}` }];
                  patchConfig({ rows: nextRows, answers: updateTableAnswers(config, nextRows, columns) });
                }}
              >
                Добавить строку
              </ActionButton>
            </div>
            <div className="grid gap-3">
              {rows.map((row, rowIndex) => (
                <div key={row.key} className="grid gap-3 lg:grid-cols-[1fr_auto]">
                  <input
                    className={inputClassName()}
                    value={row.label}
                    onChange={(event) => {
                      const nextRows = rows.map((current, currentIndex) =>
                        currentIndex === rowIndex ? { ...current, label: event.target.value } : current
                      );
                      patchConfig({ rows: nextRows });
                    }}
                    placeholder="Название строки"
                  />
                  <ActionButton
                    tone="danger"
                    className="min-w-[120px]"
                    onClick={() => {
                      const nextRows =
                        rows.length > 1 ? rows.filter((_, currentIndex) => currentIndex !== rowIndex) : [{ key: "row_1", label: "Строка 1" }];
                      patchConfig({ rows: nextRows, answers: updateTableAnswers(config, nextRows, columns) });
                    }}
                  >
                    Удалить
                  </ActionButton>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-4 theme-surface-panel">
          <div className="mb-3 text-sm font-bold text-slate-900 theme-readable-strong">Правильные значения по ячейкам</div>
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-3">
              <thead>
                <tr>
                  <th className="text-left text-xs uppercase tracking-[0.14em] text-slate-500 theme-readable-muted">Строка</th>
                  {columns.map((column) => (
                    <th key={column.key} className="text-left text-xs uppercase tracking-[0.14em] text-slate-500 theme-readable-muted">
                      {column.label || "Столбец"}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key}>
                    <td className="rounded-2xl bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700 theme-surface-inset theme-readable-strong">
                      {row.label || "Строка"}
                    </td>
                    {columns.map((column) => (
                      <td key={`${row.key}-${column.key}`}>
                        <input
                          className={inputClassName()}
                          value={answers?.[row.key]?.[column.key] || ""}
                          placeholder="Значение"
                          onChange={(event) =>
                            patchConfig({
                              answers: {
                                ...answers,
                                [row.key]: {
                                  ...(answers[row.key] || {}),
                                  [column.key]: event.target.value,
                                },
                              },
                            })
                          }
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (question.type === "CODE" || question.type === "SQL") {
    const expectedKeywords = config.expectedKeywords || [""];
    const forbiddenKeywords = config.forbiddenKeywords || [];
    return (
      <div className="space-y-4">
        <Field label="Описание задания">
          <textarea
            rows={2}
            className={inputClassName()}
            value={config.prompt || ""}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder={question.type === "SQL" ? "Например: напишите SQL-запрос для выборки данных." : "Например: реализуйте функцию или допишите код."}
          />
        </Field>
        <div className="grid gap-4 xl:grid-cols-[0.75fr_1.25fr]">
          <Field label="Язык">
            <select
              className={inputClassName()}
              value={config.language || (question.type === "SQL" ? "sql" : "text")}
              onChange={(event) => patchConfig({ language: event.target.value })}
            >
              {["python", "javascript", "typescript", "java", "csharp", "cpp", "sql", "text"].map((language) => (
                <option key={language} value={language}>
                  {language}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Подсказка в поле ответа">
            <input
              className={inputClassName()}
              value={config.placeholder || ""}
              onChange={(event) => patchConfig({ placeholder: event.target.value })}
              placeholder={question.type === "SQL" ? "Напишите SQL-запрос" : "Напишите фрагмент кода"}
            />
          </Field>
        </div>
        <Field label="Стартовый шаблон">
          <textarea
            rows={5}
            className={inputClassName()}
            value={config.starterCode || ""}
            onChange={(event) => patchConfig({ starterCode: event.target.value })}
            placeholder={question.type === "SQL" ? "SELECT *\nFROM table_name\nWHERE ...;" : "function solve() {\n  \n}"}
          />
        </Field>
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4 theme-surface-inset">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-sm font-bold text-slate-900 theme-readable-strong">Ожидаемые ключевые признаки</div>
              <ActionButton
                tone="secondary"
                className="px-3 py-2 text-xs"
                onClick={() => patchConfig({ expectedKeywords: [...expectedKeywords, ""] })}
              >
                Добавить
              </ActionButton>
            </div>
            <div className="grid gap-3">
              {expectedKeywords.map((keyword, keywordIndex) => (
                <div key={`expected-${keywordIndex}`} className="grid gap-3 lg:grid-cols-[1fr_auto]">
                  <input
                    className={inputClassName()}
                    value={keyword}
                    onChange={(event) =>
                      patchConfig({
                        expectedKeywords: expectedKeywords.map((current, currentIndex) => (currentIndex === keywordIndex ? event.target.value : current)),
                      })
                    }
                    placeholder="Например: SELECT"
                  />
                  <ActionButton
                    tone="danger"
                    className="min-w-[120px]"
                    onClick={() =>
                      patchConfig({
                        expectedKeywords: expectedKeywords.length > 1 ? expectedKeywords.filter((_, currentIndex) => currentIndex !== keywordIndex) : [""],
                      })
                    }
                  >
                    Удалить
                  </ActionButton>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4 theme-surface-inset">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-sm font-bold text-slate-900 theme-readable-strong">Запрещенные ключевые признаки</div>
              <ActionButton
                tone="secondary"
                className="px-3 py-2 text-xs"
                onClick={() => patchConfig({ forbiddenKeywords: [...forbiddenKeywords, ""] })}
              >
                Добавить
              </ActionButton>
            </div>
            <div className="grid gap-3">
              {forbiddenKeywords.map((keyword, keywordIndex) => (
                <div key={`forbidden-${keywordIndex}`} className="grid gap-3 lg:grid-cols-[1fr_auto]">
                  <input
                    className={inputClassName()}
                    value={keyword}
                    onChange={(event) =>
                      patchConfig({
                        forbiddenKeywords: forbiddenKeywords.map((current, currentIndex) => (currentIndex === keywordIndex ? event.target.value : current)),
                      })
                    }
                    placeholder="Например: DROP"
                  />
                  <ActionButton
                    tone="danger"
                    className="min-w-[120px]"
                    onClick={() =>
                      patchConfig({
                        forbiddenKeywords: forbiddenKeywords.filter((_, currentIndex) => currentIndex !== keywordIndex),
                      })
                    }
                  >
                    Удалить
                  </ActionButton>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function QuestionCard({ question, index, saving, onPatch, onSave, onDelete }) {
  const typeMeta = QUESTION_TYPE_OPTIONS.find((item) => item.value === question.type);
  return (
    <article className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm theme-surface-panel">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] ${questionToneClasses(question.type)}`}>
            Вопрос {index + 1} · {TYPE_LABELS[question.type] || question.type}
          </div>
          <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 theme-surface-inset theme-readable-soft">
            Порядок: {question.order || index + 1}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionButton tone="secondary" disabled={saving} onClick={onSave}>
            {saving ? "Сохранение..." : "Сохранить вопрос"}
          </ActionButton>
          <ActionButton tone="danger" disabled={saving} onClick={onDelete}>
            Удалить
          </ActionButton>
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4">
          <Field label="Текст вопроса">
            <textarea
              rows={4}
              className={inputClassName()}
              value={question.text}
              onChange={(event) => onPatch({ text: event.target.value })}
              placeholder="Введите формулировку вопроса"
            />
          </Field>

          <Field label="Пояснение для преподавателя" hint="Можно хранить памятку, критерии проверки или внутреннюю заметку.">
            <textarea
              rows={4}
              className={inputClassName()}
              value={question.teacherNote || ""}
              onChange={(event) => onPatch({ teacherNote: event.target.value })}
              placeholder="Эта заметка не показывается студенту."
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Баллы">
              <input
                type="number"
                min={1}
                className={inputClassName()}
                value={question.points}
                onChange={(event) => onPatch({ points: clampNumber(event.target.value, 1, 999, 1) })}
              />
            </Field>
            <Field label="Порядок">
              <input
                type="number"
                min={0}
                className={inputClassName()}
                value={question.order}
                onChange={(event) => onPatch({ order: clampNumber(event.target.value, 0, 999, 0) })}
              />
            </Field>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 theme-surface-inset">
            <div className="text-sm font-bold text-slate-900 theme-readable-strong">Подсказка по типу</div>
            <p className="mt-2 text-sm leading-6 text-slate-600 theme-readable-soft">
              {typeMeta?.hint || "Настройте вопрос в соответствии с типом проверки и ожидаемым форматом ответа."}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 theme-surface-inset">
            <div className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500 theme-readable-muted">Тип вопроса</div>
            <div className="mt-2 text-lg font-black text-slate-950 theme-readable-strong">{TYPE_LABELS[question.type] || question.type}</div>
          </div>
          <ConfigEditor question={question} onPatch={onPatch} />
        </div>
      </div>
    </article>
  );
}

export default function CourseTestEditorPage() {
  const { courseId, testId } = useParams();
  const navigate = useNavigate();
  const user = getUser();
  const isManager = user?.role === "TEACHER" || user?.role === "ADMIN";

  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState(null);
  const [test, setTest] = useState(null);
  const [error, setError] = useState("");
  const [questionError, setQuestionError] = useState("");
  const [savingMeta, setSavingMeta] = useState(false);
  const [savingQuestionKey, setSavingQuestionKey] = useState("");
  const [confirmDeleteTestOpen, setConfirmDeleteTestOpen] = useState(false);
  const [questionToDelete, setQuestionToDelete] = useState(null);

  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [metaInstructions, setMetaInstructions] = useState("");
  const [metaTimeLimit, setMetaTimeLimit] = useState(20);
  const [metaTabSwitchLimit, setMetaTabSwitchLimit] = useState(3);
  const [metaAttemptLimit, setMetaAttemptLimit] = useState(1);
  const [questionForms, setQuestionForms] = useState([]);
  const [newQuestion, setNewQuestion] = useState(createQuestionForm("SINGLE", 1));
  const rootRef = useRef(null);

  const draftStorageKey = `lms-test-draft:${testId}`;

  useEffect(() => {
    sanitizeDomText(rootRef.current);
  }, [loading, error, questionError, course, test, questionForms, newQuestion, metaTitle, metaDescription, metaInstructions, metaTimeLimit, metaTabSwitchLimit, metaAttemptLimit]);

  async function loadPage() {
    setLoading(true);
    setError("");

    try {
      const [courseRes, testRes] = await Promise.all([http.get(`/courses/${courseId}`), http.get(`/tests/${testId}`)]);
      const nextCourse = courseRes.data?.course || null;
      const nextTest = testRes.data?.test || null;
      const sortedQuestions = (nextTest?.questions || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));

      setCourse(nextCourse);
      setTest(nextTest);
      setMetaTitle(String(nextTest?.title || ""));
      setMetaDescription(String(nextTest?.description || ""));
      setMetaInstructions(String(nextTest?.instructions || ""));
      setMetaTimeLimit(Math.max(0, Number(nextTest?.timeLimitMinutes ?? 20)));
      setMetaTabSwitchLimit(Math.max(0, Math.min(50, Number(nextTest?.tabSwitchLimit ?? 3))));
      setMetaAttemptLimit(Math.max(0, Math.min(5, Number(nextTest?.attemptLimit ?? 1))));
      setQuestionForms(sortedQuestions.map(hydrateQuestionForm));
      setNewQuestion(createQuestionForm("SINGLE", sortedQuestions.length + 1));

      const rawDraft = window.localStorage.getItem(draftStorageKey);
      if (rawDraft) {
        try {
          const draft = JSON.parse(rawDraft);
          if (draft && typeof draft === "object" && draft.testId === Number(testId)) {
            setMetaTitle(String(draft.metaTitle || nextTest?.title || ""));
            setMetaDescription(String(draft.metaDescription || nextTest?.description || ""));
            setMetaInstructions(String(draft.metaInstructions || nextTest?.instructions || ""));
            setMetaTimeLimit(Math.max(0, Number(draft.metaTimeLimit ?? nextTest?.timeLimitMinutes ?? 20)));
            setMetaTabSwitchLimit(Math.max(0, Math.min(50, Number(draft.metaTabSwitchLimit ?? nextTest?.tabSwitchLimit ?? 3))));
            setMetaAttemptLimit(Math.max(0, Math.min(5, Number(draft.metaAttemptLimit ?? nextTest?.attemptLimit ?? 1))));
            if (!sortedQuestions.length && Array.isArray(draft.questionForms) && draft.questionForms.length) {
              setQuestionForms(draft.questionForms.map(hydrateQuestionForm));
            }
            if (!sortedQuestions.length && draft.newQuestion) {
              setNewQuestion({
                ...createQuestionForm(draft.newQuestion.type || "SINGLE", Number(draft.newQuestion.order || sortedQuestions.length + 1)),
                ...draft.newQuestion,
              });
            }
          }
        } catch {
          window.localStorage.removeItem(draftStorageKey);
        }
      }
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "Не удалось загрузить страницу редактирования теста.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, draftStorageKey, testId]);

  useEffect(() => {
    if (loading) return undefined;
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(
        draftStorageKey,
        JSON.stringify({
          testId: Number(testId),
          metaTitle,
          metaDescription,
          metaInstructions,
          metaTimeLimit,
          metaTabSwitchLimit,
          metaAttemptLimit,
          questionForms,
          newQuestion,
          savedAt: Date.now(),
        })
      );
    }, 700);
    return () => window.clearTimeout(timer);
  }, [
    draftStorageKey,
    loading,
    metaAttemptLimit,
    metaDescription,
    metaInstructions,
    metaTabSwitchLimit,
    metaTimeLimit,
    metaTitle,
    newQuestion,
    questionForms,
    testId,
  ]);

  const stats = useMemo(() => {
    const questions = questionForms.length;
    const totalPoints = questionForms.reduce((sum, question) => sum + Number(question.points || 0), 0);
    const interactive = questionForms.filter((question) => !["SINGLE", "MULTI", "OPEN"].includes(question.type)).length;
    return { questions, totalPoints, interactive };
  }, [questionForms]);

  function patchQuestion(index, patch) {
    setQuestionForms((prev) => prev.map((question, currentIndex) => (currentIndex === index ? { ...question, ...patch } : question)));
  }

  async function saveMeta(event) {
    event.preventDefault();
    setError("");
    try {
      setSavingMeta(true);
      await http.put(`/tests/${testId}`, {
        title: metaTitle,
        description: metaDescription,
        instructions: metaInstructions,
        timeLimitMinutes: Number(metaTimeLimit) === 0 ? 0 : Math.max(1, Number(metaTimeLimit || 20)),
        tabSwitchLimit: Number(metaTabSwitchLimit) === 0 ? 0 : Math.max(1, Math.min(50, Number(metaTabSwitchLimit || 3))),
        attemptLimit: Number(metaAttemptLimit) === 0 ? 0 : Math.max(1, Math.min(5, Number(metaAttemptLimit || 1))),
      });
      window.localStorage.removeItem(draftStorageKey);
      await loadPage();
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "Не удалось сохранить параметры теста.");
    } finally {
      setSavingMeta(false);
    }
  }

  async function togglePublish() {
    try {
      if (test?.isPublished) {
        await http.post(`/tests/${testId}/unpublish`);
      } else {
        await http.post(`/tests/${testId}/publish`);
      }
      await loadPage();
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "Не удалось изменить статус публикации.");
    }
  }

  async function deleteTest() {
    try {
      await http.delete(`/tests/${testId}`);
      navigate(`/courses/${courseId}/assignments`);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "Не удалось удалить тест.");
    } finally {
      setConfirmDeleteTestOpen(false);
    }
  }

  async function saveQuestion(index) {
    const question = questionForms[index];
    if (!question?.id) return;

    try {
      setQuestionError("");
      setSavingQuestionKey(`save-${question.id}`);
      await http.put(`/questions/${question.id}`, cleanQuestionPayload(question));
      window.localStorage.removeItem(draftStorageKey);
      await loadPage();
    } catch (err) {
      setQuestionError(err?.response?.data?.error || err.message || "Не удалось сохранить вопрос.");
    } finally {
      setSavingQuestionKey("");
    }
  }

  async function removeQuestion() {
    if (!questionToDelete?.id) return;
    try {
      setSavingQuestionKey(`delete-${questionToDelete.id}`);
      await http.delete(`/questions/${questionToDelete.id}`);
      setQuestionToDelete(null);
      window.localStorage.removeItem(draftStorageKey);
      await loadPage();
    } catch (err) {
      setQuestionError(err?.response?.data?.error || err.message || "Не удалось удалить вопрос.");
    } finally {
      setSavingQuestionKey("");
    }
  }

  async function createQuestion(event) {
    event.preventDefault();
    try {
      setQuestionError("");
      setSavingQuestionKey("new");
      await http.post(`/tests/${testId}/questions`, cleanQuestionPayload(newQuestion));
      window.localStorage.removeItem(draftStorageKey);
      await loadPage();
    } catch (err) {
      setQuestionError(err?.response?.data?.error || err.message || "Не удалось добавить вопрос.");
    } finally {
      setSavingQuestionKey("");
    }
  }

  if (!isManager) {
    return <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">У вас нет доступа к редактированию теста.</div>;
  }

  return (
    <div ref={rootRef} className="mx-auto w-full max-w-[1780px] space-y-6 px-2 py-3 lg:px-4">
      <ActionButton tone="secondary" className="relative z-10" onClick={() => navigate(`/courses/${courseId}/assignments`)}>
        Назад к курсу
      </ActionButton>

      {error ? <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div> : null}
      {questionError ? <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-amber-800">{questionError}</div> : null}

      <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm theme-surface-panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Редактор теста</div>
            <h1 className="mt-2 text-3xl font-black text-slate-950 theme-readable-strong">{test?.title || "Новый тест"}</h1>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600 theme-readable-soft">
              {course?.title ? `${course.title}. ` : ""}
              Здесь вы настраиваете параметры публикации, лимиты, вопросы и критерии проверки. Для интерактивных форматов доступны
              сопоставление, этапы, категории, таблицы, формулы, код и SQL.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionButton tone={test?.isPublished ? "secondary" : "success"} onClick={togglePublish}>
              {test?.isPublished ? "Снять с публикации" : "Опубликовать"}
            </ActionButton>
            <ActionButton tone="solidDanger" onClick={() => setConfirmDeleteTestOpen(true)}>
              Удалить тест
            </ActionButton>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-[24px] border border-blue-200 bg-blue-50 p-4">
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Вопросов</div>
            <div className="mt-2 text-3xl font-black text-slate-950">{stats.questions}</div>
          </div>
          <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-4">
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Интерактивных</div>
            <div className="mt-2 text-3xl font-black text-slate-950">{stats.interactive}</div>
          </div>
          <div className="rounded-[24px] border border-violet-200 bg-violet-50 p-4">
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-violet-700">Сумма баллов</div>
            <div className="mt-2 text-3xl font-black text-slate-950">{stats.totalPoints}</div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm theme-surface-panel">
          <div className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500 theme-readable-muted">Параметры теста</div>
          <form onSubmit={saveMeta} className="mt-4 grid gap-4">
            <Field label="Название теста">
              <input className={inputClassName()} value={metaTitle} onChange={(event) => setMetaTitle(event.target.value)} />
            </Field>
            <Field label="Краткое описание">
              <textarea
                rows={4}
                className={inputClassName()}
                value={metaDescription}
                onChange={(event) => setMetaDescription(event.target.value)}
                placeholder="Укажите краткое описание и цель теста."
              />
            </Field>
            <Field label="Инструкции для студента" hint="Появятся в начале прохождения рядом с таймером и правилами.">
              <textarea
                rows={5}
                className={inputClassName()}
                value={metaInstructions}
                onChange={(event) => setMetaInstructions(event.target.value)}
                placeholder="Например: внимательно читайте вопросы, сохраняйте ответы и не переключайтесь между вкладками без необходимости."
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Лимит времени, минут">
                <div className="grid gap-3">
                  <input
                    type="number"
                    min={1}
                    disabled={Number(metaTimeLimit) === 0}
                    className={inputClassName()}
                    value={Number(metaTimeLimit) === 0 ? "" : metaTimeLimit}
                    onChange={(event) => setMetaTimeLimit(Math.max(1, Number(event.target.value || 1)))}
                    placeholder={Number(metaTimeLimit) === 0 ? "Без лимита" : ""}
                  />
                  <label className="flex min-h-[58px] items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm font-semibold theme-surface-inset theme-readable-soft">
                    <input type="checkbox" checked={Number(metaTimeLimit) === 0} onChange={(event) => setMetaTimeLimit(event.target.checked ? 0 : 20)} />
                    Неограниченное время
                  </label>
                </div>
              </Field>
              <Field label="Допустимых переключений вкладки">
                <div className="grid gap-3">
                  <input
                    type="number"
                    min={1}
                    max={50}
                    disabled={Number(metaTabSwitchLimit) === 0}
                    className={inputClassName()}
                    value={Number(metaTabSwitchLimit) === 0 ? "" : metaTabSwitchLimit}
                    onChange={(event) => setMetaTabSwitchLimit(Math.max(1, Math.min(50, Number(event.target.value || 1))))}
                    placeholder={Number(metaTabSwitchLimit) === 0 ? "Без лимита" : ""}
                  />
                  <label className="flex min-h-[58px] items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm font-semibold theme-surface-inset theme-readable-soft">
                    <input type="checkbox" checked={Number(metaTabSwitchLimit) === 0} onChange={(event) => setMetaTabSwitchLimit(event.target.checked ? 0 : 3)} />
                    Неограниченное количество переключений
                  </label>
                </div>
              </Field>
              <Field label="Лимит попыток">
                <div className="grid gap-3">
                  <input
                    type="number"
                    min={1}
                    max={5}
                    disabled={Number(metaAttemptLimit) === 0}
                    className={inputClassName()}
                    value={Number(metaAttemptLimit) === 0 ? "" : metaAttemptLimit}
                    onChange={(event) => setMetaAttemptLimit(Math.max(1, Math.min(5, Number(event.target.value || 1))))}
                    placeholder={Number(metaAttemptLimit) === 0 ? "Без лимита" : ""}
                  />
                  <label className="flex min-h-[58px] items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm font-semibold theme-surface-inset theme-readable-soft">
                    <input type="checkbox" checked={Number(metaAttemptLimit) === 0} onChange={(event) => setMetaAttemptLimit(event.target.checked ? 0 : 1)} />
                    Неограниченное количество попыток
                  </label>
                </div>
              </Field>
            </div>
            <ActionButton type="submit" tone="dark" disabled={savingMeta}>
              {savingMeta ? "Сохранение..." : "Сохранить параметры"}
            </ActionButton>
          </form>
        </section>

        <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm theme-surface-panel">
          <div className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500 theme-readable-muted">Новый вопрос</div>
          <form onSubmit={createQuestion} className="mt-4 grid gap-5">
            <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
              <Field label="Текст вопроса">
                <textarea
                  rows={4}
                  className={inputClassName()}
                  value={newQuestion.text}
                  onChange={(event) => setNewQuestion((prev) => ({ ...prev, text: event.target.value }))}
                  placeholder="Сформулируйте вопрос для студента"
                />
              </Field>
              <div className="grid gap-4">
                <Field label="Тип вопроса">
                  <select
                    className={inputClassName()}
                    value={newQuestion.type}
                    onChange={(event) =>
                      setNewQuestion((prev) => ({
                        ...createQuestionForm(event.target.value, Number(prev.order || 0)),
                        text: prev.text,
                        points: prev.points,
                        order: prev.order,
                      }))
                    }
                  >
                    {QUESTION_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Баллы">
                    <input
                      type="number"
                      min={1}
                      className={inputClassName()}
                      value={newQuestion.points}
                      onChange={(event) => setNewQuestion((prev) => ({ ...prev, points: clampNumber(event.target.value, 1, 999, 1) }))}
                    />
                  </Field>
                  <Field label="Порядок">
                    <input
                      type="number"
                      min={0}
                      className={inputClassName()}
                      value={newQuestion.order}
                      onChange={(event) => setNewQuestion((prev) => ({ ...prev, order: clampNumber(event.target.value, 0, 999, 0) }))}
                    />
                  </Field>
                </div>
              </div>
            </div>
            <ConfigEditor question={newQuestion} onPatch={(patch) => setNewQuestion((prev) => ({ ...prev, ...patch }))} />
            <ActionButton type="submit" tone="primary" disabled={savingQuestionKey === "new" || !newQuestion.text.trim()}>
              {savingQuestionKey === "new" ? "Добавление..." : "Добавить вопрос"}
            </ActionButton>
          </form>
        </section>
      </div>

      <section className="space-y-4">
        {questionForms.map((question, index) => (
          <QuestionCard
            key={question.id || `draft-${index}`}
            question={question}
            index={index}
            saving={savingQuestionKey === `save-${question.id}` || savingQuestionKey === `delete-${question.id}`}
            onPatch={(patch) => patchQuestion(index, patch)}
            onSave={() => saveQuestion(index)}
            onDelete={() => setQuestionToDelete(question)}
          />
        ))}
      </section>

      <ConfirmDialog
        open={confirmDeleteTestOpen}
        title="Удалить тест"
        message="Тест будет удалён вместе с вопросами и историей настройки. Действие необратимо."
        onCancel={() => setConfirmDeleteTestOpen(false)}
        onConfirm={deleteTest}
      />

      <ConfirmDialog
        open={!!questionToDelete}
        title="Удалить вопрос"
        message="Вопрос будет удалён из теста. Действие необратимо."
        onCancel={() => setQuestionToDelete(null)}
        onConfirm={removeQuestion}
      />
    </div>
  );
}
