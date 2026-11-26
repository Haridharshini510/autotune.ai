# agent_builder/usecase_call.py

import sys
if sys.platform == "linux":
    __import__("pysqlite3")
    sys.modules["sqlite3"] = sys.modules.pop("pysqlite3")

import os
from dotenv import load_dotenv

from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

from prompts.prompts_v1 import AGENT_SYSTEM_PROMPT

load_dotenv()


def _build_model():
    """Qwen 1.5B via llama.cpp server - weak model, runs on remote instance"""
    # Get llama.cpp server URL from environment variable
    llama_cpp_base_url = os.getenv("LLAMA_CPP_BASE_URL", "http://localhost:8080/v1")

    # llama.cpp server provides OpenAI-compatible API
    return ChatOpenAI(
        model="qwen2.5-1.5b",  # Model name doesn't matter much for llama.cpp
        temperature=0.7,
        max_tokens=512,
        base_url=llama_cpp_base_url,
        api_key="not-needed"  # llama.cpp doesn't require API key
    )


model = _build_model()


def get_response(query: str) -> str:
    """Get answer using weak Ollama model - will show failures"""
    messages = [
        SystemMessage(content=AGENT_SYSTEM_PROMPT),
        HumanMessage(content=query),
    ]
    response = model.invoke(messages)
    return response.content