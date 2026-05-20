# 🧠 DevPulseAI — Multi-Agent Signal Intelligence

A reference implementation demonstrating how to build a **multi-agent pipeline** that aggregates technical signals from multiple sources, scores them for relevance, assesses risks, and synthesizes an actionable intelligence digest.

> **Design Philosophy:** Agents are used **only where reasoning is required.** Deterministic operations (collection, normalization, deduplication) are implemented as plain utilities — not agents.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    DATA SOURCES                         │
│  GitHub · ArXiv · HackerNews · Medium · HuggingFace     │
└──────────────────────┬──────────────────────────────────┘
                       │ raw signals
                       ▼
┌──────────────────────────────────────────────────────────┐
│  SignalCollector (UTILITY — no LLM)                      │
│  • Normalizes to unified schema                          │
│  • Deduplicates via source:id composite key              │
│  • Filters incomplete signals                            │
└──────────────────────┬───────────────────────────────────┘
                       │ normalized signals
                       ▼
┌──────────────────────────────────────────────────────────┐
│  RelevanceAgent (AGENT — gpt-4.1-mini)                   │
│  • Scores each signal 0–100 for developer relevance      │
│  • Considers: novelty, impact, actionability, timeliness  │
│  • Falls back to heuristics if no API key                 │
└──────────────────────┬───────────────────────────────────┘
                       │ scored signals
                       ▼
┌──────────────────────────────────────────────────────────┐
│  RiskAgent (AGENT — gpt-4.1-mini)                        │
│  • Assesses security vulnerabilities                      │
│  • Flags breaking changes and deprecations                │
│  • Rates risk: LOW / MEDIUM / HIGH / CRITICAL             │
└──────────────────────┬───────────────────────────────────┘
                       │ risk-assessed signals
                       ▼
┌──────────────────────────────────────────────────────────┐
│  SynthesisAgent (AGENT — gpt-4.1)                        │
│  • Cross-references relevance + risk data                 │
│  • Produces executive summary                             │
│  • Generates actionable recommendations                   │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
              📄 Intelligence Digest
```

---

## Why Signal Collection Is Not an Agent

This is an **intentional, opinionated design choice** — not a shortcut.

Signal collection involves:

- Fetching data from HTTP APIs (deterministic)
- Normalizing fields to a unified schema (mechanical transformation)
- Deduplicating by composite key (hash comparison)

**None of these tasks require reasoning, judgment, or language understanding.**

Wrapping collection in an `Agent` class would be _decorative_ — it would have an LLM import that never gets called. This misleads readers into thinking an LLM is necessary, when the actual logic is a `for` loop with a `set()`.

> **Rule of thumb:** If you can write the logic as a pure function with no ambiguity, it's a utility. If the output depends on understanding context, making judgment calls, or generating natural language, it's an agent.

---

## Agent Roles & Model Selection

| Component | Type | Model | Why This Model |
|---|---|---|---|
| `SignalCollector` | **Utility** | _none_ | Deterministic — no reasoning required |
| `RelevanceAgent` | **Agent** | `gpt-4.1-mini` | Classification task — fast, cheap, high-volume |
| `RiskAgent` | **Agent** | `gpt-4.1-mini` | Structured analysis — careful but not expensive |
| `SynthesisAgent` | **Agent** | `gpt-4.1` | Cross-referencing & summarization — needs strongest reasoning |

**Single provider by default (OpenAI)** to reduce onboarding friction. Override per-agent via environment variables:

```bash
export MODEL_RELEVANCE=gpt-4.1-nano    # cheaper, faster
export MODEL_RISK=o4-mini               # deeper reasoning for risk
export MODEL_SYNTHESIS=gpt-4.1          # default, strongest
```

---

## How to Run

### Quick Verification (No API Key Required)

```bash
cd advanced_ai_agents/multi_agent_apps/devpulse_ai
python verify.py
```

This runs the full pipeline with mock data in **<1 second**. No network calls, no API keys.

Expected output:

```
[OK] DevPulseAI reference pipeline executed successfully
```

### Full Pipeline (With API Key)

```bash
pip install -r requirements.txt
export OPENAI_API_KEY=sk-...
python main.py
```

Without an API key, agents automatically fall back to heuristic scoring.

### Streamlit Dashboard

```bash
streamlit run streamlit_app.py
```

---

## Project Structure

```
devpulse_ai/
├── agents/
│   ├── __init__.py              # Package exports + design docs
│   ├── signal_collector.py      # UTILITY — normalize & dedup
│   ├── relevance_agent.py       # AGENT  — score relevance (gpt-4.1-mini)
│   ├── risk_agent.py            # AGENT  — assess risks (gpt-4.1-mini)
│   └── synthesis_agent.py       # AGENT  — produce digest (gpt-4.1)
├── adapters/
│   ├── github.py                # GitHub trending repos
│   ├── arxiv.py                 # ArXiv recent papers
│   ├── hackernews.py            # HackerNews top stories
│   ├── medium.py                # Medium AI/ML blogs
│   └── huggingface.py           # HuggingFace trending models
├── workflows/
│   └── signal-intelligence-pipeline.json
├── main.py                      # Full pipeline runner
├── verify.py                    # Mock-data verification (<1s)
├── streamlit_app.py             # Interactive dashboard
└── requirements.txt             # Minimal deps (single provider)
```

---

## Optional Extensions (Advanced Users)

These are **not required** for the reference implementation, but show how the architecture extends:

1. **Multi-provider models** — Swap `RelevanceAgent` to use Anthropic Claude or Google Gemini by updating the model config. The `agno` framework supports multiple providers.

2. **Vector search** — Add a Pinecone or Qdrant adapter to store and retrieve signals semantically for long-term pattern detection.

3. **Streaming digests** — Use WebSocket streaming from `SynthesisAgent` for real-time intelligence feeds.

4. **Custom adapters** — Add new signal sources by implementing a `fetch_*` function that returns `List[Dict]` with the standard schema (`id`, `source`, `title`, `description`, `url`, `metadata`).

5. **Feedback loop** — Store user feedback (👍/👎) in Supabase and use it to fine-tune relevance scoring over time.

---

## Dependencies

```
agno              # Agent framework
openai            # LLM provider (single default)
httpx             # HTTP client for adapters
feedparser        # RSS/Atom parsing for Medium
streamlit>=1.30   # Interactive dashboard
```

No `google-generativeai` required. Gemini is an optional extension if users want multi-provider support — install `google-genai` (not the deprecated `google-generativeai`) separately.

---

## Design Tradeoffs

| Decision | Tradeoff | Why |
|---|---|---|
| Single provider default | Less flexibility | Reduces onboarding from 2+ keys to 1 |
| Signal collection as utility | Less "agentic" demo | Honest architecture — agents where reasoning exists |
| Heuristic fallbacks | Lower quality without API key | Pipeline always works, even for evaluation |
| 5 signals per source default | Less data | Keeps demo fast (<10s with API, <1s mock) |
| No async in agents | Less throughput | Simpler code, clearer educational value |

---

_Built as a reference implementation for [awesome-llm-apps](https://github.com/ishandutta2007/Awesome-LLM-Agents)._
