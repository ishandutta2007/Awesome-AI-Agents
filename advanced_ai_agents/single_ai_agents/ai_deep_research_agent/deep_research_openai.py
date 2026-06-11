import asyncio
import streamlit as st
from typing import Dict, Any, List
from agents import Agent, Runner, trace
from agents import set_default_openai_key
from firecrawl import FirecrawlApp
from agents.tool import function_tool

# Set page configuration
st.set_page_config(
    page_title="OpenAI Deep Research Agent",
    page_icon="📘",
    layout="wide"
)

# Initialize session state for API keys if not exists
if "openai_api_key" not in st.session_state:
    st.session_state.openai_api_key = ""
if "firecrawl_api_key" not in st.session_state:
    st.session_state.firecrawl_api_key = ""

# Sidebar for API keys
with st.sidebar:
    st.title("API Configuration")
    openai_api_key = st.text_input(
        "OpenAI API Key", 
        value=st.session_state.openai_api_key,
        type="password"
    )
    firecrawl_api_key = st.text_input(
        "Firecrawl API Key", 
        value=st.session_state.firecrawl_api_key,
        type="password"
    )
    
    if openai_api_key:
        st.session_state.openai_api_key = openai_api_key
        set_default_openai_key(openai_api_key)
    if firecrawl_api_key:
        st.session_state.firecrawl_api_key = firecrawl_api_key

# Main content
st.title("📘 OpenAI Deep Research Agent")
st.markdown("This OpenAI Agent from the OpenAI Agents SDK performs deep research on any topic using Firecrawl")

# Research topic input
research_topic = st.text_input("Enter your research topic:", placeholder="e.g., Latest developments in AI")

# Custom tool for deep research
@function_tool
async def deep_research_tool(query: str, max_depth: int, time_limit: int, max_urls: int) -> Dict[str, Any]:
    """
    Perform comprehensive web research using Firecrawl's deep research endpoint.
    """
    try:
        # Initialize FirecrawlApp with the API key from session state
        firecrawl_app = FirecrawlApp(api_key=st.session_state.firecrawl_api_key)
        
        # Define research parameters
        params = {
            "maxDepth": max_depth,
            "timeLimit": time_limit,
            "maxUrls": max_urls
        }
        
        # Set up a callback for real-time updates
        def on_activity(activity):
            st.write(f"[{activity['type']}] {activity['message']}")
        
        # Run deep research
        with st.spinner("AI Agent is performing deep research..."):
            results = firecrawl_app.deep_research(
                query=query,
                params=params,
                on_activity=on_activity
            )
        
        return {
            "success": True,
            "final_analysis": results['data']['finalAnalysis'],
            "sources_count": len(results['data']['sources']),
            "sources": results['data']['sources']
        }
    except Exception as e:
        st.error(f"Deep research error: {str(e)}")
        return {"error": str(e), "success": False}

# Initialize AI Agents
deep_research_ai_agent = Agent(
    name="deep_research_ai_agent",
    instructions="""You are a professional Deep Research AI Agent that can perform comprehensive web research on any topic.

    When given a research topic or question:
    1. Use the deep_research_tool to gather comprehensive information
       - Always use these parameters:
         * max_depth: 3 (for moderate depth)
         * time_limit: 180 (3 minutes)
         * max_urls: 10 (sufficient sources)
    2. The tool will search the web, analyze multiple sources, and provide a synthesis
    3. Review the research results and organize them into a well-structured report
    4. Include proper citations for all sources
    5. Highlight key findings and insights
    """,
    tools=[deep_research_tool]
)

content_elaboration_ai_agent = Agent(
    name="content_elaboration_ai_agent",
    instructions="""You are an expert Content Elaboration AI Agent specializing in research enhancement.

    When given a research report:
    1. Analyze the structure and content of the report
    2. Enhance the report by:
       - Adding more detailed explanations of complex concepts
       - Including relevant examples, case studies, and real-world applications
       - Expanding on key points with additional context and nuance
       - Adding visual elements descriptions (charts, diagrams, infographics)
       - Incorporating latest trends and future predictions
       - Suggesting practical implications for different stakeholders
    3. Maintain academic rigor and factual accuracy
    4. Preserve the original structure while making it more comprehensive
    5. Ensure all additions are relevant and valuable to the topic
    """
)

async def run_deep_research_workflow_with_ai_agents(topic: str):
    """Run the complete research process using specialized AI Agents."""
    # Step 1: Initial Research
    with st.spinner("Deep Research AI Agent is conducting initial research..."):
        research_result = await Runner.run(deep_research_ai_agent, topic)
        initial_report = research_result.final_output
    
    # Display initial report in an expander
    with st.expander("View Initial Research Report"):
        st.markdown(initial_report)
    
    # Step 2: Enhance the report
    with st.spinner("Content Elaboration AI Agent is enhancing the report..."):
        elaboration_input = f"""
        RESEARCH TOPIC: {topic}
        
        INITIAL RESEARCH REPORT:
        {initial_report}
        
        Please enhance this research report with additional information, examples, case studies, 
        and deeper insights while maintaining its academic rigor and factual accuracy.
        """
        
        elaboration_result = await Runner.run(content_elaboration_ai_agent, elaboration_input)
        enhanced_report = elaboration_result.final_output
    
    return enhanced_report

# Main research process
if st.button("Start Research", disabled=not (openai_api_key and firecrawl_api_key and research_topic)):
    if not openai_api_key or not firecrawl_api_key:
        st.warning("Please enter both API keys in the sidebar.")
    elif not research_topic:
        st.warning("Please enter a research topic.")
    else:
        try:
            # Create placeholder for the final report
            report_placeholder = st.empty()
            
            # Run the research process using AI Agents
            enhanced_report = asyncio.run(run_deep_research_workflow_with_ai_agents(research_topic))
            
            # Display the enhanced report
            report_placeholder.markdown("## Enhanced Research Report")
            report_placeholder.markdown(enhanced_report)
            
            # Add download button
            st.download_button(
                "Download Report",
                enhanced_report,
                file_name=f"{research_topic.replace(' ', '_')}_report.md",
                mime="text/markdown"
            )
            
        except Exception as e:
            st.error(f"An error occurred: {str(e)}")

# Footer
st.markdown("---")
st.markdown("Powered by OpenAI Agents SDK and Firecrawl") 