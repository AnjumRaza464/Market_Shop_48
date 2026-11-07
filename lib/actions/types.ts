import type { FieldErrors } from "@/lib/validation/common";

export type ActionState =
  | { status: "idle" }
  | { status: "error"; message?: string; fieldErrors?: FieldErrors }
  | { status: "success"; message?: string; id?: number };

export const idleState: ActionState = { status: "idle" };

export function errorState(message: string, fieldErrors?: FieldErrors): ActionState {
  return { status: "error", message, fieldErrors };
}

export function successState(message?: string, id?: number): ActionState {
  return { status: "success", message, id };
}

export type FormAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;
