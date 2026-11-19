import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Pagination } from '@/components/Pagination/Pagination';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

function DebounceProbe({ value, delayMs }: { value: string; delayMs?: number }) {
  const debounced = useDebouncedValue(value, delayMs);
  return <output data-testid="debounced">{debounced}</output>;
}

describe('useDebouncedValue & Pagination', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('waits 1000ms after rapid typing before updating the debounced search term', () => {
    const { rerender } = render(<DebounceProbe value="" />);
    expect(screen.getByTestId('debounced')).toHaveTextContent('');

    rerender(<DebounceProbe value="m" />);
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.getByTestId('debounced')).toHaveTextContent('');

    rerender(<DebounceProbe value="mar" />);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByTestId('debounced')).toHaveTextContent('');

    rerender(<DebounceProbe value="marco" />);
    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(screen.getByTestId('debounced')).toHaveTextContent('');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByTestId('debounced')).toHaveTextContent('marco');
  });

  it('renders Pagination summary, handles page navigation, pageSize changes, and empty totals', () => {
    const onPageChange = vi.fn();
    const onPageSizeChange = vi.fn();

    const { rerender } = render(
      <Pagination
        pagination={{
          page: 1,
          pageSize: 10,
          total: 25,
          totalPages: 3,
          hasPrev: false,
          hasNext: true,
        }}
        pageSize={10}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        itemLabel="productos"
      />,
    );

    expect(
      screen.getByText('Mostrando 1–10 de 25 productos'),
    ).toBeInTheDocument();
    expect(screen.getByText('Página 1 de 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(onPageChange).toHaveBeenCalledWith(2);

    fireEvent.change(screen.getByLabelText('Registros por página'), {
      target: { value: '50' },
    });
    expect(onPageSizeChange).toHaveBeenCalledWith(50);

    fireEvent.change(screen.getByLabelText('Registros por página'), {
      target: { value: '0' },
    });
    expect(onPageSizeChange).toHaveBeenCalledWith(0);

    rerender(
      <Pagination
        pagination={{
          page: 1,
          pageSize: 0,
          total: 25,
          totalPages: 1,
          hasPrev: false,
          hasNext: false,
        }}
        pageSize={0}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        itemLabel="productos"
      />,
    );
    expect(screen.getByText('Mostrando 1–25 de 25 productos')).toBeInTheDocument();
    expect(screen.getByText('Página 1 de 1')).toBeInTheDocument();

    rerender(
      <Pagination
        pagination={{
          page: 2,
          pageSize: 10,
          total: 25,
          totalPages: 3,
          hasPrev: true,
          hasNext: true,
        }}
        pageSize={10}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }));
    expect(onPageChange).toHaveBeenCalledWith(1);

    rerender(
      <Pagination
        pagination={{
          page: 1,
          pageSize: 10,
          total: 0,
          totalPages: 1,
          hasPrev: false,
          hasNext: false,
        }}
        pageSize={10}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />,
    );
    expect(screen.getByText('0 registros')).toBeInTheDocument();
  });
});
