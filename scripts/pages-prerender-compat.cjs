// Build-only workaround for Vinext beta.5's unprefixed prerender requests.
// Its synthetic requests use exactly http://localhost without a port; the
// production handler correctly requires basePath. Real network URLs stay intact.
const NativeRequest = globalThis.Request;
const prefix = process.env.NEXT_PUBLIC_BASE_PATH || '';
if (prefix) globalThis.Request = class PagesPrerenderRequest extends NativeRequest {
  constructor(input, init) {
    if (typeof input === 'string' || input instanceof URL) {
      const url = new URL(input);
      if (process.env.VINEXT_PRERENDER === '1' && url.origin === 'http://localhost' && url.pathname !== prefix && !url.pathname.startsWith(prefix + '/')) {
        url.pathname = prefix + url.pathname;
        input = url;
      }
    }
    super(input, init);
  }
};

// Node/Windows can assert when process.exit(0) interrupts fetch teardown.
// Successful CLI builds may drain naturally. Nonzero exits remain failures.
// oxlint-disable-next-line typescript/no-require-imports -- Node --require preloads use CommonJS.
const mainBuild = require('node:worker_threads').isMainThread
  && (process.argv[1] || '').replaceAll('\\','/').endsWith('/vinext/dist/cli.js')
  && process.argv[2] === 'build';
if (process.platform === 'win32' && mainBuild) {
  const originalExit = process.exit.bind(process);
  process.exit = function exit(code) {
    if (Number(code ?? process.exitCode ?? 0) === 0 && !process.exitCode) { process.exitCode = 0; return; }
    return originalExit(code);
  };
}
