const { parentPort, workerData } = require('worker_threads');
const si = require('systeminformation');

let isPaused = false;
let currentTask = null;

// Listen for messages from the main thread
parentPort.on('message', async (message) => {
    if (message.type === 'pause') {
        isPaused = true;
        parentPort.postMessage({ type: 'status', status: 'paused', taskId: currentTask?.id });
    } else if (message.type === 'resume') {
        isPaused = false;
        parentPort.postMessage({ type: 'status', status: 'running', taskId: currentTask?.id });
    } else if (message.type === 'execute') {
        currentTask = message.task;
        parentPort.postMessage({ type: 'status', status: 'running', taskId: currentTask.id });
        await executeTask(currentTask);
    }
});

async function executeTask(task) {
    if (isPaused) {
        parentPort.postMessage({ type: 'status', status: 'paused', taskId: task.id });
        return;
    }

    try {
        let result;
        if (task.type === 'math') {
            result = eval(task.expression);
        } else if (task.type === 'custom') {
            const fn = new Function('return ' + task.function)();
            result = await fn();
        }

        // Send task completion message
        parentPort.postMessage({
            type: 'taskComplete',
            taskId: task.id,
            result: result
        });

        // Update status to idle
        parentPort.postMessage({ type: 'status', status: 'idle', taskId: null });
        currentTask = null;
    } catch (error) {
        parentPort.postMessage({
            type: 'taskComplete',
            taskId: task.id,
            error: error.message
        });
        parentPort.postMessage({ type: 'status', status: 'idle', taskId: null });
        currentTask = null;
    }
}

// Send initial status
parentPort.postMessage({ type: 'status', status: 'idle', taskId: null }); 