import { jsonError } from '@/lib/http';

// TODO (Track A)
export async function GET(_req: Request) {
  return jsonError(501, 'Not implemented');
}
