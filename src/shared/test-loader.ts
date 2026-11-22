/**
 * ESM resolve hook for unit tests run under Node's type stripping
 * (`npm run test:unit`).
 *
 * Node's type-stripping resolver requires explicit file extensions, but the
 * shared modules use extensionless relative imports (`./api`), which Vite
 * and TypeScript resolve fine. This hook retries a failed extensionless
 * relative specifier with a `.ts` suffix appended, so the tests can import
 * the real modules unchanged. It is only registered by the test files
 * themselves — never by app code.
 */
// The shared tsconfig does not include Node types, so this file pulls them
// in itself for node:module.
/// <reference types="node" />
import type { ResolveHook } from 'node:module';

export const resolve: ResolveHook = async (
  specifier,
  context,
  nextResolve
) => {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    const isRelative =
      specifier.startsWith('./') || specifier.startsWith('../');
    if (isRelative && !specifier.endsWith('.ts')) {
      return await nextResolve(`${specifier}.ts`, context);
    }
    throw error;
  }
};
