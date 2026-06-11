# import necessary python libraries
from agno.agent import Agent
from agno.models.xai import xAI
from agno.tools.yfinance import YFinanceTools
from agno.tools.duckduckgo import DuckDuckGoTools
from agno.os import AgentOS

# Create the xAI Finance AI Agent
xai_finance_ai_agent = Agent(
    name="xAI Finance AI Agent",
    model = xAI(id="grok-beta"),
    tools=[DuckDuckGoTools(), YFinanceTools()],
    instructions = ["Always use tables to display financial/numerical data. For text data use bullet points and small paragraphs."],
    debug_mode = True,
    markdown = True,
    )

# UI for the AI Agent
agent_os = AgentOS(agents=[xai_finance_ai_agent])
app = agent_os.get_app()

if __name__ == "__main__":
    agent_os.serve(app="xai_finance_agent:app", reload=True)
