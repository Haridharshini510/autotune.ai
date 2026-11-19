# AutoTune AI — Implementation Guide

> Steps to get this project running independently, without the original author's keys or dependencies.

---

## Prerequisites

You need these installed on your machine before starting:

| Tool | Version | Check Command | Install |
|---|---|---|---|
| Python | 3.12+ | `python --version` | python.org |
| PostgreSQL | 14+ | `psql --version` | postgresql.org |
| Ollama | latest | `ollama --version` | ollama.com |
| Git | any | `git --version` | already installed |
| uv (recommended) | latest | `uv --version` | `pip install uv` |

---

## Step 1: Fix Git Upstream

Your local branch lost its upstream after the rename. Run:

```bash
git branch --set-upstream-to=origin/master master
```

---

## Step 2: Clean Junk Files

These files are artifacts from the original author and should be removed:

```bash
# Broken pip install artifact
rm backend/=4.12.0

# Duplicate archive of the entire backend
rm backend/zip.zip
rm -rf backend/zip/
```

---

## Step 3: Create Your `.env` File

The original `.env` at `backend/.env` has the previous author's API keys. Replace the entire file with your own credentials.

**File: `backend/.env`**

```env
# ═══════════════════════════════════════════════════════
# REQUIRED — Pipeline 1 (LangGraph agents use Gemini)
# ═══════════════════════════════════════════════════════

# Get from: https://aistudio.google.com/apikey
GEMINI_API_KEY=your-gemini-api-key-here

# Model used by all 5 pipeline agents
# Options: gemini-2.0-flash, gemini-1.5-flash, gemini-1.5-pro
GEMINI_MODEL=gemini-2.0-flash

# ═══════════════════════════════════════════════════════
# REQUIRED — Database
# ═══════════════════════════════════════════════════════

# Format: postgres://USER:PASSWORD@HOST:PORT/DBNAME
DATABASE_URL=postgres://your_user:your_password@localhost:5432/autotune_db

# ═══════════════════════════════════════════════════════
# OPTIONAL — LangSmith Tracing (for debugging agent runs)
# ═══════════════════════════════════════════════════════

# Get from: https://smith.langchain.com/settings
# LANGSMITH_TRACING=true
# LANGSMITH_API_KEY=your-langsmith-key-here
# LANGSMITH_PROJECT=autotune-ai
```

### How to get each key:

1. **GEMINI_API_KEY**
   - Go to https://aistudio.google.com/apikey
   - Sign in with Google
   - Click "Create API Key"
   - Copy the key (starts with `AIza...`)

2. **DATABASE_URL**
   - You'll create this in Step 4 below

3. **LANGSMITH_API_KEY** (optional, for tracing)
   - Go to https://smith.langchain.com
   - Sign up / sign in
   - Go to Settings → API Keys → Create

### Keys you do NOT need:

| Key | Why Not Needed |
|---|---|
| `GROQ_API_KEY` | Not used anywhere in the code |
| `OPENAI_API_KEY` | Original code used OpenAI, current code uses Gemini |
| `GOOGLE_API_KEY` | The code reads `GEMINI_API_KEY` instead |

---

## Step 4: Set Up PostgreSQL Database

### 4a. Start PostgreSQL

Make sure PostgreSQL is running. On Windows, check Services or:

```bash
pg_isready
```

### 4b. Create the database and user

Open a terminal and connect to PostgreSQL:

```bash
psql -U postgres
```

Then run these SQL commands (replace `your_user` and `your_password` with what you want):

```sql
CREATE USER your_user WITH PASSWORD 'your_password';
CREATE DATABASE autotune_db OWNER your_user;
GRANT ALL PRIVILEGES ON DATABASE autotune_db TO your_user;
\q
```

### 4c. Verify connection

```bash
psql -U your_user -d autotune_db -h localhost
```

If it connects, your `DATABASE_URL` is:
```
postgres://your_user:your_password@localhost:5432/autotune_db
```

Put this in your `backend/.env`.

---

## Step 5: Fix `pyproject.toml` Dependencies

The original `pyproject.toml` is missing several packages the code actually imports. Replace the `dependencies` list in `backend/pyproject.toml`:

**Open `backend/pyproject.toml` and replace the `[project]` section with:**

```toml
[project]
name = "autotune-ai"
version = "0.1.0"
description = "AutoTune AI — self-improving chatbot with LangGraph multi-agent pipeline"
readme = "README.md"
requires-python = ">=3.12"
dependencies = [
    # ── Web Framework ──
    "fastapi>=0.115.0",
    "uvicorn>=0.34.0",

    # ── Database ──
    "tortoise-orm==0.20.0",
    "asyncpg>=0.31.0",
    "aerich==0.7.2",

    # ── LangGraph + LangChain (Pipeline 1) ──
    "langgraph>=0.2.0",
    "langchain>=0.3.0",
    "langchain-community>=0.3.0",
    "langchain-google-genai>=2.0.0",
    "langchain-ollama>=0.3.0",
    "langchain-huggingface>=0.1.0",
    "langchain-text-splitters>=0.3.0",

    # ── Web Search & Scraping (Pipeline 1 Agent 2) ──
    "duckduckgo-search>=6.0.0",
    "beautifulsoup4>=4.12.0",
    "requests>=2.32.0",

    # ── Vector Store (Pipeline 2) ──
    "chromadb>=0.5.0",
    "sentence-transformers>=3.0.0",

    # ── Utilities ──
    "python-dotenv>=1.0.0",
    "rich>=13.0.0",
    "tomlkit>=0.13.0",

    # ── SQLite fix for ChromaDB (Linux only, see note) ──
    # "pysqlite3-binary>=0.5.4",
]
```

> **Note on `pysqlite3-binary`:** This package is commented out because it's a Linux workaround. On Windows, the system SQLite works fine. If you later deploy to Linux and ChromaDB complains about SQLite version, uncomment it.

Keep the `[tool.aerich]` section unchanged:

```toml
[tool.aerich]
tortoise_orm = "db.config.TORTOISE_ORM"
location = "./migrations"
src_folder = "./."
```

---

## Step 6: Install Python Dependencies

```bash
cd backend

# Create virtual environment (if not already)
python -m venv .venv

# Activate it
# Windows PowerShell:
.venv\Scripts\Activate.ps1
# Windows cmd:
.venv\Scripts\activate.bat
# Linux/Mac:
source .venv/bin/activate

# Install dependencies
pip install -e .

# OR if using uv (faster):
uv pip install -e .
```

### Verify key imports work:

```bash
python -c "import langgraph; print('langgraph OK')"
python -c "import langchain_google_genai; print('langchain-google-genai OK')"
python -c "import chromadb; print('chromadb OK')"
python -c "import fastapi; print('fastapi OK')"
python -c "import tortoise; print('tortoise OK')"
python -c "from duckduckgo_search import DDGS; print('duckduckgo-search OK')"
```

All should print "OK". If any fail, install them individually:
```bash
pip install <package-name>
```

---

## Step 7: Fix the `pysqlite3` Issue on Windows

Three files monkey-patch `pysqlite3` which breaks on Windows. You need to make it conditional.

### File 1: `backend/rag_pipeline/vector_store.py`

**Replace the first 3 lines:**

```python
__import__('pysqlite3')
import sys
sys.modules['sqlite3'] = sys.modules.pop('pysqlite3')
```

**With:**

```python
import sys
if sys.platform == "linux":
    __import__('pysqlite3')
    sys.modules['sqlite3'] = sys.modules.pop('pysqlite3')
```

### File 2: `backend/agent_builder/use_case_call.py`

**Replace the first 3 lines:**

```python
__import__("pysqlite3")
import sys
sys.modules["sqlite3"] = sys.modules.pop("pysqlite3")
```

**With:**

