// Inject globalThis.require so esbuild's CJS-interop shim can call require()
// on Node built-ins (e.g. commander -> require('events')).
import { createRequire } from 'module';
globalThis.require = createRequire(import.meta.url);
