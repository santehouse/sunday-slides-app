/**
 * `SignInFormState` + its initial value live outside `actions.ts` because a
 * "use server" file may only export async functions — a plain object export
 * (like `initialSignInFormState`) trips Next's "A 'use server' file can only
 * export async functions" build error.
 */
export type SignInFormState =
  | { mode: "idle" }
  | { mode: "invalid_credentials" }
  | { mode: "magic_link_sent"; email: string }
  | { mode: "magic_link_error" };

export const initialSignInFormState: SignInFormState = { mode: "idle" };