```python
import sys
if sys.platform == "linux":
    __import__("pysqlite3")
    sys.modules["sqlite3"] = sys.modules.pop("pysqlite3")
```

### File 3: `backend/agent_builder/rag_model.py`

**Replace the first 3 lines:**

```python
__import__('pysqlite3')
import sys
sys.modules['sqlite3'] = sys.modules.pop('pysqlite3')
```

**With:**

```python
import sys
if sys.platform == "linux":
    __import__('pysqlite3')
    sys.modules['sqlite3'] = sys.modules.pop('pysqlite3')
```

---

## Step 8: Run Database Migrations

```bash
cd backend

# Initialize Aerich (only needed once)
aerich init -t db.config.TORTOISE_ORM

# Run migrations to create tables
aerich upgrade
```

If `aerich upgrade` fails, you can create the tables manually:

```bash
psql -U your_user -d autotune_db
```

Then paste the SQL from `backend/migrations/models/0_20260222112157_init.py`:

```sql
CREATE TABLE IF NOT EXISTS "chat_sessions" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "session_id" VARCHAR(50) NOT NULL UNIQUE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOL NOT NULL DEFAULT True
);
CREATE INDEX IF NOT EXISTS "idx_chat_sessio_session_a5c17d" ON "chat_sessions" ("session_id");

CREATE TABLE IF NOT EXISTS "chat_messages" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "message_id" VARCHAR(50) NOT NULL UNIQUE,
    "role" VARCHAR(20) NOT NULL,
    "content" TEXT NOT NULL,
    "parent_message_id" VARCHAR(50),
    "liked" BOOL,
    "model_used" VARCHAR(100),
    "uses_rag" BOOL NOT NULL DEFAULT False,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "session_id" INT NOT NULL REFERENCES "chat_sessions" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_chat_messag_message_7a269e" ON "chat_messages" ("message_id");

CREATE TABLE IF NOT EXISTS "pipeline_runs" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "batch_id" VARCHAR(255) NOT NULL UNIQUE,
    "conversations_text" TEXT NOT NULL,
    "csv_path" VARCHAR(500),
    "final_samples_count" INT NOT NULL DEFAULT 0,
    "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "chroma_ingestions" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "batch_id" VARCHAR(255) NOT NULL,
    "collection_name" VARCHAR(255) NOT NULL,
    "documents_ingested" INT NOT NULL DEFAULT 0,
    "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pipeline_run_id" INT NOT NULL REFERENCES "pipeline_runs" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "aerich" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "version" VARCHAR(255) NOT NULL,
    "app" VARCHAR(100) NOT NULL,
    "content" JSONB NOT NULL
);
```

---

## Step 9: Set Up Ollama (for Chatbot)

The chatbot uses a local LLM via Ollama. This is separate from the pipeline (which uses Gemini).

### 9a. Install Ollama

Download from https://ollama.com and install.

### 9b. Pull the model

```bash
ollama pull qwen2.5:1.5b
```

### 9c. Verify it's running

```bash
ollama list
```

Should show `qwen2.5:1.5b` in the list.

> **Note:** The chatbot intentionally uses a weak 1.5B model. This is by design — the whole point of AutoTune AI is to show how bad responses get improved through the pipeline. You can swap this for a better model later if you want.

---

## Step 10: Fix Code Bugs

These are bugs that will cause runtime errors. Fix them before running.

### Bug 1: Pipeline 1 CSV Path Mismatch

**File: `backend/api/routes/pipeline1.py`**

The route generates its own CSV path after `run_pipeline()` already wrote the CSV with a different timestamp. The file won't exist at the generated path.

**Find this block (around line 34-45):**

```python
        csv_path = None
        csv_rows = []
        final_samples = result.get("final_samples") or []

        if final_samples:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            csv_path = f"outputs/{request.batch_id}_{timestamp}.csv"

            # Read CSV rows to return to frontend
            with open(csv_path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                csv_rows = list(reader)
```

**Replace with:**

