import type { Tag } from '../../shared/types';
import { api } from '../api';
import { useLoad } from './useLoad';

/** Slug list -> readable labels, using the tag list from the API. */
export function useTagLabels() {
  const { data } = useLoad(() => api<Tag[]>('/tags'));
  return (slugs: string[]) => slugs.map((s) => data?.find((t) => t.slug === s)?.label ?? s);
}
