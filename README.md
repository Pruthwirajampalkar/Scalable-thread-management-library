# Thread Manager Library

A scalable thread management library with a modern dashboard UI built using Node.js. This library provides an easy way to manage worker threads with real-time monitoring and control capabilities.

## Features

- Create and manage multiple worker threads
- Real-time monitoring of CPU and memory usage
- Pause/Resume worker threads
- Terminate worker threads
- Modern dashboard UI with real-time updates
- Scalable architecture

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd thread-manager
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## Usage

1. Access the dashboard at `http://localhost:3000`
2. Use the "Create New Worker" button to create worker threads
3. Monitor worker statistics in real-time
4. Use the control buttons to pause, resume, or terminate workers

## API Endpoints

- `POST /api/workers` - Create a new worker
- `DELETE /api/workers/:workerId` - Terminate a worker
- `POST /api/workers/:workerId/pause` - Pause a worker
- `POST /api/workers/:workerId/resume` - Resume a worker

## Architecture

The library consists of three main components:

1. **ThreadManager** - Core thread management functionality
2. **Express Server** - REST API and WebSocket server
3. **Dashboard UI** - Modern interface for monitoring and control

## Dependencies

- Express.js - Web server framework
- Socket.IO - Real-time communication
- Worker Threads - Node.js worker thread implementation
- System Information - System metrics collection
- EJS - Template engine
- Tailwind CSS - UI styling

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT 