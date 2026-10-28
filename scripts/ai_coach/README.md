# AI Fitness Coach (Python)

This small package provides a role-driven AI fitness coach implemented in Python.

Features:
- Implements the coaching rules you provided as a prompt template.
- Works offline with a deterministic, short heuristic fallback.
- Optionally uses OpenAI if `OPENAI_API_KEY` is set.

Quick demo:

```bash
python scripts/ai_coach/coach.py --demo
```

Interactive mode:

```bash
python scripts/ai_coach/coach.py
```

If you want LLM responses install `openai` and set `OPENAI_API_KEY` in your environment.

API wrapper

1. Install the Python requirements for the API:

```bash
python -m pip install -r scripts/ai_coach/requirements.txt
```

2. Run the API locally:

```bash
python scripts/ai_coach/app.py
```

3. Example fetch from React Native (JS):

```javascript
async function sendChat(context, message){
	const res = await fetch('http://10.0.2.2:8080/chat', {
		method: 'POST',
		headers: {'Content-Type':'application/json'},
		body: JSON.stringify({ context, message }),
	});
	const json = await res.json();
	return json.reply;
}
```

Language & OpenAI

- The coach attempts to detect Urdu (Perso-Arabic script), Roman Urdu (simple token checks), or English and will request responses in the same language when OpenAI is available.
- To enable OpenAI responses set `OPENAI_API_KEY` in your environment before starting the API server.

