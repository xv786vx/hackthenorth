#!/usr/bin/env python3
import base64
import io
import threading
import time
import random
import os
import queue
from typing import Optional
from pathlib import Path
from time import sleep
from datetime import datetime

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Response, Request, Query
from fastapi.responses import PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
from picamera2 import Picamera2
from PIL import Image
from picamera2.encoders import H264Encoder
from picamera2.outputs import FfmpegOutput
import asyncio
import sqlite3
import requests
import psycopg

# Groq imports
from groq import Groq
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Groq analysis functions
def analyze_image_with_groq(image_path, client):
    """Analyze image using Groq API"""
    try:
        # Encode the image
        with open(image_path, "rb") as image_file:
            image_data = image_file.read()
        
        base64_image = base64.b64encode(image_data).decode('utf-8')
        
        # Send to Groq API
        chat_completion = client.chat.completions.create(
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": """In one sentence, describe what the person is doing in the image. 
                        Then in the next sentence, return either the word "productive" or "unproductive" depending on whether they are being productive or not.
                        Examples of being productive: working on a laptop, writing, cleaning, cooking, etc.
                        Examples of not being productive: lying in bed without sleeping, scrolling through phone, watching TV, etc.
                        If there is no person, return empty."""},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_image}",
                            },
                        },
                    ],
                }
            ],
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            max_completion_tokens=200,
        )
        
        return chat_completion.choices[0].message.content
    except Exception as e:
        return f"Error analyzing image: {e}"

def determine_image_productivity(analysis):
    """Determine the productivity of the image and give dramatic feedback"""
    affirmations = [
        "EXCELLENT! You are being incredibly productive right now!",
        "OUTSTANDING! Keep up this amazing work!",
        "FANTASTIC! You are on fire with productivity!",
        "INCREDIBLE! This is exactly what I want to see!",
        "PHENOMENAL! You are a productivity machine!"
    ]
    barbs = [
        "WAKE UP! You need to get back to work immediately!",
        "STOP WASTING TIME! This is unacceptable!",
        "FOCUS! You are being completely unproductive!",
        "SNAP OUT OF IT! Get back to being productive!",
        "THIS IS NOT OKAY! You need to lock in right now!",
        "WAKE UP CALL! Stop slacking and get to work!",
        "EMERGENCY! Your productivity levels are critically low!",
        "ALERT! You are wasting precious time!",
        "WARNING! This behavior is completely unacceptable!",
        "CRISIS! You need to get productive immediately!"
    ]
    
    if "empty" in analysis.lower():
        return "No person detected in the image"
    else:
        if "productive" in analysis.lower():
            return random.choice(affirmations)
        else:
            return random.choice(barbs)

app = FastAPI()

# Allow Expo app on LAN to connect (loosened for hack/demo)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Simple HTTP request logging (helps debugging) ---
@app.middleware("http")
async def log_requests(request: Request, call_next):
    print(f"[REQ] {request.client.host} {request.method} {request.url.path}")
    resp = await call_next(request)
    print(f"[RESP] {request.url.path} -> {resp.status_code}")
    return resp

# --- Camera manager: runs one camera and keeps the last JPEG in memory ---
class CameraManager:
    def __init__(self, size=(640, 480), fps=8):
        self.picam2 = Picamera2()
        self.picam2.configure(
            self.picam2.create_preview_configuration(
                main={"format": "RGB888", "size": size}
            )
        )
        self.picam2.start()
        self._lock = threading.Lock()
        self._last_jpeg: Optional[bytes] = None
        self._running = True
        self._fps = max(1, min(fps, 15))
        
        # Groq setup
        self.api_key = os.getenv("GROQ_API_KEY")
        self.groq_client = None
        if self.api_key and self.api_key != "your_groq_api_key_here":
            try:
                self.groq_client = Groq(api_key=self.api_key)
                print("✅ Groq client initialized successfully")
                print("🤖 Groq will analyze your productivity and give feedback in the terminal!")
            except Exception as e:
                print(f"⚠️ Warning: Could not initialize Groq client: {e}")
                print("💡 Make sure to set your GROQ_API_KEY in the .env file")
        else:
            print("⚠️ Warning: GROQ_API_KEY not set - Groq analysis disabled")
            print("💡 Set your API key in .env file to enable productivity analysis")
        
        # Frame counting for analysis
        self.frame_count = 0
        self.analysis_interval = 30  # Analyze every 30th frame (about every 4 seconds at 8fps)
        
        # Create output directory for analysis frames
        self.output_dir = Path("groq_analysis")
        self.output_dir.mkdir(exist_ok=True)
        
        self._thread = threading.Thread(target=self._capture_loop, daemon=True)
        self._thread.start()

    def _capture_loop(self):
        frame_interval = 1.0 / self._fps
        while self._running:
            try:
                arr = self.picam2.capture_array()  # RGB
                im = Image.fromarray(arr, mode="RGB")
                buf = io.BytesIO()
                im.save(buf, format="JPEG", quality=75, optimize=True)
                jpeg_bytes = buf.getvalue()
                
                with self._lock:
                    self._last_jpeg = jpeg_bytes
                    self.frame_count += 1
                
                # Analyze every Nth frame if Groq is available
                if (self.groq_client and 
                    self.frame_count % self.analysis_interval == 0):
                    self._analyze_frame_async(im, self.frame_count)
                    
            except Exception as e:
                # avoid log spam; backoff briefly
                time.sleep(0.1)
            time.sleep(frame_interval)

    def _analyze_frame_async(self, image: Image.Image, frame_number: int):
        """Analyze frame in a separate thread to avoid blocking camera"""
        def analyze():
            try:
                # Save frame temporarily
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                temp_path = self.output_dir / f"frame_{frame_number}_{timestamp}.jpg"
                
                # Save image
                image.save(temp_path, format="JPEG", quality=85, optimize=True)
                
                print(f"\n📸 Frame {frame_number} captured for analysis")
                print("🔍 Analyzing with Groq...")
                
                # Analyze with Groq
                analysis = analyze_image_with_groq(str(temp_path), self.groq_client)
                
                # Display results with nice formatting
                print(f"\n🤖 GROQ PRODUCTIVITY ANALYSIS (Frame {frame_number}):")
                print("=" * 70)
                print(analysis)
                print("=" * 70)
                
                # Determine productivity and give feedback
                feedback = determine_image_productivity(analysis)
                print(f"💬 PRODUCTIVITY FEEDBACK: {feedback}")
                print("=" * 70)
                
                # Store latest feedback globally
                import json
                current_timestamp = int(time.time() * 1000)
                latest_feedback.update({
                    "feedback": feedback,
                    "analysis": analysis,
                    "frame_number": frame_number,
                    "timestamp": current_timestamp,
                    "is_new": True
                })
                # Write plaintext feedback file for simple polling
                try:
                    FEEDBACK_FILE_PATH.write_text(feedback, encoding="utf-8")
                    print(f"📝 Wrote latest feedback to {FEEDBACK_FILE_PATH.resolve()}")
                except Exception as e:
                    print(f"❌ Failed to write feedback file: {e}")
                # Post to external sink (Mac) if configured
                post_feedback_to_sink(feedback, current_timestamp)

                # Insert into DB(s)
                insert_feedback_row(feedback, analysis, frame_number, current_timestamp)
                neon_insert_feedback_row(feedback, analysis, frame_number, current_timestamp)
                
                # Send feedback to connected WebSocket clients
                feedback_message = {
                    "type": "feedback",
                    "data": {
                        "analysis": analysis,
                        "feedback": feedback,
                        "frameNumber": frame_number
                    },
                    "timestamp": current_timestamp
                }
                
                # Queue the message for broadcasting (thread-safe)
                try:
                    print(f"📡 Queuing feedback for {len(manager.active_connections)} connected clients")
                    print(f"📡 Message: {feedback_message}")
                    manager.queue_message(json.dumps(feedback_message))
                    print("📡 Feedback queued successfully")
                except Exception as e:
                    print(f"❌ Error queuing feedback: {e}")
                
                # Clean up temp file (optional - comment out if you want to keep frames)
                # temp_path.unlink()
                
            except Exception as e:
                print(f"❌ Error analyzing frame {frame_number}: {e}")
        
        # Run analysis in background thread
        analysis_thread = threading.Thread(target=analyze, daemon=True)
        analysis_thread.start()

    def get_jpeg(self) -> Optional[bytes]:
        with self._lock:
            return self._last_jpeg

    def stop(self):
        self._running = False
        try:
            self.picam2.stop()
        except Exception:
            pass

camera = CameraManager(size=(640, 480), fps=8)

# Optional: post feedback to an external sink (e.g., Mac) when available
FEEDBACK_SINK_URL = os.getenv("FEEDBACK_SINK_URL")  # e.g., http://10.37.113.69:8787/feedback

def post_feedback_to_sink(text: str, timestamp: int):
    if not FEEDBACK_SINK_URL:
        return
    try:
        resp = requests.post(FEEDBACK_SINK_URL, json={"feedback": text, "timestamp": timestamp}, timeout=2)
        print(f"➡️ Posted feedback to sink {FEEDBACK_SINK_URL} -> {resp.status_code}")
    except Exception as e:
        print(f"❌ Failed to post feedback to sink: {e}")

# ---- SQLite storage for feedback ----
DB_PATH = Path("feedback.db")
NEON_DATABASE_URL = os.getenv("NEON_DATABASE_URL")

def init_db():
    try:
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS feedback (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  timestamp INTEGER NOT NULL,
                  frame_number INTEGER NOT NULL,
                  analysis TEXT NOT NULL,
                  feedback TEXT NOT NULL
                )
                """
            )
            conn.commit()
        print(f"🗄️  Feedback DB ready at {DB_PATH.resolve()}")
    except Exception as e:
        print(f"❌ Failed to init DB: {e}")

def insert_feedback_row(feedback_text: str, analysis_text: str, frame_number: int, ts_ms: int):
    try:
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute(
                "INSERT INTO feedback (timestamp, frame_number, analysis, feedback) VALUES (?, ?, ?, ?)",
                (ts_ms, frame_number, analysis_text, feedback_text),
            )
            conn.commit()
    except Exception as e:
        print(f"❌ Failed to insert feedback row: {e}")

init_db()

# ---- NeonDB helpers (optional) ----
def neon_init():
    if not NEON_DATABASE_URL:
        return
    try:
        with psycopg.connect(NEON_DATABASE_URL, autocommit=True) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS feedback (
                      id SERIAL PRIMARY KEY,
                      timestamp BIGINT NOT NULL,
                      frame_number INT NOT NULL,
                      analysis TEXT NOT NULL,
                      feedback TEXT NOT NULL
                    )
                    """
                )
        print("🗄️  NeonDB ready")
    except Exception as e:
        print(f"❌ Failed to init NeonDB: {e}")

def neon_insert_feedback_row(feedback_text: str, analysis_text: str, frame_number: int, ts_ms: int):
    if not NEON_DATABASE_URL:
        return
    try:
        with psycopg.connect(NEON_DATABASE_URL, autocommit=True) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO feedback (timestamp, frame_number, analysis, feedback) VALUES (%s, %s, %s, %s)",
                    (ts_ms, frame_number, analysis_text, feedback_text),
                )
    except Exception as e:
        print(f"❌ Failed to insert feedback row to NeonDB: {e}")

def neon_fetch_latest():
    if not NEON_DATABASE_URL:
        return None
    try:
        with psycopg.connect(NEON_DATABASE_URL) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT timestamp, frame_number, analysis, feedback FROM feedback ORDER BY id DESC LIMIT 1")
                row = cur.fetchone()
                if not row:
                    return None
                ts, frame_num, analysis, feedback = row
                return {
                    "timestamp": ts,
                    "frame_number": frame_num,
                    "analysis": analysis,
                    "feedback": feedback,
                }
    except Exception as e:
        print(f"❌ Failed to fetch latest from NeonDB: {e}")
        return None

neon_init()

@app.get("/health")
def health():
    return {"ok": True}

@app.get("/status")
def status():
    """Check backend status and Groq configuration"""
    groq_status = "disabled"
    if camera.groq_client:
        groq_status = "enabled"
    
    return {
        "backend": "running",
        "groq_analysis": groq_status,
        "active_connections": len(manager.active_connections),
        "frame_count": camera.frame_count,
        "analysis_interval": camera.analysis_interval
    }

@app.get("/feedback.json")
def get_feedback_json():
    """Get the latest productivity feedback as JSON (for polling)"""
    return latest_feedback

@app.get("/feedback/latest")
def feedback_latest():
    """Return the most recent feedback row from SQLite DB."""
    # Prefer NeonDB if configured
    if NEON_DATABASE_URL:
        data = neon_fetch_latest()
        if data:
            return {"success": True, "data": data}
    # Fallback to SQLite
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cur = conn.execute(
                "SELECT timestamp, frame_number, analysis, feedback FROM feedback ORDER BY id DESC LIMIT 1"
            )
            row = cur.fetchone()
            if not row:
                return {"success": True, "data": None}
            ts, frame_num, analysis, feedback = row
            return {
                "success": True,
                "data": {
                    "timestamp": ts,
                    "frame_number": frame_num,
                    "analysis": analysis,
                    "feedback": feedback,
                },
            }
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/generate-voice-line")
async def generate_voice_line(request: Request):
    """Generate a short, punchy voice line based on category and optional analysis.
    Body JSON: { category: str, analysis: str }
    Returns: { text: str }
    """
    try:
        body = await request.json()
    except Exception:
        body = {}
    category = (body.get("category") or "sassy").strip().lower()
    analysis = (body.get("analysis") or "").strip()

    # Fallbacks if Groq is not available
    fallback = {
        "sassy": "Back to work—future you is watching.",
        "phone": "Phone down. Focus up. Ship it.",
        "doomscroll": "Stop scrolling. Start building now.",
        "gaming": "Save game. Save your goals.",
        "sleeping": "Up now. Small step forward.",
        "unproductive": "Refocus. Take one tiny action.",
        "productive": "Locked in. Keep momentum.",
        "encourage": "You’re close. One more minute.",
        "general": "Silence noise. Do the thing.",
    }

    if not camera.groq_client:
        return {"text": fallback.get(category, fallback["sassy"]) }

    # Prompt Groq for a single punchy line
    prompt = (
        f"You are a coach. Generate ONE short, punchy, dramatic line (max 12 words) "
        f"to say out loud in a {category} tone, reacting to this analysis: '{analysis}'. "
        f"Avoid quotes, emojis, and hashtags. Return only the line."
    )

    try:
        chat_completion = camera.groq_client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            max_completion_tokens=40,
        )
        line = (chat_completion.choices[0].message.content or "").strip()
        # sanitize: strip quotes and newlines
        line = line.strip().strip('"').splitlines()[0]
        if not line:
            line = fallback.get(category, fallback["sassy"]) 
        return {"text": line}
    except Exception as e:
        print(f"❌ generate-voice-line error: {e}")
        return {"text": fallback.get(category, fallback["sassy"]) }

# Plaintext feedback file support
FEEDBACK_FILE_PATH = Path("latest_feedback.txt")

@app.get("/feedback.txt")
def get_feedback_txt():
    """Serve the latest productivity feedback as plain text for simple polling."""
    if FEEDBACK_FILE_PATH.exists():
        headers = {
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0",
            "Content-Type": "text/plain; charset=utf-8",
        }
        return Response(content=FEEDBACK_FILE_PATH.read_text(encoding="utf-8"), media_type="text/plain", headers=headers)
    return PlainTextResponse(content="", status_code=204)

@app.get("/test-feedback-simple")
def test_feedback_simple():
    """Simple test endpoint that returns hardcoded feedback"""
    return {
        "feedback": "EXCELLENT! You are being incredibly productive right now! This is a simple test!",
        "analysis": "Test analysis",
        "frame_number": 999,
        "timestamp": int(time.time() * 1000),
        "is_new": True
    }

@app.get("/poll-feedback")
def poll_feedback():
    """Poll for new feedback - returns feedback only if it's new"""
    if latest_feedback["is_new"] and latest_feedback["feedback"]:
        # Mark as not new after returning it
        latest_feedback["is_new"] = False
        return {
            "success": True,
            "has_new_feedback": True,
            "data": latest_feedback
        }
    else:
        return {
            "success": True,
            "has_new_feedback": False,
            "data": None
        }

