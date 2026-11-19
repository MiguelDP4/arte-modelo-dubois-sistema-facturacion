import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  type PaginationMeta,
} from '@arte-modelo/shared';
import { env } from '../config/env';

export interface PaginationParams {
  page: number;
  pageSize: number;
  showAll: boolean;
}

export function parsePaginationQuery(
  query: {
    page?: unknown;
    pageSize?: unknown;
  },
  defaultPageSize = DEFAULT_PAGE_SIZE,
): PaginationParams {
  const rawPage = Number(query.page);
  const page =
    Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;

  const hasExplicitPageSize =
    query.pageSize !== undefined &&
    query.pageSize !== null &&
    String(query.pageSize).trim() !== '';

  if (hasExplicitPageSize) {
    const rawPageSize = Number(query.pageSize);
    if (Number.isFinite(rawPageSize) && Math.floor(rawPageSize) === 0) {
      return { page: 1, pageSize: 0, showAll: true };
    }
    const pageSize =
      Number.isFinite(rawPageSize) && rawPageSize >= 1
        ? Math.min(MAX_PAGE_SIZE, Math.floor(rawPageSize))
        : defaultPageSize;
    return {
      page: pageSize === 0 ? 1 : page,
      pageSize,
      showAll: pageSize === 0,
    };
  }

  return {
    page: defaultPageSize === 0 ? 1 : page,
    pageSize: defaultPageSize,
    showAll: defaultPageSize === 0,
  };
}

export function prismaPaginationArgs(pagination: PaginationMeta): {
  skip?: number;
  take?: number;
} {
  if (pagination.pageSize === 0) {
    return {};
  }
  return {
    skip: (pagination.page - 1) * pagination.pageSize,
    take: pagination.pageSize,
  };
}

export function containsFilter(term: string) {
  if (env.databaseUrl.startsWith('file:')) {
    return { contains: term };
  }
  return { contains: term, mode: 'insensitive' as const };
}
