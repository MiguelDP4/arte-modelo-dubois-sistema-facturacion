import axios, { AxiosError } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getAccessToken,
  getApiErrorMessage,
  setAccessToken,
  setOnUnauthorized,
} from '@/lib/api-client';

describe('api-client helpers', () => {
  beforeEach(() => {
    setAccessToken(null);
    setOnUnauthorized(null);
  });

  it('stores and retrieves in-memory access token', () => {
    expect(getAccessToken()).toBeNull();
    setAccessToken('jwt-token-123');
    expect(getAccessToken()).toBe('jwt-token-123');
    setAccessToken(null);
    expect(getAccessToken()).toBeNull();
  });

  it('extracts friendly error messages from AxiosError, Error and unknown values', () => {
    const axiosErr = new AxiosError('Request failed');
    axiosErr.response = {
      data: { message: 'Credenciales inválidas.' },
      status: 401,
      statusText: 'Unauthorized',
      headers: {},
      config: { headers: new axios.AxiosHeaders() },
    };

    expect(getApiErrorMessage(axiosErr)).toBe('Credenciales inválidas.');
    expect(getApiErrorMessage(new Error('Fallo de red'))).toBe('Fallo de red');
    expect(getApiErrorMessage(null, 'Fallback msg')).toBe('Fallback msg');

    const cb = vi.fn();
    setOnUnauthorized(cb);
    setOnUnauthorized(null);
  });
});