```python
        final_samples = result.get("final_samples") or []
        csv_path = result.get("csv_path")
        csv_rows = []

        if csv_path:
            try:
                with open(csv_path, "r", encoding="utf-8") as f:
                    reader = csv.DictReader(f)
                    csv_rows = list(reader)
            except FileNotFoundError:
                pass
```

Then you also need `run_pipeline()` to return the CSV path. 

**File: `backend/agent_v1/graph/graph.py`**

**Find this block (around line 108-115):**

```python
    # Export and metrics if we have final output
    if result.get("final_samples"):
        csv_path = export_to_csv(result["final_samples"], batch_id)
        print_metrics(result, csv_path)
    else:
        print("\n[Pipeline] No final samples produced.")
        # Still print logs so you can see what happened
        for log in result.get("logs", []):
            print(f"  {log}")

    return result
```

**Replace with:**

```python
    # Export and metrics if we have final output
    if result.get("final_samples"):
        csv_path = export_to_csv(result["final_samples"], batch_id)
        print_metrics(result, csv_path)
        result["csv_path"] = csv_path
    else:
        print("\n[Pipeline] No final samples produced.")
        for log in result.get("logs", []):
            print(f"  {log}")

    return result
```

### Bug 2: `print_metrics` References Wrong State Key

**File: `backend/agent_v1/export/csv_writer.py`**

**Find this line (around line 55):**

```python
    table.add_row("Conversations processed", str(len(state.get("conversations", []))))
```

**Replace with:**

```python
    table.add_row("Conversations input", "yes" if state.get("conversations_text") else "no")
```

### Bug 3: RAG Agent Collection Names Don't Match Reality

**File: `backend/prompts/prompts_v1.py`**

The system prompt tells the agent to search collections named `langchain_docs`, `agent_patterns`, `code_examples` — but those don't exist. The actual collections are named after batch IDs.

**Replace the entire `AGENT_SYSTEM_PROMPT` with:**

```python
AGENT_SYSTEM_PROMPT = """You are an expert AI assistant.

You have access to a knowledge base that was built from training data generated by the AutoTune pipeline.

AVAILABLE TOOL:
- search_knowledge_base: Search ChromaDB collections for relevant documents.
  You must provide a collection_name — these are batch IDs from pipeline runs (e.g., "batch-5521").

HOW TO ANSWER:
1. If the user's question might be covered in the knowledge base, search for it.
2. If you find relevant documents, use them to give an accurate, detailed answer.
3. If no relevant documents are found, answer using your own knowledge but note the limitation.
4. Be concise, accurate, and helpful.

RESPONSE STYLE:
- Be concise but thorough
- Use code examples when relevant
- Focus on practical, actionable advice"""
```

> **Note:** This is a temporary fix. A proper solution would auto-discover available collections. You can improve this later.

---

## Step 11: Start the Backend

```bash
cd backend

# Make sure venv is activated
# Make sure PostgreSQL is running
# Make sure Ollama is running

uvicorn api.main:app --reload --port 8000
```

### Verify it's working:

1. **Health check:**
   Open browser → `http://localhost:8000/health`
   Should return: `{"status": "ok"}`

2. **Connectivity check:**
   Open browser → `http://localhost:8000/connectivity`
   Shows status of all components.

3. **API docs:**
   Open browser → `http://localhost:8000/docs`
   Interactive Swagger UI with all endpoints.

---

## Step 12: Test Each Component

### Test 1: Chatbot (Simple LLM)

```bash
curl -X POST http://localhost:8000/chatbot/chat \
  -H "Content-Type: application/json" \
  -d '{"query": "What is LangChain?"}'
```

Or use the Swagger UI at `http://localhost:8000/docs`.

This tests: Ollama connection, database writes, basic API flow.

### Test 2: Pipeline 1 (Training Data Generation)

```bash
curl -X POST http://localhost:8000/pipeline1/run \
  -H "Content-Type: application/json" \
  -d '{
    "conversations_text": "USER: What is MCP?\nASSISTANT: I am not sure.\nUSER: That is not helpful.",
    "batch_id": "test-001"
  }'
```

