import { SysContainer } from "./sys-container.js";

export function dataDir(name?: string, base?: string | URL): string {
  if (!base) {
    if (SysContainer.runtime().isNodeIsh || SysContainer.runtime().isDeno) {
      base = SysContainer.env.get("FP_STORAGE_URL") || `file://${SysContainer.join(SysContainer.homedir(), ".fireproof")}`;
    } else {
      base = `indexdb://fp`;
    }
  }
  let url: URL;
  if (typeof base === "string") {
    try {
      url = new URL(base.toString());
    } catch (e) {
      try {
        base = `file://${base}`;
        url = new URL(base);
      } catch (e) {
        throw new Error(`invalid base url: ${base}`);
      }
    }
  } else {
    url = base;
  }
  url.searchParams.set("name", name || "");
  return url.toString();
}