@app.post("/test-feedback")
async def test_feedback():
    """Test endpoint to send a feedback message via WebSocket"""
    import json
    test_feedback_text = "EXCELLENT! You are being incredibly productive right now! This is a test of the dramatic productivity feedback system!"
    
    # Update latest feedback
    current_timestamp = int(time.time() * 1000)
    latest_feedback.update({
        "feedback": test_feedback_text,
        "analysis": "Test analysis",
        "frame_number": 999,
        "timestamp": current_timestamp,
        "is_new": True
    })
    # Also write plaintext feedback file
    try:
        FEEDBACK_FILE_PATH.write_text(test_feedback_text, encoding="utf-8")
        print(f"📝 Wrote test feedback to {FEEDBACK_FILE_PATH.resolve()}")
    except Exception as e:
        print(f"❌ Failed to write test feedback file: {e}")
    # Post to external sink (Mac) if configured
    post_feedback_to_sink(test_feedback_text, current_timestamp)
    
    # Also queue for WebSocket
    feedback_message = {
        "type": "feedback",
        "data": {
            "analysis": "Test analysis",
            "feedback": test_feedback_text,
            "frameNumber": 999
        },
        "timestamp": current_timestamp
    }
    
    # Queue the message for broadcasting
    manager.queue_message(json.dumps(feedback_message))
    return {"message": "Test feedback queued and stored"}

