#!/usr/bin/env python3
import base64
import io
import threading
import time
import random
import os
from typing import Optional
from pathlib import Path
from time import sleep
from datetime import datetime

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Response, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from picamera2 import Picamera2
from PIL import Image
from picamera2.encoders import H264Encoder
from picamera2.outputs import FfmpegOutput
import asyncio

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
    """Determine the productivity of the image and give passive-aggressive feedback"""
    affirmations = [
        "Keep up the good work!", 
        "You're doing great!", 
        "You're on the right track!",
        "Nice work, productivity champion!",
        "That's what I like to see!"
    ]
    barbs = [
        "Get back to work!", 
        "Stop slacking off!", 
        "Lock in!", 
        "What are you doing?",
        "This is not the time for distractions!",
        "Your future self will thank you for being productive right now!",
        "Is this really the best use of your time?",
        "Come on, you can do better than this!",
        "Time to focus up!",
        "Are you sure this is productive?"
    ]
    
    if "empty" in analysis.lower():
        return "No person detected in the image"
    else:
        if "productive" in analysis.lower():
            return f"🎉 {random.choice(affirmations)}"
        else:
            return f"😤 {random.choice(barbs)}"

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

@app.get("/health")
def health():
    return {"ok": True}

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

# Optional: WebSocket stream (keep for networks that allow it)
@app.websocket("/ws/camera")
async def ws_camera(ws: WebSocket):
    await ws.accept()
    try:
        while True:
            data = camera.get_jpeg()
            if data:
                b64 = base64.b64encode(data).decode("ascii")
                await ws.send_text(f"data:image/jpeg;base64,{b64}")
            await asyncio.sleep(0.12)  # ~8 fps
    except WebSocketDisconnect:
        pass

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
