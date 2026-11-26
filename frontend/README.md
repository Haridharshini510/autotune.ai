# AutoTune AI - Frontend

Clean, modern interface for the AutoTune AI self-improving chatbot system.

## Features

- **Dual-pane layout**: Friendly chat on the left, technical pipeline dashboard on the right
- **Real-time feedback**: Like/dislike buttons for immediate response rating
- **Pipeline controls**: Trigger training data generation directly from the UI
- **Live stats**: Monitor pipeline runs and training samples
- **Responsive**: Works on desktop and mobile

## Setup

### Prerequisites

- Node.js 18+ installed
- Backend running on `http://localhost:8000`

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend will be available at `http://localhost:3000`

## Usage

1. **Chat**: Type a message and press Enter or click Send
2. **Provide feedback**: Click 👍 for good responses, 👎 for bad ones
3. **Run pipeline**: When you have disliked messages, click "Generate Training Data"
4. **Watch improvement**: The bot gets smarter as training data is generated!

## Architecture

- **React 18** with TypeScript
- **Vite** for fast development and building
- **CSS** (no framework - clean, custom styles)
- **Proxy** to backend API (configured in vite.config.ts)

## API Integration

All API calls are proxied through Vite to avoid CORS issues:
- `/chatbot/*` → Chat and feedback endpoints
- `/pipeline1/*` → Training pipeline
- `/pipeline2/*` → ChromaDB ingestion
- `/test/*` → Testing endpoints

## Build for Production

```bash
npm run build
```

Built files will be in the `dist/` directory.
