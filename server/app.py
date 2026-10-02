"""
LeadFlow CRM — Backend API Server
Bridges the Scraper Engine, WhatsApp Automation, and Supabase
with the Next.js CRM Dashboard via REST API.
"""

import os
import sys
import json
import threading
import time
import re
import importlib.util
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS

# Add parent directory so we can import the WhatsApp module
PARENT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, PARENT_DIR)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from scraper import run_scraper, BUSINESS_CATEGORIES, CITIES
from whatsapp_engine import WhatsAppEngine

# Try to import Supabase
try:
    from supabase import create_client
except ImportError:
    create_client = None

app = Flask(__name__)
CORS(app, origins=["http://localhost:3000", "http://127.0.0.1:3000"])

# ============================================================
# GLOBAL STATE
# ============================================================

scraper_state = {
    "is_running": False,
    "logs": [],
    "stats": {"total": 0, "with_website": 0, "without_website": 0, "duplicates": 0, "errors": 0},
    "current_query": "",
    "progress": {"current": 0, "total": 0},
    "thread": None,
    "stop_requested": False,
}

whatsapp_state = {
    "is_running": False,
    "sent_today": 0,
    "daily_limit": 50,
    "min_delay": 25,
    "max_delay": 60,
    "logs": [],
    "queue": []
}

wa_engine = WhatsAppEngine(whatsapp_state)

# Supabase client
supabase_client = None
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")


def init_supabase(url=None, key=None):
    global supabase_client, SUPABASE_URL, SUPABASE_KEY
    url = url or SUPABASE_URL
    key = key or SUPABASE_KEY
    if url and key and create_client:
        try:
            supabase_client = create_client(url, key)
            SUPABASE_URL = url
            SUPABASE_KEY = key
            return True
        except Exception as e:
            print(f"Supabase init error: {e}")
    return False


# ============================================================
# SCRAPER CALLBACK — captures events for the frontend
# ============================================================

def scraper_callback(event_type, data):
    """Called by the scraper engine for each event."""
    timestamp = datetime.now().strftime("%H:%M:%S")

    if event_type == "log":
        log_entry = {"time": timestamp, "type": data.get("type", "info"), "text": data.get("text", "")}
        scraper_state["logs"].append(log_entry)
        # Keep only last 200 logs in memory
        if len(scraper_state["logs"]) > 200:
            scraper_state["logs"] = scraper_state["logs"][-200:]

    elif event_type == "lead_found":
        scraper_state["stats"]["total"] += 1
        if data.get("website_url"):
            scraper_state["stats"]["with_website"] += 1
        else:
            scraper_state["stats"]["without_website"] += 1

    elif event_type == "progress":
        scraper_state["progress"] = {"current": data["current"], "total": data["total"]}
        scraper_state["current_query"] = data.get("query", "")

    elif event_type == "done":
        scraper_state["is_running"] = False
        scraper_state["stats"] = data


def scraper_thread_target(categories, cities, custom_queries):
    """Runs the scraper in a background thread."""
    try:
        scraper_state["is_running"] = True
        scraper_state["stop_requested"] = False
        scraper_state["logs"] = []
        scraper_state["stats"] = {"total": 0, "with_website": 0, "without_website": 0, "duplicates": 0, "errors": 0}

        run_scraper(
            categories=categories,
            cities=cities,
            custom_queries=custom_queries,
            supabase_url=SUPABASE_URL,
            supabase_key=SUPABASE_KEY,
            headless=False,
            callback=scraper_callback,
        )
    except Exception as e:
        scraper_state["logs"].append({
            "time": datetime.now().strftime("%H:%M:%S"),
            "type": "error",
            "text": f"Scraper crashed: {str(e)}"
        })
    finally:
        scraper_state["is_running"] = False


# ============================================================
# API ROUTES — SCRAPER
# ============================================================

@app.route("/api/scraper/categories", methods=["GET"])
def get_categories():
    """Return the full list of available business categories and cities."""
    return jsonify({
        "categories": BUSINESS_CATEGORIES,
        "cities": CITIES,
    })


