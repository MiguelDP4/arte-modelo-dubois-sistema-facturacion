import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from '@arte-modelo/shared';
import { env } from '../config/env';

export interface PaginationParams {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

export function parsePaginationQuery(query: {
  page?: unknown;
  pageSize?: unknown;
}): PaginationParams {
  const rawPage = Number(query.page);
  const rawPageSize = Number(query.pageSize);

  const page =
    Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  const pageSize =
    Number.isFinite(rawPageSize) && rawPageSize >= 1
      ? Math.min(MAX_PAGE_SIZE, Math.floor(rawPageSize))
      : DEFAULT_PAGE_SIZE;

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}

export function containsFilter(term: string) {
  if (env.databaseUrl.startsWith('file:')) {
    return { contains: term };
  }
  return { contains: term, mode: 'insensitive' as const };
}