# Uncacheable latest frame for HTTP polling from Expo app
@app.get("/frame.jpg")
def frame_jpg():
    data = camera.get_jpeg()
    if not data:
        return Response(content=b"", media_type="image/jpeg", status_code=503)
    return Response(
        content=data,
        media_type="image/jpeg",
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )

# Global storage for latest feedback
latest_feedback = {
    "feedback": None,
    "analysis": None,
    "frame_number": 0,
    "timestamp": 0,
    "is_new": False  # Flag to indicate if this is new feedback
}

# WebSocket connections manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []
        self.message_queue = queue.Queue()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"📡 Client connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        print(f"📡 Client disconnected. Total connections: {len(self.active_connections)}")

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def broadcast(self, message: str):
        print(f"📡 Attempting to broadcast to {len(self.active_connections)} connections")
        for i, connection in enumerate(self.active_connections):
            try:
                await connection.send_text(message)
                print(f"📡 Successfully sent to connection {i}")
            except Exception as e:
                print(f"📡 Failed to send to connection {i}: {e}")
                # Remove dead connections
                if connection in self.active_connections:
                    self.active_connections.remove(connection)

    def queue_message(self, message: str):
        """Thread-safe method to queue a message for broadcasting"""
        self.message_queue.put(message)
        print(f"📡 Message queued. Queue size: {self.message_queue.qsize()}")

    async def process_queue(self):
        """Process queued messages - call this periodically"""
        while not self.message_queue.empty():
            try:
                message = self.message_queue.get_nowait()
                await self.broadcast(message)
            except queue.Empty:
                break
            except Exception as e:
                print(f"❌ Error processing queued message: {e}")

manager = ConnectionManager()

# WebSocket stream for camera and feedback
@app.websocket("/ws/camera")
async def ws_camera(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            # Send camera frame
            data = camera.get_jpeg()
            if data:
                b64 = base64.b64encode(data).decode("ascii")
                await ws.send_text(f"data:image/jpeg;base64,{b64}")
            
            # Process any queued feedback messages
            await manager.process_queue()
            
            await asyncio.sleep(0.12)  # ~8 fps
    except WebSocketDisconnect:
        manager.disconnect(ws)

# Optional: trigger short recording to Desktop
@app.post("/record")
def record(seconds: int = Query(5, ge=1, le=60)):
    desktop = Path.home() / "Desktop"
    desktop.mkdir(parents=True, exist_ok=True)
    out_file = desktop / "mobile_clip.mp4"

    enc = H264Encoder(bitrate=5_000_000)
    out = FfmpegOutput(str(out_file))
    camera.picam2.start_recording(enc, out)
    try:
        sleep(seconds)
    finally:
        try:
            camera.picam2.stop_recording()
        except Exception:
            pass
    return {"saved": str(out_file), "seconds": seconds}

@app.on_event("shutdown")
def shutdown_event():
    camera.stop()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
