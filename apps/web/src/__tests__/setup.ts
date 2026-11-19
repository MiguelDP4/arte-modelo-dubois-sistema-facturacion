import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

export const mockPush = vi.fn();
export const mockReplace = vi.fn();
let currentPathname = '/';
let currentSearchParams = new URLSearchParams();
let currentParams: Record<string, string> = {};

export function setMockPathname(path: string) {
  currentPathname = path;
}

export function setMockSearchParams(params: Record<string, string>) {
  currentSearchParams = new URLSearchParams(params);
}

export function setMockParams(params: Record<string, string>) {
  currentParams = params;
}

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: vi.fn(),
  }),
  usePathname: () => currentPathname,
  useSearchParams: () => currentSearchParams,
  useParams: () => currentParams,
}));
