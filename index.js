const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const ThreadManager = require('./ThreadManager');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const threadManager = new ThreadManager();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
app.get('/', (req, res) => {
    res.render('dashboard');
});

// Thread Pool Endpoints
app.post('/api/pools', async (req, res) => {
    try {
        const poolId = Date.now().toString();
        threadManager.createThreadPool(poolId, req.body.size);
        res.json({ poolId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/pools/:poolId', async (req, res) => {
    try {
        const success = await threadManager.removeThreadPool(req.params.poolId);
        res.json({ success });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/pools/:poolId/pause', async (req, res) => {
    try {
        const success = await threadManager.pauseThreadPool(req.params.poolId);
        res.json({ success });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/pools/:poolId/resume', async (req, res) => {
    try {
        const success = await threadManager.resumeThreadPool(req.params.poolId);
        res.json({ success });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Task Management Endpoints
app.post('/api/tasks', async (req, res) => {
    try {
        const taskId = threadManager.addTask(req.body);
        res.json({ taskId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Socket.IO connection
io.on('connection', (socket) => {
    console.log('Client connected');

    // Send initial data
    const sendInitialData = async () => {
        try {
            const metrics = await threadManager.getPerformanceMetrics();
            socket.emit('metrics', metrics);
            
            const pools = threadManager.getAllPools();
            socket.emit('poolUpdate', pools);
            
            const tasks = threadManager.getAllTasks();
            socket.emit('taskUpdate', tasks);
        } catch (error) {
            console.error('Error sending initial data:', error);
        }
    };

    sendInitialData();

    // Send updates every second
    const interval = setInterval(async () => {
        try {
            const metrics = await threadManager.getPerformanceMetrics();
            socket.emit('metrics', metrics);
            
            const pools = threadManager.getAllPools();
            socket.emit('poolUpdate', pools);
            
            const tasks = threadManager.getAllTasks();
            socket.emit('taskUpdate', tasks);
        } catch (error) {
            console.error('Error sending updates:', error);
        }
    }, 1000);

    socket.on('disconnect', () => {
        console.log('Client disconnected');
        clearInterval(interval);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 