@app.route("/api/scraper/start", methods=["POST"])
def start_scraper():
    """Start the scraping engine with selected categories and cities."""
    if scraper_state["is_running"]:
        return jsonify({"error": "Scraper is already running"}), 400

    data = request.json or {}
    categories = data.get("categories", [])
    cities = data.get("cities", [])
    custom_queries = data.get("custom_queries", [])

    if not custom_queries and (not categories or not cities):
        return jsonify({"error": "Select at least one category and one city"}), 400

    thread = threading.Thread(
        target=scraper_thread_target,
        args=(categories if categories else None, cities if cities else None, custom_queries if custom_queries else None),
        daemon=True,
    )
    scraper_state["thread"] = thread
    thread.start()

    return jsonify({"status": "started", "message": "Scraper started successfully"})


@app.route("/api/scraper/stop", methods=["POST"])
def stop_scraper():
    """Request the scraper to stop."""
    scraper_state["stop_requested"] = True
    scraper_state["is_running"] = False
    scraper_state["logs"].append({
        "time": datetime.now().strftime("%H:%M:%S"),
        "type": "warning",
        "text": "⏹ Stop requested by user"
    })
    return jsonify({"status": "stopping"})


@app.route("/api/scraper/status", methods=["GET"])
def scraper_status():
    """Get current scraper status, logs, and stats."""
    # Only return logs since the last poll (or last 50)
    since = request.args.get("since", 0, type=int)
    logs_slice = scraper_state["logs"][since:]

    return jsonify({
        "is_running": scraper_state["is_running"],
        "logs": logs_slice,
        "total_logs": len(scraper_state["logs"]),
        "stats": scraper_state["stats"],
        "progress": scraper_state["progress"],
        "current_query": scraper_state["current_query"],
    })


# ============================================================
# API ROUTES — LEADS (Supabase)
# ============================================================

@app.route("/api/leads", methods=["GET"])
def get_leads():
    """Fetch leads from Supabase. ?type=website or ?type=no-website"""
    if not supabase_client:
        # Return from local JSON files as fallback
        return get_leads_local()

    lead_type = request.args.get("type", "all")
    try:
        if lead_type == "website":
            result = supabase_client.table("leads_with_website").select("*").order("created_at", desc=True).execute()
            return jsonify({"leads": result.data, "type": "website"})
        elif lead_type == "no-website":
            result = supabase_client.table("leads_without_website").select("*").order("created_at", desc=True).execute()
            return jsonify({"leads": result.data, "type": "no-website"})
        else:
            with_web = supabase_client.table("leads_with_website").select("*").order("created_at", desc=True).execute()
            without_web = supabase_client.table("leads_without_website").select("*").order("created_at", desc=True).execute()
            return jsonify({
                "leads_with_website": with_web.data,
                "leads_without_website": without_web.data,
            })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def get_leads_local():
    """Fallback: read from local JSON files."""
    server_dir = os.path.dirname(os.path.abspath(__file__))
    leads_web = []
    leads_no_web = []

    web_file = os.path.join(server_dir, "leads_with_website.json")
    no_web_file = os.path.join(server_dir, "leads_without_website.json")

    if os.path.exists(web_file):
        with open(web_file, "r") as f:
            leads_web = json.load(f)
    if os.path.exists(no_web_file):
        with open(no_web_file, "r") as f:
            leads_no_web = json.load(f)

    return jsonify({
        "leads_with_website": leads_web,
        "leads_without_website": leads_no_web,
    })


@app.route("/api/leads/<lead_id>/status", methods=["PATCH"])
def update_lead_status(lead_id):
    """Update a lead's status (New, Contacted, Interested, Meeting, Closed, Rejected)."""
    data = request.json or {}
    new_status = data.get("status")
    table = data.get("table", "leads_with_website")

    if not supabase_client:
        return jsonify({"error": "Supabase not connected"}), 400

    try:
        result = supabase_client.table(table).update({"status": new_status}).eq("id", lead_id).execute()
        return jsonify({"status": "updated", "data": result.data})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ============================================================
# API ROUTES — WHATSAPP
# ============================================================

