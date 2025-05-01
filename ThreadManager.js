const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const si = require('systeminformation');

class ThreadManager {
    constructor() {
        this.workers = new Map();
        this.workerStats = new Map();
        this.threadPools = new Map();
        this.tasks = new Map();
        this.taskQueue = [];
    }

    // Thread Pool Management
    createThreadPool(poolId, size = 4) {
        if (this.threadPools.has(poolId)) {
            throw new Error('Pool already exists');
        }

        const pool = {
            workers: [],
            size,
            status: 'running',
            tasks: []
        };
        
        for (let i = 0; i < size; i++) {
            const workerId = this.createWorker('./src/workers/poolWorker.js', { poolId });
            pool.workers.push(workerId);
        }
        
        this.threadPools.set(poolId, pool);
        return poolId;
    }

    async removeThreadPool(poolId) {
        const pool = this.threadPools.get(poolId);
        if (pool) {
            for (const workerId of pool.workers) {
                await this.terminateWorker(workerId);
            }
            this.threadPools.delete(poolId);
            return true;
        }
        return false;
    }

    async pauseThreadPool(poolId) {
        const pool = this.threadPools.get(poolId);
        if (pool) {
            pool.status = 'paused';
            for (const workerId of pool.workers) {
                await this.pauseWorker(workerId);
            }
            return true;
        }
        return false;
    }

    async resumeThreadPool(poolId) {
        const pool = this.threadPools.get(poolId);
        if (pool) {
            pool.status = 'running';
            for (const workerId of pool.workers) {
                await this.resumeWorker(workerId);
            }
            this.processTaskQueue(); // Resume processing tasks
            return true;
        }
        return false;
    }

    // Task Management
    addTask(task) {
        const taskId = Date.now().toString();
        const taskWithId = {
            ...task,
            id: taskId,
            status: 'queued',
            priority: task.priority || 'normal',
            result: null,
            startTime: null,
            endTime: null
        };
        
        this.tasks.set(taskId, taskWithId);
        this.taskQueue.push(taskId);
        this.processTaskQueue();
        return taskId;
    }

    async processTaskQueue() {
        if (this.taskQueue.length === 0) return;

        const availablePools = Array.from(this.threadPools.entries())
            .filter(([_, pool]) => pool.status === 'running' && pool.tasks.length < pool.size);

        if (availablePools.length > 0) {
            const taskId = this.taskQueue.shift();
            const task = this.tasks.get(taskId);
            const [poolId, pool] = availablePools[0];

            task.status = 'running';
            task.startTime = Date.now();
            pool.tasks.push(taskId);

            const workerId = pool.workers[pool.tasks.length - 1];
            const worker = this.workers.get(workerId);
            
            if (worker) {
                worker.postMessage({
                    type: 'execute',
                    task: task
                });

                // Update worker stats
                const stats = this.workerStats.get(workerId);
                if (stats) {
                    stats.status = 'running';
                    stats.currentTask = taskId;
                }
            }
        }
    }

    // Worker Management
    async createWorker(workerScript, workerData = {}) {
        const worker = new Worker(workerScript, { workerData });
        const workerId = Date.now().toString();
        
        this.workers.set(workerId, worker);
        this.workerStats.set(workerId, {
            status: 'idle',
            startTime: Date.now(),
            cpuUsage: 0,
            memoryUsage: 0,
            currentTask: null,
            tasksCompleted: 0
        });

        worker.on('message', async (message) => {
            if (message.type === 'taskComplete') {
                const task = this.tasks.get(message.taskId);
                if (task) {
                    task.status = 'completed';
                    task.result = message.result;
                    task.endTime = Date.now();
                    
                    // Update pool tasks
                    const pool = Array.from(this.threadPools.values())
                        .find(p => p.workers.includes(workerId));
                    if (pool) {
                        pool.tasks = pool.tasks.filter(id => id !== message.taskId);
                    }
                    
                    // Update worker stats
                    const stats = this.workerStats.get(workerId);
                    if (stats) {
                        stats.tasksCompleted++;
                        stats.currentTask = null;
                        stats.status = 'idle';
                    }

                    // Process next task
                    await this.processTaskQueue();
                }
            } else if (message.type === 'status') {
                const stats = this.workerStats.get(workerId);
                if (stats) {
                    stats.status = message.status;
                    if (message.taskId) {
                        stats.currentTask = message.taskId;
                    }
                }
            }
        });

        worker.on('error', (error) => {
            console.error(`Worker ${workerId} error:`, error);
            this.workerStats.get(workerId).status = 'error';
        });

        worker.on('exit', (code) => {
            console.log(`Worker ${workerId} exited with code ${code}`);
            this.workerStats.get(workerId).status = 'stopped';
        });

        return workerId;
    }

    async terminateWorker(workerId) {
        const worker = this.workers.get(workerId);
        if (worker) {
            await worker.terminate();
            this.workers.delete(workerId);
            this.workerStats.delete(workerId);
            return true;
        }
        return false;
    }

    async getWorkerStats(workerId) {
        const stats = this.workerStats.get(workerId);
        if (stats) {
            try {
                const processStats = await si.processes();
                const workerProcess = processStats.list.find(p => p.pid === this.workers.get(workerId).threadId);
                
                if (workerProcess) {
                    stats.cpuUsage = workerProcess.cpu;
                    stats.memoryUsage = workerProcess.mem;
                }
            } catch (error) {
                console.error('Error getting process stats:', error);
                // Keep existing stats if we can't get new ones
            }
            
            return stats;
        }
        return null;
    }

    async getAllWorkerStats() {
        const stats = {};
        for (const [workerId, worker] of this.workers.entries()) {
            stats[workerId] = await this.getWorkerStats(workerId);
        }
        return stats;
    }

    async pauseWorker(workerId) {
        const worker = this.workers.get(workerId);
        if (worker) {
            worker.postMessage({ type: 'pause' });
            this.workerStats.get(workerId).status = 'paused';
            return true;
        }
        return false;
    }

    async resumeWorker(workerId) {
        const worker = this.workers.get(workerId);
        if (worker) {
            worker.postMessage({ type: 'resume' });
            this.workerStats.get(workerId).status = 'running';
            return true;
        }
        return false;
    }

    // Performance Metrics
    async getPerformanceMetrics() {
        const metrics = {
            activeThreads: 0,
            totalThreads: this.workers.size,
            cpuUsage: 0,
            memoryUsage: 0,
            tasksCompleted: 0,
            tasksQueued: this.taskQueue.length,
            tasksRunning: 0
        };

        // Get latest worker stats
        const workerStats = await this.getAllWorkerStats();

        for (const [_, stats] of Object.entries(workerStats)) {
            if (stats && (stats.status === 'running' || stats.status === 'idle')) {
                metrics.activeThreads++;
                metrics.cpuUsage += stats.cpuUsage || 0;
                metrics.memoryUsage += stats.memoryUsage || 0;
                metrics.tasksCompleted += stats.tasksCompleted || 0;
                if (stats.currentTask) {
                    metrics.tasksRunning++;
                }
            }
        }

        // Calculate average CPU usage
        if (metrics.activeThreads > 0) {
            metrics.cpuUsage = metrics.cpuUsage / metrics.activeThreads;
        }

        return metrics;
    }

    // Get all tasks
    getAllTasks() {
        return Object.fromEntries(this.tasks);
    }

    // Get all pools
    getAllPools() {
        return Object.fromEntries(this.threadPools);
    }
}

module.exports = ThreadManager; 