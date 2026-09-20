import { NextResponse } from 'next/server';
import type { ApiError } from './types';

/** Shared helpers for API routes. */
export function jsonError(status: number, error: string) {
  return NextResponse.json<ApiError>({ error }, { status });
}

export function jsonOk<T>(body: T, status = 200) {
  return NextResponse.json<T>(body, { status });
}

/** Throw this from lib code; routes convert it with `handleApiError`. */
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function handleApiError(err: unknown) {
  if (err instanceof HttpError) return jsonError(err.status, err.message);
  console.error(err);
  return jsonError(500, 'Internal error');
}
