import { ApiClient } from '@pantrytoplate/shared';

// Single shared client instance. Base URL comes from the env at build time,
// defaulting to the local gateway.
export const api = new ApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://backend-pantry-pilot.fly.dev',
});
