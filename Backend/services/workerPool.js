import { Worker } from 'worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Worker pool for CPU-intensive tasks
 * Prevents blocking the main thread
 */

class WorkerPool {
  constructor(workerScript, poolSize = 4) {
    this.workerScript = workerScript;
    this.poolSize = poolSize;
    this.workers = [];
    this.queue = [];
    this.activeWorkers = new Set();
    
    this.initPool();
  }

  initPool() {
    for (let i = 0; i < this.poolSize; i++) {
      const worker = new Worker(this.workerScript);
      
      worker.on('message', (result) => {
        this.activeWorkers.delete(worker);
        
        if (this.queue.length > 0) {
          const { task, resolve, reject } = this.queue.shift();
          this.executeTask(worker, task, resolve, reject);
        }
      });

      worker.on('error', (error) => {
        this.activeWorkers.delete(worker);
        console.error('❌ Worker error:', error);
      });

      this.workers.push(worker);
    }
  }

  executeTask(worker, task, resolve, reject) {
    this.activeWorkers.add(worker);
    
    worker.once('message', resolve);
    worker.once('error', reject);
    
    worker.postMessage(task);
  }

  async run(task) {
    return new Promise((resolve, reject) => {
      const availableWorker = this.workers.find(w => !this.activeWorkers.has(w));

      if (availableWorker) {
        this.executeTask(availableWorker, task, resolve, reject);
      } else {
        this.queue.push({ task, resolve, reject });
      }
    });
  }

  terminate() {
    this.workers.forEach(worker => worker.terminate());
    this.workers = [];
    this.queue = [];
  }
}

/**
 * Heavy computation worker
 */
export async function initWorkerPool() {
  const computeWorker = new WorkerPool(
    path.join(__dirname, '../services/computeWorker.js'),
    4 // Number of worker threads
  );

  return {
    /**
     * Process data transformation
     */
    async transformData(data, transformation) {
      return computeWorker.run({ type: 'transform', data, transformation });
    },

    /**
     * Process aggregations
     */
    async aggregateData(data, aggregation) {
      return computeWorker.run({ type: 'aggregate', data, aggregation });
    },

    /**
     * Process heavy calculations
     */
    async calculate(data, operation) {
      return computeWorker.run({ type: 'calculate', data, operation });
    },

    terminate: () => computeWorker.terminate()
  };
}

/**
 * Lightweight async task processor (no threads, just promises)
 */
export class AsyncTaskProcessor {
  constructor(concurrency = 5) {
    this.concurrency = concurrency;
    this.running = 0;
    this.queue = [];
  }

  async add(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.process();
    });
  }

  async process() {
    if (this.running >= this.concurrency || this.queue.length === 0) {
      return;
    }

    this.running++;
    const { task, resolve, reject } = this.queue.shift();

    try {
      const result = await task();
      resolve(result);
    } catch (error) {
      reject(error);
    }

    this.running--;
    this.process();
  }
}

/**
 * Batch processor with progress tracking
 */
export async function processBatchWithProgress(items, batchSize, processor, onProgress) {
  const results = [];
  const total = items.length;
  let processed = 0;

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processor));
    
    results.push(...batchResults);
    processed += batch.length;

    if (onProgress) {
      onProgress({
        processed,
        total,
        percentage: Math.round((processed / total) * 100)
      });
    }
  }

  return results;
}
