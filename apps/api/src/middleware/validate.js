import { fieldErrors } from '@feather/shared';
import { badRequest } from '@/utils/http.js';

/** Validate req[source] with a zod schema. Clean data is put on req.valid. */
export const validate =
  (schema, source = 'body') =>
  (req, _res, next) => {
    const result = schema.safeParse(req[source] ?? {});
    if (!result.success) {
      const fields = fieldErrors(result.error);
      throw badRequest(Object.values(fields)[0] ?? 'Please check the form.', { code: 'VALIDATION', fields });
    }
    req.valid = result.data;
    next();
  };
