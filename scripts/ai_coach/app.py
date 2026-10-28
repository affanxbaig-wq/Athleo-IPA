#!/usr/bin/env python3
"""Small Flask API wrapper for the AI coach.

Endpoints:
  POST /chat  -> JSON { context: {...}, message: "..." } returns { reply: "..." }
  GET  /health -> { status: "ok" }
"""
import os
from pathlib import Path

try:
    from dotenv import load_dotenv
except ImportError:
    def load_dotenv(*args, **kwargs):
        return False

# Load local .env placed alongside this file (if present)
load_dotenv(Path(__file__).parent / ".env")

from flask import Flask, request, jsonify
from flask_cors import CORS
from coach import AICoach

app = Flask(__name__)
CORS(app)

coach = AICoach(coach_name="AppCoach", app_name="Athleo", focus_area="fitness")


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json(force=True, silent=True) or {}
    context = data.get("context") or {}
    message = data.get("message", "")
    reply = coach.respond(context, message)
    return jsonify({"reply": reply})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080, debug=False)
