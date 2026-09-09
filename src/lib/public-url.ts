/** Prefix a public-folder path with Vite's base (GitHub Pages lives under /Grok-Ossario/). */
export function publicUrl(path: string): string {
  const base = import.meta.env.BASE_URL || "/";
  return `${base}${path.replace(/^\//, "")}`;
}

export function routerBasepath(): string | undefined {
  const trimmed = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  return trimmed || undefined;
}
