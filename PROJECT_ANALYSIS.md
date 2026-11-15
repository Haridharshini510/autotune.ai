# AutoTune AI — Project Analysis

> Generated: 2026-11-15 | Branch: `sanjay`

---

## What This Project Is

AutoTune AI is an **automated fine-tuning data generation pipeline**. The core idea: a chatbot (powered by a weak local LLM) talks to users. When users **dislike** a response, the system collects those failed conversations and runs them through a multi-agent LangGraph pipeline that:

1. Analyzes the knowledge gap
2. Searches the web for reference material
3. Generates training questions
4. Produces Q&A training samples
5. Validates the samples for quality
6. Exports to CSV → ingests into ChromaDB → uses RAG to improve future responses

It's a **self-improving chatbot loop**.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND (MISSING)                   │
│  React dashboard expected at localhost:3000/5173            │
└───────────────┬─────────────────────────────────────────────┘
                │ HTTP
┌───────────────▼─────────────────────────────────────────────┐
│                   FastAPI Backend (api/main.py)              │
│  Port: 8000 (uvicorn)                                       │
│                                                             │
│  /chatbot/*     → Chat with weak Ollama model               │
│  /pipeline1/*   → Run LangGraph agent pipeline              │
│  /pipeline2/*   → Ingest CSV into ChromaDB                  │
│  /test/*        → Compare simple vs RAG responses           │
│  /health        → Health check                              │
│  /connectivity  → System status                             │
└───────────────┬─────────────────────────────────────────────┘
                │
    ┌───────────┴─────────────┐
    │                         │
┌───▼───────────┐   ┌────────▼──────────┐
│  Pipeline 1   │   │   Pipeline 2      │
│  (agent_v1/)  │   │   (pipeline/)     │
│               │   │                   │
│ 5 LangGraph   │   │ CSV → ChromaDB    │
│ agents using  │   │ with sentence-    │
│ Gemini API    │   │ transformers      │
│               │   │ embeddings        │
│ Agent1→2→3→   │   │                   │
│ 4→5→CSV       │   │                   │
└───────────────┘   └───────────────────┘
                         │
              ┌──────────▼──────────┐
              │   agent_builder/    │
              │                     │
              │ use_case_call.py    │
              │  → Ollama Qwen 1.5B│
              │  → plain chatbot    │
              │                     │
              │ rag_model.py        │
              │  → Ollama + RAG     │
              │  → ChromaDB search  │
              └─────────────────────┘
```

---

## Folder Structure

```
autotune-ai/
├── .env                          # Environment variables (LEAKED KEYS — must replace)
├── Readme.MD                     # Empty
├── backend/
│   ├── pyproject.toml            # Python dependencies (incomplete)
│   ├── .python-version           # 3.12
│   ├── .gitignore
│   ├── README.md                 # Empty
│   ├── Flow.MD                   # Implementation guide / design doc
│   ├── =4.12.0                   # JUNK FILE — broken pip install artifact
│   ├── zip.zip                   # JUNK — archive of backend code
│   ├── zip/                      # JUNK — extracted duplicate of backend
│   ├── test_case_1.json          # Sample test data
│   │
│   ├── api/                      # FastAPI application
│   │   ├── main.py               # App factory, lifespan, CORS, routers
│   │   └── routes/
│   │       ├── chatbot.py        # Chat, feedback, sessions, disliked export
│   │       ├── pipeline1.py      # Run LangGraph pipeline, get runs/stats
│   │       ├── pipeline2.py      # CSV ingestion into ChromaDB
│   │       └── test.py           # Simple LLM vs RAG comparison
│   │
│   ├── agent_v1/                 # Pipeline 1 — LangGraph multi-agent system
│   │   ├── graph/
│   │   │   ├── states.py         # AutoTuneState TypedDict + Pydantic models
│   │   │   ├── graph.py          # StateGraph assembly, routing, run_pipeline()
│   │   │   └── app.py            # CLI entry point with sample data
│   │   ├── agents/
│   │   │   ├── analyzer.py       # Agent 1: Conversation → topic analysis
│   │   │   ├── link_fetcher.py   # Agent 2: Topics → web search → scrape
│   │   │   ├── question_gen.py   # Agent 3: Content → 10 training questions
│   │   │   ├── sampler.py        # Agent 4: Questions → Q&A training samples
│   │   │   └── validator.py      # Agent 5: Quality validation pass
│   │   ├── prompts/
│   │   │   └── prompts.py        # All 5 agent prompts
│   │   ├── tools/
│   │   │   ├── web_search.py     # DuckDuckGo search + URL scraper
│   │   │   └── filesystem.py     # File read/write/list tools
│   │   ├── hitl/
│   │   │   └── review.py         # Human-in-the-loop (REMOVED from graph, file exists)
│   │   └── export/
│   │       └── csv_writer.py     # CSV export + metrics display
│   │
│   ├── pipeline/                 # Pipeline 2 — CSV ingestion
│   │   ├── ingest_csv.py         # CSV → LangChain Documents → ChromaDB
│   │   └── retriver.py           # Query ChromaDB by batch_id
│   │
│   ├── rag_pipeline/             # Shared RAG infrastructure
│   │   ├── embeddings.py         # EmbeddingPipeline (chunk + embed)
│   │   ├── encoder.py            # Cached SentenceTransformer loader
│   │   └── vector_store.py       # ChromaVectorStore (build, query, search)
│   │
│   ├── agent_builder/            # Chatbot models
│   │   ├── use_case_call.py      # Simple Ollama Qwen 1.5B (no RAG)
│   │   └── rag_model.py          # Ollama + ChromaDB RAG agent
│   │
│   ├── prompts/
│   │   └── prompts_v1.py         # System prompt for chatbot agent
│   │
│   ├── db/                       # Database layer
│   │   ├── config.py             # Tortoise ORM config
│   │   └── models.py             # 4 models: PipelineRun, ChromaIngestion, ChatSession, ChatMessage
│   │
│   ├── migrations/               # Aerich migrations
│   │   └── models/
│   │       └── 0_20260222112157_init.py
│   │
│   ├── outputs/                  # Generated CSV files (9 files from past runs)
│   └── chroma_autotune/          # ChromaDB persistent storage (8 collections)
```

---

## Pipeline 1 Flow (LangGraph)

```
START
  │
  ▼
┌──────────────────┐
│  Agent 1:        │  Input: conversations_text (pre-formatted string)
│  Analyzer        │  Output: TopicAnalysis { is_real_issue, reasoning, topics[] }
│  (Gemini)        │  Decision: skip=true if not a real knowledge gap
└────────┬─────────┘
         │
    ┌────▼────┐
    │ skip?   │──── yes ──→ END (no data generated)
    └────┬────┘
         │ no
         ▼
┌──────────────────┐
│  Agent 2:        │  Input: topics from Agent 1
│  Link Fetcher    │  Actions: DuckDuckGo search → LLM picks best links → scrape URLs
│  (Gemini)        │  Output: LinkBatch { links[] }, scraped_content
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Agent 3:        │  Input: topics + scraped_content
│  Question Gen    │  Output: QuestionSet { questions[10] }
│  (Gemini)        │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Agent 4:        │  Input: questions + topics + scraped content
│  Sampler         │  Processing: sub-batches of 3 questions
│  (Gemini)        │  Output: SampleBatch { samples[] } with id, Q, A, score, topic, url
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Agent 5:        │  Input: all samples from Agent 4
│  Validator       │  Checks: relevance, accuracy, completeness, fabrication, confidence
│  (Gemini)        │  Output: ValidationReport + final_samples[]
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  CSV Export      │  Writes to outputs/{batch_id}_{timestamp}.csv
│  + Metrics       │  Prints rich summary table
└──────────────────┘
         │
         ▼
       END
```

---

## Pipeline 2 Flow (Ingestion)

```
CSV file (from Pipeline 1)
  │
  ▼
┌──────────────────┐
│  Quality Gates   │  Skip rows with: empty Q/A, answer < 50 chars, confidence < 0.4
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Chunking        │  RecursiveCharacterTextSplitter (1000 chars, 200 overlap)
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Embedding       │  SentenceTransformer all-MiniLM-L6-v2 (CPU)
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  ChromaDB        │  PersistentClient → collection named after batch_id
│  Storage         │  Stored in backend/chroma_autotune/
└──────────────────┘
```

---

## Database Schema (PostgreSQL + Tortoise ORM)

### `pipeline_runs`
| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| batch_id | VARCHAR(255) UNIQUE | |
| conversations_text | TEXT | Input to pipeline |
| csv_path | VARCHAR(500) | Path to output CSV |
| final_samples_count | INT | |
| status | VARCHAR(50) | pending / success / failed / no_samples |
| created_at | TIMESTAMPTZ | |

### `chroma_ingestions`
| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| pipeline_run_id | FK → pipeline_runs | CASCADE delete |
| batch_id | VARCHAR(255) | |
| collection_name | VARCHAR(255) | |
| documents_ingested | INT | |
| status | VARCHAR(50) | pending / success / failed |
| created_at | TIMESTAMPTZ | |

### `chat_sessions`
| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| session_id | VARCHAR(50) UNIQUE | Indexed |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |
| is_active | BOOL | |

### `chat_messages`
| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| message_id | VARCHAR(50) UNIQUE | Indexed |
| session_id | FK → chat_sessions | CASCADE delete |
| role | VARCHAR(20) | user / assistant |
| content | TEXT | |
| parent_message_id | VARCHAR(50) | Links AI response to user query |
| liked | BOOL NULLABLE | true=like, false=dislike, null=no feedback |
| model_used | VARCHAR(100) | |
| uses_rag | BOOL | |
| created_at | TIMESTAMPTZ | |

---

## API Endpoints

### Chatbot (`/chatbot`)
| Method | Path | Description |
|---|---|---|
| POST | `/chatbot/chat` | Send message, get AI response |
| POST | `/chatbot/feedback` | Like/dislike a message |
| GET | `/chatbot/history/{session_id}` | Get chat history |
| GET | `/chatbot/sessions` | List all sessions |
| POST | `/chatbot/reset/{session_id}` | Mark session inactive, create new |
| DELETE | `/chatbot/session/{session_id}` | Delete session + messages |
| GET | `/chatbot/feedback/disliked` | Get disliked messages for training |
| GET | `/chatbot/sample-data` | Top 5 disliked conversations |
| GET | `/chatbot/sample-data/paginated` | Paginated disliked conversations |
| POST | `/chatbot/generate-training-data` | Prepare disliked messages for pipeline |
| GET | `/chatbot/stats` | Chat statistics |
| GET | `/chatbot/stats/feedback` | Feedback breakdown (overall, with/without RAG) |

### Pipeline 1 (`/pipeline1`)
| Method | Path | Description |
|---|---|---|
| POST | `/pipeline1/run` | Run LangGraph pipeline |
| GET | `/pipeline1/runs` | List all pipeline runs |
| GET | `/pipeline1/runs/{batch_id}` | Get specific run + CSV data |
| GET | `/pipeline1/stats` | Pipeline statistics |

### Pipeline 2 (`/pipeline2`)
| Method | Path | Description |
|---|---|---|
| POST | `/pipeline2/ingest` | Ingest CSV into ChromaDB |
| GET | `/pipeline2/ingestions` | List all ingestions |
| GET | `/pipeline2/stats` | Ingestion statistics |

### Test (`/test`)
| Method | Path | Description |
|---|---|---|
| POST | `/test/simple` | Simple LLM response (no RAG) |
| POST | `/test/agent` | Agent with RAG response |
| POST | `/test/compare` | Side-by-side comparison |

### System
| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/connectivity` | System component status |

---

## What EXISTS

| Component | Location | Status |
|---|---|---|
| FastAPI server | `api/main.py` | Complete — 4 routers, CORS, Tortoise ORM |
| Pipeline 1 — 5 LangGraph agents | `agent_v1/` | Complete — all 5 agents using Gemini |
| Pipeline 2 — CSV ingestion | `pipeline/` | Complete — CSV → ChromaDB |
| RAG pipeline | `rag_pipeline/` | Complete — embeddings, encoder, vector store |
| Chatbot — simple model | `agent_builder/use_case_call.py` | Complete — Ollama Qwen 2.5 1.5B |
| Chatbot — RAG model | `agent_builder/rag_model.py` | Complete — Ollama + ChromaDB tool |
| Database models | `db/models.py` | Complete — 4 tables |
| DB migrations | `migrations/` | Complete — initial migration |
| Chatbot API routes | `api/routes/chatbot.py` | Complete — full CRUD + feedback + stats |
| Pipeline API routes | `api/routes/pipeline1.py`, `pipeline2.py` | Complete |
| Test/comparison routes | `api/routes/test.py` | Complete |
| CSV outputs | `outputs/` | 9 generated files from past runs |
| ChromaDB data | `chroma_autotune/` | 8 collections with vector data |
| Agent prompts | `agent_v1/prompts/prompts.py` | All 5 agent prompts |
| Chatbot system prompt | `prompts/prompts_v1.py` | Complete |

---

## What DOES NOT Exist / Is Missing

| Component | Impact |
|---|---|
| **Frontend / UI** | No React/Next.js app. CORS configured for it but zero frontend code in repo. |
| **Tests** | Zero test files. No pytest, no integration tests. |
| **Docker / deployment** | No Dockerfile, no docker-compose, no CI/CD. |
| **Authentication** | No auth on any endpoint. Fully open. |
| **Celery / async tasks** | Pipeline runs synchronously inside API request — will timeout on large batches. |
| **HITL via REST** | Human-in-the-loop was removed from the graph. `hitl/review.py` exists as CLI-only but is not wired in. |
| **Requirements lock file** | `uv.lock` is gitignored. Only `pyproject.toml`. |

---

## Discrepancies & Bugs

### 1. Leaked API Keys in `.env`
The `.env` contains GROQ, LangSmith, OpenAI, and Gemini API keys from the original author. These are committed in git history.
- **Fix:** Replace all keys with your own. Rotate the original author's keys if possible.

### 2. Missing `GEMINI_MODEL` in `.env`
All 5 agents read `os.getenv("GEMINI_MODEL")` but the `.env` doesn't define it. Every agent would crash at runtime.
- **Fix:** Add `GEMINI_MODEL=gemini-2.0-flash` (or your chosen model) to `.env`.

### 3. Missing Dependencies in `pyproject.toml`
The code imports these but they're not in dependencies:
- `langgraph` — used by `agent_v1/graph/graph.py`
- `duckduckgo-search` — used by `agent_v1/tools/web_search.py` (only `ddgs` is listed, which is different)
- `pandas` — referenced in Flow.MD but not used in code
- `langchain-text-splitters` — used by `rag_pipeline/embeddings.py`
- **Fix:** Add all missing dependencies to `pyproject.toml`.

### 4. `pysqlite3` Monkey-Patching on Windows
`vector_store.py` and `agent_builder/*.py` do:
```python
__import__('pysqlite3')
sys.modules['sqlite3'] = sys.modules.pop('pysqlite3')
```
This is a Linux workaround for old system SQLite. On Windows it may fail or cause conflicts.
- **Fix:** Make this conditional on platform.

### 5. Validator Skips HITL
The validator reads from `state["sample_batch"]["samples"]` directly — not from `hitl_approved_samples`. The HITL fields in `AutoTuneState` are vestigial (initialized but never written to).
- **Fix:** Either remove HITL fields from state or re-implement HITL as REST endpoints.

### 6. `print_metrics` References Wrong State Key
`csv_writer.py:55` reads `state.get("conversations", [])` but the actual state key is `conversations_text` (a string). "Conversations processed" always shows `0`.
- **Fix:** Update to use `conversations_text` or count conversations by splitting on `---`.

### 7. Pipeline 1 Route CSV Path Bug
`pipeline1.py` calls `run_pipeline()` which internally exports CSV with its own timestamp. Then the route generates a *second* CSV path with a different timestamp and tries to `open()` it — the file doesn't exist at that path.
- **Fix:** Return the CSV path from `run_pipeline()` instead of generating a new one.

### 8. RAG Agent Collection Mismatch
`prompts_v1.py` tells the RAG agent to search collections named `'langchain_docs'`, `'agent_patterns'`, `'code_examples'`. But the actual ChromaDB data is stored in batch-specific collections like `batch-5521`. The agent would always find empty results.
- **Fix:** Auto-discover available collections or maintain a registry.

### 9. `create_agent` Import Compatibility
`rag_model.py` imports `from langchain.agents import create_agent` with middleware classes. This is a very recent LangChain API — may not work with the version constraints in `pyproject.toml`.
- **Fix:** Verify LangChain version compatibility, pin to a working version.

### 10. `ToolRuntime` in web_search.py
`web_search.py` uses `ToolRuntime[SearchContext]` in `@tool` function signatures. This is a newer LangChain feature that may not match installed versions.
- **Fix:** Verify compatibility or simplify to plain function parameters.

### 11. Junk Files in Repo
- `backend/=4.12.0` — artifact from a broken pip install command
- `backend/zip.zip` — archive of the backend
- `backend/zip/` — extracted duplicate of all backend source code
- **Fix:** Delete all three.

---

## External Dependencies Required

| Dependency | Purpose | Notes |
|---|---|---|
| **PostgreSQL** | Database | Must be running at the URL in `.env` |
| **Ollama** | Local LLM | Must have `qwen2.5:1.5b` model pulled |
| **Gemini API Key** | Pipeline agents | All 5 LangGraph agents use Gemini |
| **Python 3.12+** | Runtime | Specified in `.python-version` |
| **SentenceTransformers** | Embeddings | `all-MiniLM-L6-v2` downloaded on first run |

The project does NOT need OpenAI or Groq keys — those are leftovers from earlier versions.

---

## What's Left to Build

### P0 — Critical Fixes (Must Do Before Running)

| Item | Description |
|---|---|
| Replace `.env` keys | Remove leaked keys, add your own Gemini key, add `GEMINI_MODEL` |
| Fix `pyproject.toml` | Add missing: `langgraph`, `duckduckgo-search`, `langchain-text-splitters` |
| Fix Pipeline 1 CSV path bug | Route generates wrong path — use the one from `run_pipeline()` |
| Clean junk files | Delete `=4.12.0`, `zip.zip`, `zip/` |

### P1 — Core Features

| Item | Description |
|---|---|
| Frontend dashboard | React app: chat UI, like/dislike, pipeline trigger, sample review, CSV download, stats |
| Fix RAG collection mismatch | Auto-discover collections or maintain registry |
| Async pipeline execution | Move to background tasks so API doesn't timeout |
| Fix `print_metrics` state key | Use `conversations_text` instead of `conversations` |

### P2 — Important Enhancements

| Item | Description |
|---|---|
| HITL via REST | API endpoints for human review of generated samples |
| Authentication | Basic auth or API keys on endpoints |
| Tests | pytest tests for agents, routes, pipeline |
| Fix `pysqlite3` for Windows | Conditional platform check |

### P3 — Nice to Have

| Item | Description |
|---|---|
| Docker setup | Dockerfile + docker-compose for PostgreSQL + backend |
| CI/CD | GitHub Actions for tests + deploy |
| LangSmith tracing | Already configured in code, just needs valid API key |
| Celery Beat | Scheduled automatic pipeline runs |

---

## Git History

```
8e8b235 latest data
08e6b6b version_3 with full backend frontend & usecase connection
352ae72 version_3 with full backend frontend & usecase connection
3ec5055 changes made to agent logic and removed hitl
91eab80 Initial commit
a090806 updated agent logic and removed hitl
a71439f local model like setup
e1dc64e arch changes
7656007 arch changed
1021a6f v2 version of agents
b03e1fe v0 version has been implmented
4fe73ad minor fixes
4c21bd0 graph base setup initilization
8b18c3b repo initilization
```

Notable: commit `3ec5055` removed HITL from the graph. The frontend mentioned in `08e6b6b` is not present in this repo (likely a separate repo or was removed).
