const { parentPort, workerData } = require('worker_threads');

let isPaused = false;

// Handle messages from the main thread
parentPort.on('message', (message) => {
    if (message.type === 'pause') {
        isPaused = true;
    } else if (message.type === 'resume') {
        isPaused = false;
    }
});

// Simulate some work
async function doWork() {
    let count = 0;
    while (true) {
        if (!isPaused) {
            // Simulate CPU-intensive work
            for (let i = 0; i < 1000000; i++) {
                Math.sqrt(i);
            }
            
            count++;
            parentPort.postMessage(`Processed ${count} iterations`);
            
            // Add a small delay to prevent overwhelming the CPU
            await new Promise(resolve => setTimeout(resolve, 100));
        } else {
            // If paused, wait a bit before checking again
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

// Start the work
doWork().catch(error => {
    console.error('Worker error:', error);
    process.exit(1);
}); 