This tests: Gemini API, DuckDuckGo search, web scraping, CSV export, all 5 agents.

**Expected time:** 30-90 seconds (5 LLM calls + web scraping).

### Test 3: Pipeline 2 (Ingest to ChromaDB)

After Pipeline 1 succeeds and gives you a `csv_path`:

```bash
curl -X POST http://localhost:8000/pipeline2/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "csv_path": "outputs/test-001_YYYYMMDD_HHMMSS.csv",
    "batch_id": "test-001"
  }'
```

Replace the csv_path with the actual path from Pipeline 1's response.

### Test 4: RAG Agent (after ingestion)

```bash
curl -X POST http://localhost:8000/test/agent \
  -H "Content-Type: application/json" \
  -d '{"query": "What is MCP?"}'
```

> **Note:** The RAG agent needs the `search_knowledge_base` tool to know which collection to search. This currently requires the collection name to be passed by the LLM, which is unreliable. See "Known Limitations" below.

### Test 5: Compare Simple vs RAG

```bash
curl -X POST http://localhost:8000/test/compare \
  -H "Content-Type: application/json" \
  -d '{"query": "What is MCP?"}'
```

Returns both responses side by side so you can see the improvement.

---

## Summary Checklist

```
[ ] Step 1:  Fix git upstream
[ ] Step 2:  Delete junk files (=4.12.0, zip.zip, zip/)
[ ] Step 3:  Create your own backend/.env with Gemini key
[ ] Step 4:  Set up PostgreSQL database
[ ] Step 5:  Fix pyproject.toml dependencies
[ ] Step 6:  Install Python dependencies
[ ] Step 7:  Fix pysqlite3 conditional imports (3 files)
[ ] Step 8:  Run database migrations
[ ] Step 9:  Install Ollama + pull qwen2.5:1.5b
[ ] Step 10: Fix code bugs (3 bugs)
[ ] Step 11: Start the backend
[ ] Step 12: Test each component
```

---

## Known Limitations (Not Blocking, Fix Later)

| Issue | Description | When to Fix |
|---|---|---|
| No frontend | No UI exists — API only. Test via curl or Swagger. | When you build the React dashboard |
| No auth | All endpoints are open. | Before any deployment |
| Sync pipeline | Pipeline 1 runs synchronously — can timeout on slow networks. | Add background tasks (Celery or asyncio) |
| RAG collection discovery | Agent doesn't know which ChromaDB collections exist. | Build a collection registry or auto-list |
| No HITL | Human review of samples was removed. All samples auto-approve. | Re-add as REST endpoints |
| No tests | Zero test coverage. | Add pytest suite |
| `create_agent` API | `rag_model.py` uses newer LangChain APIs that may not be stable. | Verify on first run, downgrade if needed |

---

## Troubleshooting

### "GEMINI_MODEL is None" or agents crash immediately
→ You forgot to add `GEMINI_MODEL=gemini-2.0-flash` to `backend/.env`.

### "Connection refused" on database
→ PostgreSQL isn't running, or DATABASE_URL is wrong. Check with `psql -U your_user -d autotune_db`.

### "Model not found" from Ollama
→ Run `ollama pull qwen2.5:1.5b` and make sure Ollama is running (`ollama serve`).

### ChromaDB "sqlite3" error on Windows
→ You didn't apply the pysqlite3 fix from Step 7.

### `ModuleNotFoundError: No module named 'langgraph'`
→ Dependencies not installed. Re-run `pip install -e .` from the `backend/` directory.

### Pipeline 1 returns empty samples
→ Check logs in the response. Common causes: Gemini rate limit, DuckDuckGo blocked, scraped content too short. Wait a minute and retry.

### `aerich upgrade` fails
→ Use the manual SQL from Step 8 instead. Connect to psql and paste the CREATE TABLE statements.
