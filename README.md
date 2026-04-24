# AutoTest: Test Case Generator and QA Automator

AutoTest is a full-stack AI orchestration engine that automatically translates raw Product Requirement Documents (PRDs) into structured QA Test Cases (Functional, Negative, and Edge). 

It features a custom **Multi-LLM Failover Cascade** to ensure 100% uptime, automatically catching rate limits and rerouting traffic between AI providers.

## Key USPs & Features
* **Multi-LLM Cascade Architecture:** If the primary AI (Google Gemini 2.0) returns a 429 Rate Limit error, the backend gracefully catches the exception and reroutes the prompt to the secondary AI (Llama 3.1 via Groq) with zero downtime to the user.
* **Automated Traceability Matrix:** Instantly maps generated test cases directly back to their parent Requirement IDs.
* **One-Click Jira Export:** Allows QA engineers to download the generated Traceability Matrix as a formatted CSV for immediate import into Jira or Zephyr.
* **Separation of Concerns:** Microservice architecture with isolated backend and frontend deployments.
* **Generation of Testing Code:** Using selenium a testing code is generated that can be tested using PyTest

## Tech Stack
* **Frontend:** React.js, Vite, Bootstrap 5 (Deployed on Vercel)
* **Backend:** Python 3.10+, FastAPI, Uvicorn (Deployed on Render)
* **AI Orchestration:** `google-genai` (Gemini 2.0 Flash) & `groq` (Llama 3.1 8B)
* **State Management:** Axios & React Hooks
* **Graph Generator** Mermaid

## Architecture Flow
1. User inputs raw PRD text into the React UI.
2. JSON payload is sent via REST API to the FastAPI backend.
3. Backend attempts Generation via Primary LLM (Gemini).
4. *Failover Loop:* If Primary fails, fallback to Secondary LLM (Llama 3). If all APIs fail, trigger offline Demo Cache.
5. Backend normalizes the output into a strict JSON array.
6. React parses the JSON and renders the Traceability Dashboard.
