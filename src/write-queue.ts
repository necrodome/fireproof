import { DocTypes, MetaType, DocUpdate } from "./types.js";

type WorkerFunction<T extends DocTypes> = (tasks: DocUpdate<T>[]) => Promise<MetaType>;

export interface WriteQueue<T extends DocTypes> {
  push(task: DocUpdate<T>): Promise<MetaType>;
}

interface WriteQueueItem<T extends DocTypes> {
  readonly task: DocUpdate<T>;
  resolve(result: MetaType): void;
  reject(error: Error): void;
}

export function writeQueue<T extends DocTypes>(worker: WorkerFunction<T>, payload = Infinity, unbounded = false): WriteQueue<T> {
  const queue: WriteQueueItem<T>[] = [];
  let isProcessing = false;

  async function process() {
    if (isProcessing || queue.length === 0) return;
    isProcessing = true;

    const tasksToProcess = queue.splice(0, payload);
    const updates = tasksToProcess.map((item) => item.task);

    if (unbounded) {
      // Run all updates in parallel and resolve/reject them individually
      const promises = updates.map(async (update, index) => {
        try {
          const result = await worker([update]);
          tasksToProcess[index].resolve(result);
        } catch (error) {
          tasksToProcess[index].reject(error as Error);
        }
      });

      await Promise.all(promises);
    } else {
      // Original logic: Run updates in a batch and resolve/reject them together
      try {
        const result = await worker(updates);
        tasksToProcess.forEach((task) => task.resolve(result));
      } catch (error) {
        tasksToProcess.forEach((task) => task.reject(error as Error));
      }
    }

    isProcessing = false;
    void process();
  }

  return {
    push(task: DocUpdate<T>): Promise<MetaType> {
      return new Promise<MetaType>((resolve, reject) => {
        queue.push({ task, resolve, reject });
        void process();
      });
    },
  };
}
