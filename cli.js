#!/usr/bin/env node
import fs from 'fs'
import os from 'os'
import path from 'path'
import { Readable } from 'stream'
import sade from 'sade'
import { CID } from 'multiformats/cid'
import { CarIndexedReader, CarReader, CarWriter } from '@ipld/car'
import clc from 'cli-color'
import { MaxShardSize, put, ShardBlock, get } from './index.js'
import { tree } from './vis.js'

const cli = sade('pail')

cli.command('put <key> <value>')
  .describe('Put a key to the bucket')
  .option('--max-shard-size', 'Maximum shard size in bytes.', MaxShardSize)
  .action(async (key, value, opts) => {
    const blocks = await openBucket()
    const maxShardSize = opts['max-shard-size'] ?? MaxShardSize
    // @ts-expect-error
    const { root, additions, removals } = await put(blocks, (await blocks.getRoots())[0], key, CID.parse(value), { maxShardSize })
    await updateBucket(blocks, root, { additions, removals })

    console.log('Root:')
    console.log(clc.cyan(`  ${root}`))
    console.log('Additions:')
    additions.forEach(b => console.log(clc.green(`  ${b.cid}`)))
    console.log('Removals:')
    removals.forEach(b => console.log(clc.red(`  ${b.cid}`)))
    console.log('\n---\n')

    // @ts-expect-error
    await tree(root, await openBucket(), additions)
  })

cli.command('get <key>')
  .describe('Get a value from the bucket')
  .action(async (key) => {
    const blocks = await openBucket()
    // @ts-expect-error
    const value = await get(blocks, (await blocks.getRoots())[0], key)
    if (value) console.log(value.toString())
  })

cli.command('vis')
  .describe('Visualise the bucket')
  .action(async () => {
    const blocks = await openBucket()
    // @ts-expect-error
    await tree((await blocks.getRoots())[0], blocks)
  })

cli.parse(process.argv)

/** @returns {Promise<import('@ipld/car/api').CarReader>} */
async function openBucket () {
  try {
    return await CarIndexedReader.fromFile('./pail.car')
  } catch (err) {
    if (err.code !== 'ENOENT') throw new Error('failed to open bucket', { cause: err })
    const rootblk = await ShardBlock.create()
    const { writer, out } = CarWriter.create(rootblk.cid)
    writer.put(rootblk)
    writer.close()
    return CarReader.fromIterable(out)
  }
}

/**
 * @param {import('@ipld/car/api').CarReader} reader
 * @param {import('./shard').ShardLink} root
 * @param {import('.').ShardDiff} diff
 */
async function updateBucket (reader, root, { additions, removals }) {
  // @ts-expect-error
  const { writer, out } = CarWriter.create(root)
  const tmp = path.join(os.tmpdir(), `pail${Date.now()}.car`)

  const finishPromise = new Promise(resolve => {
    Readable.from(out).pipe(fs.createWriteStream(tmp)).on('finish', resolve)
  })

  // put new blocks
  for (const b of additions) {
    await writer.put(b)
  }
  // put old blocks without removals
  for await (const b of reader.blocks()) {
    if (removals.some(r => b.cid.toString() === r.cid.toString())) {
      continue
    }
    await writer.put(b)
  }
  await writer.close()
  await finishPromise

  const old = `./pail.car-${new Date().toISOString()}`
  try {
    await fs.promises.rename('./pail.car', old)
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }
  await fs.promises.rename(tmp, './pail.car')
  try {
    await fs.promises.rm(old)
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }
}
