/* eslint-disable import/first */
// console.log('import store-s3')

import { AnyBlock, AnyLink, DbMeta, DownloadFnParamTypes, LoadHandler, UploadDataFnParams } from './types'
import { Connection } from './connection'
import { DataStore as DataStoreBase, MetaStore as MetaStoreBase } from './store'
import type { Loader } from './loader'
// import type { Response } from 'cross-fetch'

export class RemoteDataStore extends DataStoreBase {
  tag: string = 'car-browser-s3'
  connection: Connection
  type: DownloadFnParamTypes

  constructor(loader: Loader, connection: Connection, type: DownloadFnParamTypes = 'data') {
    super(loader)
    this.connection = connection
    this.type = type
  }

  prefix() {
    return `fp.${this.loader.name}.${this.STORAGE_VERSION}.${this.loader.keyId}`
  }

  async load(carCid: AnyLink): Promise<AnyBlock> {
    const bytes = await this.connection.dataDownload({
      type: this.type,
      name: this.prefix(),
      car: carCid.toString()
    })
    if (!bytes) throw new Error(`missing remote car ${carCid.toString()}`)
    return { cid: carCid, bytes }
  }

  async save(car: AnyBlock) {
    const uploadParams: UploadDataFnParams = {
      type: this.type,
      name: this.prefix(),
      car: car.cid.toString(),
      size: car.bytes.length.toString()
    }
    return await this.connection.dataUpload(car.bytes, uploadParams)
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async remove(_cid: AnyLink): Promise<void> {
    throw new Error('not implemented')
  }
}

export class RemoteMetaStore extends MetaStoreBase {
  tag: string = 'header-browser-ls'
  connection: Connection
  subscribers: Map<string, LoadHandler[]> = new Map()

  constructor(name: string, connection: Connection) {
    super(name)
    this.connection = connection
  }

  onLoad(branch: string, loadHandler: LoadHandler): () => void {
    const subscribers = this.subscribers.get(branch) || []
    subscribers.push(loadHandler)
    this.subscribers.set(branch, subscribers)
    return () => {
      const subscribers = this.subscribers.get(branch) || []
      const idx = subscribers.indexOf(loadHandler)
      if (idx > -1) subscribers.splice(idx, 1)
    }
  }

  prefix() {
    return `fp.${this.name}.${this.STORAGE_VERSION}`
  }

  async load(branch: string = 'main'): Promise<DbMeta[] | null> {
    const byteHeads = await this.connection.metaDownload({
      name: this.prefix(),
      branch
    })
    if (!byteHeads) return null
    const dbMetas = this.dbMetasForByteHeads(byteHeads)
    const subscribers = this.subscribers.get(branch) || []
    for (const subscriber of subscribers) {
      await subscriber(dbMetas)
    }
    return dbMetas
  }

  async save(meta: DbMeta, branch: string = 'main') {
    // console.log('save DbMeta', meta.car.toString())
    const bytes = new TextEncoder().encode(this.makeHeader(meta))
    const byteHeads = await this.connection.metaUpload(bytes, {
      name: this.prefix(),
      branch
    })
    if (!byteHeads) return null
    const dbMetas = this.dbMetasForByteHeads(byteHeads)
    const subscribers = this.subscribers.get(branch) || []
    for (const subscriber of subscribers) {
      await subscriber(dbMetas)
    }
    return dbMetas
  }

  dbMetasForByteHeads(byteHeads: Uint8Array[]) {
    return byteHeads.map((bytes) => {
      const txt = new TextDecoder().decode(bytes)
      return this.parseHeader(txt)
    })
  }
}
