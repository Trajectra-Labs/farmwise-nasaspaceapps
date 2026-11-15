// Moen · download helper for the scenario summary (S10). Copy uses the shared copyText from ../rotation.
export function downloadText(filename: string, text: string): boolean {
  try {
    if (typeof URL.createObjectURL !== "function") return false;
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    return true;
  } catch {
    return false;
  }
}
