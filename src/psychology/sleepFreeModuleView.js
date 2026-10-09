export function buildFreeModuleView(modules, parseModuleText) {
  if (!Array.isArray(modules) || typeof parseModuleText !== "function") {
    return Object.freeze({ primary: null, preview: null });
  }

  const primaryModule = modules[0] ?? null;
  const secondModule = modules[1] ?? null;
  const primary = primaryModule
    ? Object.freeze({ module: primaryModule, copy: parseModuleText(primaryModule.text) })
    : null;
  let preview = null;

  if (secondModule) {
    const mainText = parseModuleText(secondModule.text).mainText;
    const excerptLength = 190;
    const cutoff = mainText.length > excerptLength ? mainText.lastIndexOf(" ", excerptLength) : mainText.length;
    preview = Object.freeze({
      id: secondModule.id,
      title: secondModule.title,
      excerpt: cutoff > 0 ? `${mainText.slice(0, cutoff)}${cutoff < mainText.length ? "…" : ""}` : "",
    });
  }

  return Object.freeze({ primary, preview });
}
