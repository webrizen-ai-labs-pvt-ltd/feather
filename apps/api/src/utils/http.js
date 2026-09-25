export class HttpError extends Error {
  /**
   * @param {number} status
   * @param {string} message  Simple English, safe to show to the user.
   * @param {object} [extra]  { code, fields, data }
   */
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = extra.code;
    this.fields = extra.fields;
    this.data = extra.data;
  }
}

export const badRequest = (msg, extra) => new HttpError(400, msg, extra);
export const forbidden = (msg = 'You are not allowed to do this.', extra) => new HttpError(403, msg, extra);
export const notFound = (what = 'Record') => new HttpError(404, `${what} not found.`);
export const conflict = (msg, extra) => new HttpError(409, msg, extra);

/** Escape user text for use inside a RegExp search. */
export const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const pageParams = (query, max = 200) => {
  const limit = Math.min(Math.max(Number(query.limit) || 50, 1), max);
  const page = Math.max(Number(query.page) || 1, 1);
  return { limit, skip: (page - 1) * limit, page };
};
