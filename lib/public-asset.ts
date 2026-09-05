/** Public assets also work beneath a GitHub Pages repository path. */
export function publicAsset(path: string) {
  return (process.env.NEXT_PUBLIC_BASE_PATH || '') + path;
}
