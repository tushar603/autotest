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

telemetry = {
    "total_requests": 0,
    "gemini_success": 0,
    "gemini_failures": 0,
    "groq_success": 0,
    "groq_failures": 0,
    "demo_fallback_triggers": 0
}

app = FastAPI(title="TestForge AI Engine", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
                {"type": "functional", "title": "Login Success", "steps": ["Enter valid credentials"], "test_input": "admin@test.com / ValidPass123!", "expected_result": "Dashboard loads"},
                {"type": "negative", "title": "Login Fail", "steps": ["Enter invalid password"], "test_input": "admin@test.com / wrongpass", "expected_result": "Error message"}
            ]
        }
    ]

@app.post("/api/score")
async def score_prd(request: PRDRequest):
    prompt = f"""Perform static analysis on the following PRD. 
    Identify vague requirements, unquantified metrics, and missing edge conditions.
    Return strictly a JSON object. Do not include markdown formatting.
    Schema:
    {{
        "readiness_score": <integer 0-100>,
        "vague_statements": [
            {{"statement": "<exact_string_match>", "issue": "<technical_defect_description>"}}
        ]
    }}
    PRD: {request.text}
    """
    try:
        response = groq_client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.1-8b-instant",
            temperature=0.1,
        )
        data_string = response.choices[0].message.content
        clean_string = data_string.replace("```json", "").replace("```", "").strip()
        return json.loads(clean_string)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate")
async def process_prd(request: PRDRequest):
    telemetry["total_requests"] += 1
    prompt = f"""
    You are a Senior QA Automation Engineer.
    Analyze the following PRD and generate comprehensive QA test cases.
    Return strictly a JSON array of objects. Do not include markdown formatting.
    Schema:
    [
        {{
            "requirement_id": "REQ-XXX",
            "testcases": [
                {{
                    "type": "functional | negative | edge",
                    "title": "string",
                    "steps": ["step 1", "step 2"],
                    "test_input": "string", 
                    "expected_result": "string"
                }}
            ]
        }}
    ]
    PRD: {request.text}
    """

    try:
        data = generate_with_gemini(prompt)
        telemetry["gemini_success"] += 1
        return {"status": "success", "provider": "Google Gemini", "data": data}
    except Exception as e:
        telemetry["gemini_failures"] += 1
        print(f"[WARNING] Gemini Failed: {str(e)}")
        
    try:
        data = generate_with_groq(prompt)
        telemetry["groq_success"] += 1
        return {"status": "success", "provider": "Groq (Llama 3)", "data": data}
    except Exception as e:
        telemetry["groq_failures"] += 1
        print(f"[WARNING] Groq Failed: {str(e)}")

    try:
        data = generate_mock_data()
        telemetry["demo_fallback_triggers"] += 1
        return {"status": "success", "provider": "Demo Mode Cache", "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Catastrophic Failure across all tiers.")