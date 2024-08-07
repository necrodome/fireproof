import { describe, it, expect, beforeAll } from "vitest";
import { fireproof, rt } from "@fireproof/core";

describe("runtime", () => {
  it("runtime", () => {
    const isNode = !!(typeof process === "object" && process.versions?.node);
    expect(rt.SysContainer.runtime()).toEqual({
      isBrowser: !isNode,
      isDeno: false,
      isNodeIsh: isNode,
      isReactNative: false,
    });
  });
});

describe("fireproof/config", () => {
  let _my_app = "my-app";
  function my_app() {
    return _my_app;
  }
  beforeAll(async () => {
    await rt.SysContainer.start();
    if (rt.SysContainer.runtime().isNodeIsh) {
      const fpStorageUrl = rt.SysContainer.env.get("FP_STORAGE_URL");
      if (fpStorageUrl) {
        let url: URL;
        try {
          url = new URL(fpStorageUrl);
        } catch (e) {
          url = new URL(`file://${fpStorageUrl}`);
        }
        _my_app = `my-app-${url.protocol.replace(/:$/, "")}`;
      }
    }
  });

  if (!rt.SysContainer.runtime().isNodeIsh) {
    it("default", async () => {
      const db = fireproof(my_app());
      await db.put({ name: "my-app" });
      expect(db.name).toBe(my_app());
      const carStore = await db.blockstore.loader?.carStore();
      expect(carStore?.url.toString()).toMatch(new RegExp(`indexdb://fp\\?name=my-app&store=data&version=${rt.INDEXDB_VERSION}`));
      const fileStore = await db.blockstore.loader?.fileStore();
      expect(fileStore?.url.toString()).toMatch(new RegExp(`indexdb://fp\\?name=my-app&store=data&version=${rt.INDEXDB_VERSION}`));
      const metaStore = await db.blockstore.loader?.metaStore();
      expect(metaStore?.url.toString()).toMatch(new RegExp(`indexdb://fp\\?name=my-app&store=meta&version=${rt.INDEXDB_VERSION}`));
      await db.close();
    });
    return;
  }
  it("node default", async () => {
    const old = rt.SysContainer.env.get("FP_STORAGE_URL");
    rt.SysContainer.env.del("FP_STORAGE_URL");
    let baseDir = rt
      .dataDir(my_app())
      .replace(/\?.*$/, "")
      .replace(/^file:\/\//, "");
    baseDir = rt.SysContainer.join(baseDir, rt.FILESTORE_VERSION, my_app());
    await rt.SysContainer.rm(baseDir, { recursive: true }).catch(() => {
      /* */
    });

    expect(baseDir).toMatch(new RegExp(`/\\.fireproof/${rt.FILESTORE_VERSION}/${my_app()}`));

    const db = fireproof(my_app());
    await db.put({ name: "my-app" });
    expect(db.name).toBe(my_app());
    const carStore = await db.blockstore.loader?.carStore();

    expect(carStore?.url.toString()).toMatch(
      new RegExp(`file:.*\\/\\.fireproof\\?name=${my_app()}&store=data&version=${rt.FILESTORE_VERSION}`),
    );
    expect((await rt.SysContainer.stat(rt.SysContainer.join(baseDir, "data"))).isDirectory()).toBeTruthy();

    const fileStore = await db.blockstore.loader?.fileStore();
    expect(fileStore?.url.toString()).toMatch(
      new RegExp(`file:.*\\/\\.fireproof\\?name=${my_app()}&store=data&version=${rt.FILESTORE_VERSION}`),
    );
    const metaStore = await db.blockstore.loader?.metaStore();
    expect(metaStore?.url.toString()).toMatch(
      new RegExp(`file:.*\\/\\.fireproof\\?name=${my_app()}&store=meta&version=${rt.FILESTORE_VERSION}`),
    );
    expect((await rt.SysContainer.stat(rt.SysContainer.join(baseDir, "meta"))).isDirectory()).toBeTruthy();
    rt.SysContainer.env.set("FP_STORAGE_URL", old);
    await db.close();
  });

  it("set by env", async () => {
    const old = rt.SysContainer.env.get("FP_STORAGE_URL");
    rt.SysContainer.env.set("FP_STORAGE_URL", "./dist/env");

    let baseDir = rt
      .dataDir(my_app())
      .replace(/\?.*$/, "")
      .replace(/^file:\/\//, "");
    baseDir = rt.SysContainer.join(baseDir, rt.FILESTORE_VERSION, my_app());
    await rt.SysContainer.rm(baseDir, { recursive: true }).catch(() => {
      /* */
    });

    const db = fireproof(my_app());
    await db.put({ name: "my-app" });
    expect(db.name).toBe(my_app());
    const carStore = await db.blockstore.loader?.carStore();
    expect(carStore?.url.toString()).toMatch(
      new RegExp(`file://\\./dist/env\\?name=${my_app()}&store=data&version=${rt.FILESTORE_VERSION}`),
    );
    expect((await rt.SysContainer.stat(rt.SysContainer.join(baseDir, "data"))).isDirectory()).toBeTruthy();
    const fileStore = await db.blockstore.loader?.fileStore();
    expect(fileStore?.url.toString()).toMatch(
      new RegExp(`file://\\./dist/env\\?name=${my_app()}&store=data&version=${rt.FILESTORE_VERSION}`),
    );
    const metaStore = await db.blockstore.loader?.metaStore();
    expect(metaStore?.url.toString()).toMatch(
      new RegExp(`file://\\./dist/env\\?name=${my_app()}&store=meta&version=${rt.FILESTORE_VERSION}`),
    );
    expect((await rt.SysContainer.stat(rt.SysContainer.join(baseDir, "meta"))).isDirectory()).toBeTruthy();
    await db.close();
    rt.SysContainer.env.set("FP_STORAGE_URL", old);
  });

  it("file path", async () => {
    let baseDir = "./dist/data".replace(/\?.*$/, "").replace(/^file:\/\//, "");
    baseDir = rt.SysContainer.join(baseDir, rt.FILESTORE_VERSION, my_app());
    await rt.SysContainer.rm(baseDir, { recursive: true }).catch(() => {
      /* */
    });

    const db = fireproof(my_app(), {
      store: {
        stores: {
          base: "./dist/data",
        },
      },
    });
    // console.log(`>>>>>>>>>>>>>>>file-path`)
    await db.put({ name: "my-app" });
    expect(db.name).toBe(my_app());
    const carStore = await db.blockstore.loader?.carStore();
    expect(carStore?.url.toString()).toMatch(
      new RegExp(`file://.\\/dist\\/data\\?name=${my_app()}&store=data&version=${rt.FILESTORE_VERSION}`),
    );
    const fileStore = await db.blockstore.loader?.fileStore();
    expect(fileStore?.url.toString()).toMatch(
      new RegExp(`file://.\\/dist\\/data\\?name=${my_app()}&store=data&version=${rt.FILESTORE_VERSION}`),
    );
    expect((await rt.SysContainer.stat(rt.SysContainer.join(baseDir, "data"))).isDirectory()).toBeTruthy();
    const metaStore = await db.blockstore.loader?.metaStore();
    expect(metaStore?.url.toString()).toMatch(
      new RegExp(`file://.\\/dist\\/data\\?name=${my_app()}&store=meta&version=${rt.FILESTORE_VERSION}`),
    );
    expect((await rt.SysContainer.stat(rt.SysContainer.join(baseDir, "meta"))).isDirectory()).toBeTruthy();
    await db.close();
  });
});
