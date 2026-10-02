import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../app/overlays.jsx';
import { useApi } from './auth.jsx';

/** GET with react-query. The cache key is path + query. */
export function useGet(path, query, options = {}) {
  const api = useApi();
  return useQuery({ queryKey: [path, query ?? {}], queryFn: () => api.get(path, query), enabled: Boolean(path), ...options });
}

/**
 * Mutation that toasts on success / failure and refreshes related lists.
 * fn receives (api, vars). invalidate = list of path prefixes to refetch.
 */
export function useAction(fn, { success, invalidate = [], onSuccess, onError } = {}) {
  const api = useApi();
  const toast = useToast();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars) => fn(api, vars),
    onSuccess: async (data, vars) => {
      if (success) toast(typeof success === 'function' ? success(data, vars) : success);
      await Promise.all(invalidate.map((prefix) => qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith(prefix) })));
      onSuccess?.(data, vars);
    },
    onError: (err) => {
      if (onError) onError(err);
      else toast(err.message, 'bad');
    },
  });
}

/** Options for SelectField from a master list. */
export const toOptions = (items = [], hint) => items.map((i) => ({ value: i._id, label: i.name, hint: hint?.(i) }));
