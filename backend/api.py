from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import json
import time
from dotenv import load_dotenv
from google import genai
from google.genai import types
from groq import Groq

load_dotenv()

# Initialize FastAPI App
app = FastAPI(title="TestForge AI Engine", version="1.0")

# Allow the React frontend to communicate with this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize AI Clients
gemini_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

class PRDRequest(BaseModel):
    text: str

def clean_json_response(raw_text: str):
    cleaned = raw_text.replace("```json", "").replace("```", "").strip()
    return json.loads(cleaned)

def generate_with_gemini(prompt: str):
    print("[TestForge] Attempting with Google Gemini...")
    response = gemini_client.models.generate_content(
        model='gemini-2.0-flash',
        contents=prompt,
        config=types.GenerateContentConfig(temperature=0.2)
    )
    return clean_json_response(response.text)

def generate_with_groq(prompt: str):
    print("[TestForge] Attempting with Groq (Llama-3)...")
    response = groq_client.chat.completions.create(
        messages=[{"role": "user", "content": prompt}],
        model="llama-3.1-8b-instant",
        temperature=0.2,
    )
    return clean_json_response(response.choices[0].message.content)

def generate_mock_data():
    print("[TestForge] APIs unavailable. Triggering Demo Mode Fallback...")
    time.sleep(1.5)
    return [
        {
            "requirement_id": "SYS-01",
            "testcases": [
                {"type": "functional", "title": "Login Success", "steps": ["Enter valid credentials"], "expected_result": "Dashboard loads"},
                {"type": "negative", "title": "Login Fail", "steps": ["Enter invalid password"], "expected_result": "Error message"}
            ]
        }
    ]

@app.post("/api/generate")
async def process_prd(request: PRDRequest):
    prompt = f"""
    You are a Senior QA Automation Engineer.
    Extract requirements from the following PRD and generate 1 Functional and 1 Negative test case for each.
    Return ONLY a STRICT JSON array format like this, with no other text:
    [
      {{
        "requirement_id": "REQ-1",
        "testcases": [
          {{
            "type": "functional",
            "title": "...",
            "steps": ["..."],
            "expected_result": "..."
          }}
        ]
      }}
    ]
    PRD TEXT:
    {request.text}
    """

    try:
        data = generate_with_gemini(prompt)
        return {"status": "success", "provider": "Google Gemini", "data": data}
    except Exception as e:
        print(f"[WARNING] Gemini Failed: {str(e)}")
        
    try:
        data = generate_with_groq(prompt)
        return {"status": "success", "provider": "Groq (Llama 3)", "data": data}
    except Exception as e:
        print(f"[WARNING] Groq Failed: {str(e)}")

    try:
        data = generate_mock_data()
        return {"status": "success", "provider": "Demo Mode Cache", "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Catastrophic Failure across all tiers.")