@app.route("/api/whatsapp/send", methods=["POST"])
def send_whatsapp():
    """
    Send a WhatsApp message to a single number.
    Uses the existing WhatsApp Automation module's Selenium logic.
    """
    data = request.json or {}
    phone = data.get("phone", "")
    message = data.get("message", "")

    if not phone or not message:
        return jsonify({"error": "Phone and message are required"}), 400

    if whatsapp_state["sent_today"] >= whatsapp_state["daily_limit"]:
        return jsonify({"error": "Daily sending limit reached"}), 429

    whatsapp_state["queue"].append({"phone": phone, "message": message})
    if not wa_engine.running:
        wa_engine.start_worker()

    whatsapp_state["logs"].append({
        "time": datetime.now().strftime("%H:%M:%S"),
        "phone": phone,
        "status": "queued",
        "message_preview": message[:50] + "...",
    })

    return jsonify({"status": "queued", "sent_today": whatsapp_state["sent_today"]})


@app.route("/api/whatsapp/campaign/start", methods=["POST"])
def start_campaign():
    """
    Start a WhatsApp campaign.
    Expects: { leads: [...], message_template: "...", daily_limit: 50, delay: 60 }
    """
    data = request.json or {}
    leads = data.get("leads", [])
    template = data.get("message_template", "")
    daily_limit = data.get("daily_limit", 50)
    delay = data.get("delay", 60)

    if not leads or not template:
        return jsonify({"error": "Leads and message template are required"}), 400

    whatsapp_state["daily_limit"] = daily_limit

    # Queue all leads for the campaign
    queued = 0
    for lead in leads:
        # Personalize the message
        msg = template
        for key, value in lead.items():
            msg = msg.replace(f"{{{{{key}}}}}", str(value or ""))

        phone = lead.get("phone_number", "")
        if not phone:
            continue

        whatsapp_state["queue"].append({
            "phone": phone,
            "message": msg
        })

        whatsapp_state["logs"].append({
            "time": datetime.now().strftime("%H:%M:%S"),
            "phone": phone,
            "business": lead.get("business_name", ""),
            "status": "queued",
            "message_preview": msg[:60],
        })
        queued += 1

    if queued > 0 and not wa_engine.running:
        wa_engine.start_worker()

    return jsonify({"status": "campaign_started", "queued": queued, "total_leads": len(leads)})


@app.route("/api/whatsapp/status", methods=["GET"])
def whatsapp_status():
    """Get WhatsApp automation status."""
    return jsonify({
        "is_running": whatsapp_state["is_running"],
        "sent_today": whatsapp_state["sent_today"],
        "daily_limit": whatsapp_state["daily_limit"],
        "logs": whatsapp_state["logs"][-50:],
    })


@app.route("/api/whatsapp/settings", methods=["POST"])
def update_whatsapp_settings():
    """Update WhatsApp automation limits."""
    data = request.json or {}
    if "daily_limit" in data:
        whatsapp_state["daily_limit"] = int(data["daily_limit"])
    return jsonify({"status": "updated", "settings": {
        "daily_limit": whatsapp_state["daily_limit"],
    }})


# ============================================================
# API ROUTES — SUPABASE CONNECTION
# ============================================================

@app.route("/api/supabase/connect", methods=["POST"])
def connect_supabase():
    """Test and save Supabase connection."""
    data = request.json or {}
    url = data.get("url", "")
    key = data.get("key", "")

    if not url or not key:
        return jsonify({"error": "URL and key are required"}), 400

    if init_supabase(url, key):
        return jsonify({"status": "connected"})
    else:
        return jsonify({"error": "Failed to connect to Supabase"}), 400


@app.route("/api/supabase/status", methods=["GET"])
def supabase_status():
    """Check if Supabase is connected."""
    return jsonify({
        "connected": supabase_client is not None,
        "url": SUPABASE_URL[:30] + "..." if SUPABASE_URL else "",
    })


# ============================================================
# HEALTH CHECK
# ============================================================

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "scraper_running": scraper_state["is_running"],
        "supabase_connected": supabase_client is not None,
        "whatsapp_sent_today": whatsapp_state["sent_today"],
    })


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("  ⚡ LeadFlow CRM — Backend API Server")
    print("=" * 60)
    print(f"  🌐 API running at http://localhost:5001")
    print(f"  📊 Dashboard at http://localhost:3000")
    print("=" * 60 + "\n")

    # Try to connect Supabase from env vars
    init_supabase()

    app.run(host="0.0.0.0", port=5001, debug=True)
