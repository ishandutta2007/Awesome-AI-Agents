import streamlit as st
import requests
import fitz  # PyMuPDF for PDF parsing

st.set_page_config(page_title="📄 Resume & Job Matcher AI Agent", layout="centered")

st.title("📄 Resume & Job Matcher AI Agent")

st.sidebar.info("""
This app uses a specialized **Resume & Job Matcher AI Agent** powered by a local LLM via **Ollama**.
1. Install Ollama: https://ollama.ai
2. Verify the ollama CLI works, by running the below commands in your terminal:
    2.1. Start the Ollama server: `ollama serve` on separate terminal.
    2.2. Run a model (e.g., `ollama pull llama3`).
    2.3. Verify local LLM llama is listed using `ollama list`.
    2.4. Run the streamlit run app.py command to start this AI Agent in another terminal.
3. Upload a Resume + Job Description to get a fit score and suggestions from the AI Agent.
""")

# Helper: Extract text from PDF
def extract_pdf_text(file):
    text = ""
    with fitz.open(stream=file.read(), filetype="pdf") as doc:
        for page in doc:
            text += page.get_text()
    return text

def get_text_from_file(file_name) -> str:
    if file_name.type == "application/pdf":
        file_text = extract_pdf_text(file_name)
    else:
        file_text = file_name.read().decode("utf-8")
    return file_text

# File uploaders
resume_file = st.file_uploader("Upload Resume (PDF/TXT)", type=["pdf", "txt"])
job_file = st.file_uploader("Upload Job Description (PDF/TXT)", type=["pdf", "txt"])

if st.button("🔍 Match Resume with Job Description"):
    if resume_file and job_file:
    # Extract Resume text
        resume_text = get_text_from_file(resume_file)
        # Extract Job Description text
        job_text = get_text_from_file(job_file)
    

        # Prompt for the AI Agent
        prompt = f"""
        You are a specialized Resume & Job Matcher AI Agent with expertise in technical recruitment.
        
        Resume Content:
        {resume_text}

        Job Description:
        {job_text}

        As an AI Agent, please analyze and return:
        1. A **Fit Score** (0-100%) of how well this resume matches the job.
        2. Key strengths (resume areas that align well).
        3. Specific recommendations from an AI Agent perspective to improve the resume to better fit the job.
        Format neatly in Markdown.
        """

        try:
            with st.spinner("⏳ AI Agent is analyzing Resume vs Job Description..."):
                response = requests.post(
                    "http://localhost:11434/api/generate",
                    json={"model": "llama3", "prompt": prompt, "stream": False},
                )
                data = response.json()
                output = data.get("response", "⚠️ No response from model.")

            # Show Results
            st.subheader("📌 Match Analysis")
            st.markdown(output)

            # Save in session for download
            st.session_state["resume_match"] = output

        except Exception as e:
            st.error(f"An error occurred: {str(e)}")

    else:
        st.warning("⚠️ Please upload both Resume and Job Description.")

# Download button
if "resume_match" in st.session_state:
    st.download_button(
        "💾 Download Match Report",
        st.session_state["resume_match"],
        file_name="resume_match_report.md",
        mime="text/markdown"
    )
