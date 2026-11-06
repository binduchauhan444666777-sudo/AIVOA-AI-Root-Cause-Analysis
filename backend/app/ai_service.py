from datetime import datetime
import json
import re
from groq import Groq
from .config import GROQ_API_KEY, GROQ_MODEL

def _json_completion(system_prompt: str, user_prompt: str) -> dict:
    if not GROQ_API_KEY:
        raise RuntimeError("GROQ_API_KEY is missing. Add it to backend/.env.")
    client = Groq(api_key=GROQ_API_KEY)
    response = client.chat.completions.create(
        model=GROQ_MODEL,
        temperature=0.2,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )
    return json.loads(response.choices[0].message.content or "{}")

def extract_incident(source_text: str) -> dict:
    system = """
You assist quality investigations at a pharmaceutical API manufacturer.
Extract only information explicitly present. Never invent values.
Return JSON keys: title, batch_number, product_name, incident_date, department,
severity, status, incident_description, containment_action, investigation_method.
Use empty strings for unknown text fields. severity must be Low, Medium, High, or Critical;
use Medium if unknown. status is Draft. Do not decide a root cause.
"""
    try:
        return _json_completion(system, "Extract fields from this report:\n\n" + source_text[:18000])
    except Exception:
        res = _local_rule_fallback(source_text, {}, datetime.now().strftime("%Y-%m-%d"))
        return res["incident"]

def _local_rule_fallback(user_message: str, current_incident: dict, today_date: str) -> dict:
    inc = dict(current_incident) if current_incident else {
        "title": "Untitled investigation",
        "batch_number": "",
        "product_name": "",
        "incident_date": "",
        "department": "",
        "severity": "Medium",
        "status": "Draft",
        "incident_description": "",
        "containment_action": "",
        "investigation_method": "5 Whys",
    }
    lower = user_message.lower().strip()
    changes = []

    # Greeting check
    if lower in ["hi", "hello", "hey", "hi there", "good morning", "good afternoon"]:
        return {
            "incident": inc,
            "reply": "Hi! Whenever you're ready, share your deviation report or notes and I'll automatically fill in the investigation fields for you.",
        }

    # 1. Date updates (e.g. "please change the date to todays date")
    if ("today" in lower or "todays date" in lower or "today's date" in lower) and "date" in lower:
        inc["incident_date"] = today_date
        changes.append(f"incident date to today ({today_date})")
    elif "date" in lower:
        date_match = re.search(r'\b(20\d{2}-\d{2}-\d{2})\b', user_message)
        if date_match:
            inc["incident_date"] = date_match.group(1)
            changes.append(f"incident date to {date_match.group(1)}")

    # 2. Batch extraction
    batch_match = re.search(r'(?:batch\s*(?:number|no|#)?\s*[:—\-]?\s*)([A-Za-z0-9\-_]+)', user_message, re.IGNORECASE)
    if batch_match:
        inc["batch_number"] = batch_match.group(1).strip()
        changes.append(f"batch number to {inc['batch_number']}")

    # 3. Product extraction
    prod_match = re.search(r'(?:product\s*(?:name)?\s*[:—\-]?\s*)([A-Za-z0-9\s\-_]+?)(?:\n|$)', user_message, re.IGNORECASE)
    if prod_match:
        inc["product_name"] = prod_match.group(1).strip()
        changes.append(f"product name to {inc['product_name']}")

    # 4. Department extraction
    for dept in ["Production", "Quality Control", "Quality Assurance", "Engineering", "Warehouse", "Packaging", "Other"]:
        if dept.lower() in lower and "department" in lower:
            inc["department"] = dept
            changes.append(f"department to {dept}")
            break

    # 5. Severity updates
    for sev in ["critical", "high", "medium", "low"]:
        if f"severity to {sev}" in lower or f"severity: {sev}" in lower or f"severity as {sev}" in lower or f"severity {sev}" in lower:
            inc["severity"] = sev.capitalize()
            changes.append(f"severity to {sev.capitalize()}")
            break

    # 6. Status updates
    for st in ["draft", "under investigation", "pending review", "approved", "closed"]:
        if f"status to {st}" in lower or f"status: {st}" in lower:
            formatted_st = " ".join(w.capitalize() for w in st.split())
            inc["status"] = formatted_st
            changes.append(f"status to {formatted_st}")
            break

    # 7. Containment action extraction
    if "hold" in lower or "segregated" in lower or "quarantine" in lower or "containment" in lower:
        sentences = [s.strip() for s in user_message.split(".") if any(w in s.lower() for w in ["hold", "segregated", "quarantine", "supervisor", "isolated", "containment"])]
        if sentences:
            inc["containment_action"] = ". ".join(sentences) + "."
            changes.append("containment action")

    # 8. Description or full report
    if ("during" in lower or "deviation" in lower or "assay" in lower or "observation" in lower) and len(user_message) > 50:
        if not inc.get("incident_description") or len(user_message) > len(inc.get("incident_description", "")):
            inc["incident_description"] = user_message.strip()
            changes.append("incident description")
        if (not inc.get("title") or inc.get("title") == "Untitled investigation") and inc.get("batch_number"):
            inc["title"] = f"Investigation — Batch {inc.get('batch_number')}"
            changes.append("title")

    if changes:
        reply = f"Sure thing! I've updated the {', '.join(changes)}. Let me know if you'd like to adjust anything else!"
    else:
        reply = "Got it! I reviewed your message and updated the investigation parameters accordingly."

    return {"incident": inc, "reply": reply}

