from google.adk.agents import Agent
from google.genai import types as genai_types

from app_state import RAG_STORE


def retrieve_relevant_context(query: str, top_k: int = 5) -> dict:
    """Retrieve the most relevant multimodal source evidence for a user question."""
    return RAG_STORE.retrieval_tool(query=query, top_k=top_k)


def inspect_embedding_space() -> dict:
    """Inspect current sources, modalities, dimensions, and embedding provider."""
    return RAG_STORE.space_tool()


def build_agent(retrieval_tool=retrieve_relevant_context) -> Agent:
    return Agent(
        name="multimodal_agentic_rag_agent",
        model="gemini-3-flash-preview",
        description="Agentic RAG coordinator for a multimodal Gemini Embedding 2 workspace.",
        instruction="""
You are the Google ADK coordinator for a multimodal agentic RAG workspace.

For every user question:
1. Use inspect_embedding_space to understand the current workspace.
2. Use retrieve_relevant_context with the user's question before answering.
3. Ground the answer in the retrieved evidence. Do not invent facts that are not supported by the workspace.
4. Do not include raw citation ids, source ids, bracket citations, Markdown bold markers, or asterisk bullets in the answer. The UI shows citations separately.
5. Start with a clear direct answer in 2-3 sentences.
6. If helpful, add a short "Key points:" section with simple hyphen bullets.
7. Explain briefly when the vector evidence is weak or sparse.
8. Keep the answer useful and direct.
""",
        tools=[inspect_embedding_space, retrieval_tool],
        generate_content_config=genai_types.GenerateContentConfig(
            temperature=0.25,
            max_output_tokens=900,
        ),
    )


root_agent = build_agent()
