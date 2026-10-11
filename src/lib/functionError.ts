import { FunctionsHttpError } from '@supabase/supabase-js';

/**
 * supabase.functions.invoke turns every non-2xx response into a generic
 * "Edge Function returned a non-2xx status code" error. Surface the
 * function's own `{ error }` message instead (e.g. "File is too large").
 */
export async function toFunctionError(error: unknown): Promise<Error> {
  if (error instanceof FunctionsHttpError) {
    const body = await error.context.json().catch(() => null);

    if (typeof body?.error === 'string' && body.error) {
      return new Error(body.error);
    }
  }

  return error instanceof Error ? error : new Error(String(error));
}