def chat_incident(
    user_message: str,
    current_incident: dict = None,
    chat_history: list[dict] = None,
    today_date: str = None
) -> dict:
    if not today_date:
        today_date = datetime.now().strftime("%Y-%m-%d")

    current_incident = current_incident or {}
    chat_history = chat_history or []

    if not GROQ_API_KEY:
        return _local_rule_fallback(user_message, current_incident, today_date)

    try:
        client = Groq(api_key=GROQ_API_KEY)

        system = f"""You are a helpful, professional QA colleague helping investigators with deviation reports and root cause analysis in a pharmaceutical manufacturing facility.
Today's date is: {today_date}.

COMMUNICATION STYLE:
- Speak naturally, warmly, and concisely like a real human coworker.
- NEVER recite robotic bulleted lists explaining what you can do (do NOT say 'I am your QMS assistant. I can help you by: 1... 2... 3...').
- If the user says hi or asks a general question, just say something friendly and brief, like:
  "Hi! Whenever you're ready, share your deviation report or notes and I'll populate the investigation form for you."
- When you extract or update details, confirm it conversationally in 1-2 natural sentences, e.g.:
  "Got it! I've filled in the form for Batch API-2026-014 (Product X). Let me know if you want to tweak any fields."
  or "Done! I updated the date to today ({today_date}) and kept everything else as is."

AUTOMATIC FIELD EXTRACTION:
- Whenever the user sends any text that mentions deviation details, incident notes, or emails:
  IMMEDIATELY extract all facts into the 10 investigation fields (title, batch_number, product_name, incident_date, department, severity, status, incident_description, containment_action, investigation_method).
- If the user asks for an update (e.g. 'please change the date to todays date', 'set severity to High', 'change batch to B-123'):
  Change ONLY the requested field, and KEEP all other existing fields from CURRENT RECORD intact!

Investigation fields schema:
- title: string (concise title, e.g. "Low assay result in intermediate stage — Batch API-2026-014")
- batch_number: string (e.g. "API-2026-014")
- product_name: string (e.g. "API Product X")
- incident_date: string (Format: YYYY-MM-DD. When asked for 'today' or 'todays date', use '{today_date}')
- department: string (Production, Quality Control, Quality Assurance, Engineering, Warehouse, Packaging, or Other)
- severity: string (Low, Medium, High, or Critical)
- status: string (Draft, Under Investigation, Pending Review, Approved, or Closed)
- incident_description: string (factual statement of what occurred)
- containment_action: string (immediate actions taken to isolate material/batch)
- investigation_method: string (5 Whys or Fishbone)

CURRENT RECORD IN SYSTEM:
{json.dumps(current_incident, indent=2, ensure_ascii=False)}

Return JSON with exactly two keys:
1. "incident": complete object with all 10 fields.
2. "reply": your natural, friendly message to the user.
"""

        messages = [{"role": "system", "content": system}]

        # Include recent chat history (up to last 6 messages)
        for msg in chat_history[-6:]:
            role = "assistant" if msg.get("role") == "assistant" else "user"
            content = msg.get("text", "")
            if content:
                messages.append({"role": role, "content": content})

        # Current message
        messages.append({"role": "user", "content": user_message[:18000]})

        response = client.chat.completions.create(
            model=GROQ_MODEL,
            temperature=0.3,
            response_format={"type": "json_object"},
            messages=messages,
        )
        result = json.loads(response.choices[0].message.content or "{}")

        # Merge to preserve non-overwritten fields
        ret_incident = result.get("incident")
        if not isinstance(ret_incident, dict):
            ret_incident = dict(current_incident)
        else:
            merged = dict(current_incident)
            merged.update({k: v for k, v in ret_incident.items() if v not in (None, "") or k not in merged})
            ret_incident = merged

        # Safeguard for explicit "today's date" requests
        lower_msg = user_message.lower()
        if ("today" in lower_msg or "todays date" in lower_msg or "today's date" in lower_msg) and "date" in lower_msg:
            ret_incident["incident_date"] = today_date
            if "reply" in result and "today" not in result["reply"].lower():
                result["reply"] = f"Done! I've updated the incident date to today's date ({today_date}). All other details are preserved."

        result["incident"] = ret_incident
        return result

    except Exception:
        return _local_rule_fallback(user_message, current_incident, today_date)

def analyze_incident(incident: dict, method: str) -> dict:
    system = """
You are an RCA assistant for pharmaceutical API manufacturing.
Return JSON keys: summary, method, fishbone, five_whys, potential_root_causes,
missing_evidence, capa_recommendations, limitations.
fishbone is an object with People, Method, Machine, Material, Measurement, Environment
as array values. five_whys is an array of {question, answer}.
potential_root_causes is an array of {cause, rationale, evidence, confidence, status}.
Every proposed cause must have status Unverified unless explicit evidence supports it.
missing_evidence is an array of specific evidence requests.
capa_recommendations is an array of {type, action, rationale, suggested_owner, suggested_due_days}.
CAPA type is Corrective or Preventive. Never invent facts, claim regulatory compliance,
or make batch disposition decisions. Avoid changing validated parameters without review.
"""
    payload = {"incident": incident, "requested_method": method}
    return _json_completion(system, json.dumps(payload, ensure_ascii=False)[:18000])
