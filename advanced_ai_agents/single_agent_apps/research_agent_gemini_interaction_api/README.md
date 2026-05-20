# 🔬 AI Research Planner & Executor Agent with Google's Interactions API

A streamlined multi-phase research agent built with **Google's Interactions API** that demonstrates stateful conversations, model mixing, background execution, and automatic infographic generation.

## 🌟 Features

- **📋 Phase 1 - Research Planning**: Uses **Gemini 3 Flash** to create structured, actionable research plans
- **🔍 Phase 2 - Task Selection & Deep Research**: Select specific tasks and leverage **Deep Research Agent** with built-in web search
- **📊 Phase 3 - Synthesis + TL;DR**: Uses **Gemini 3 Pro** for executive reports + **Gemini 3 Pro Image** for automatic infographic generation
- **🎨 Auto-Generated Infographics**: Creates whiteboard-style TL;DR summary at the top of every report
- **🔄 Stateful Conversations**: Demonstrates `previous_interaction_id` for maintaining context across phases
- **⚡ Background Execution**: Async research execution with progress tracking
- **📥 Export Reports**: Download comprehensive research reports as markdown files

## 🎯 How It Works

```
User Goal
    ↓
[Phase 1] Gemini 3 Flash → Research Plan
    ↓
[Phase 2] Select Tasks → Deep Research Agent → Research Results
    ↓
[Phase 3] Gemini 3 Pro → Executive Report
         + Gemini 3 Pro Image → TL;DR Infographic
```

### Phase 1: Planning
1. Enter your research goal
2. **Gemini 3 Flash** creates a numbered research plan with 5-8 specific tasks
3. Plan is stored as an `Interaction` for stateful continuation

### Phase 2: Select & Research
1. Review the research plan with checkboxes for each task
2. Select/deselect tasks to focus your research
3. **Deep Research Agent** executes comprehensive web research using `previous_interaction_id`

### Phase 3: Synthesis + Infographic
1. **Gemini 3 Pro** synthesizes findings into an executive report
2. **Gemini 3 Pro Image** automatically generates a whiteboard TL;DR infographic
3. Report displays with infographic at the top, followed by full text
4. Download as markdown

## 🛠️ Tech Stack

| Component | Technology |
|-----------|-----------|
| **Planning Model** | `gemini-3-flash-preview` |
| **Research Agent** | `deep-research-pro-preview-12-2025` |
| **Synthesis Model** | `gemini-3-pro-preview` |
| **Infographic Model** | `gemini-3-pro-image-preview` |
| **UI Framework** | Streamlit |
| **Python SDK** | `google-genai` |

### How to get Started?

1. Clone the GitHub repository

```bash
git clone https://github.com/ishandutta2007/Awesome-LLM-Agents.git
cd advanced_ai_agents/single_agent_apps/research_agent_gemini_interaction_api
```

2. Install the required dependencies:

```bash
pip install -r requirements.txt
```

3. Get your Google API Key

- Sign up for a [Google AI Studio account](https://ai.google.dev/) and obtain your API key.

4. Run the Streamlit App

```bash
streamlit run research_planner_executor_agent.py
```

5. Open your browser at `http://localhost:8501`

6. Enter your Google API key in the sidebar and start researching!

## 📝 Example Research Goals

- "Research the B2B HR SaaS market in Germany - key players, regulations, pricing models"
- "Analyze market opportunities for AI-powered customer support tools"
- "Investigate the competitive landscape for sustainable packaging in e-commerce"
- "Research regulatory requirements for fintech products targeting Gen Z"

## ⚠️ Notes

- **Beta API**: The Interactions API is in Beta - features may change
- **Deep Research**: May take 2-5 minutes for comprehensive research
- **Agent vs Model**: Deep Research uses `agent` parameter, not `model`
- **Image Generation**: Infographic generation uses the standard `generate_content` API

## 🔗 Resources

- [Gemini Interactions API Docs](https://ai.google.dev/gemini-api/docs/interactions)
- [Gemini Models](https://ai.google.dev/gemini-api/docs/models)
- [Google AI Studio](https://ai.google.dev/)

## 📄 License

Part of the [Awesome LLM Apps](https://github.com/ishandutta2007/Awesome-LLM-Agents) collection.
