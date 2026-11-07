import type { KeyboardEvent } from "react";

const FOCUSABLE = 'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])';

/**
 * Keyboard flow for rapid data entry:
 *  - Enter in an input/select moves focus to the next field instead of submitting
 *  - Ctrl/Cmd + Enter submits the form
 * Textareas keep their normal Enter behaviour.
 */
export function handleEnterNavigation(event: KeyboardEvent<HTMLFormElement>) {
  if (event.key !== "Enter") return;
  const target = event.target as HTMLElement;
  const form = event.currentTarget;

  if (event.ctrlKey || event.metaKey) {
    event.preventDefault();
    form.requestSubmit();
    return;
  }
  if (target.tagName === "TEXTAREA" || target.tagName === "BUTTON") return;
  if (target.getAttribute("data-enter") === "default") return;

  event.preventDefault();
  focusNextField(form, target);
}

export function focusNextField(form: HTMLFormElement, current: HTMLElement) {
  const fields = Array.from(form.querySelectorAll<HTMLElement>(FOCUSABLE));
  const index = fields.indexOf(current);
  const next = fields[index + 1];
  if (next) {
    next.focus();
    if (next instanceof HTMLInputElement) next.select();
  }
}
