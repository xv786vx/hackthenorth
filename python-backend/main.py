#!/usr/bin/env python3
import base64
import io
import threading
import time
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Response, Query
from fastapi.middleware.cors import CORSMiddleware
from picamera2 import Picamera2
from PIL import Image
import numpy as np

app = FastAPI()

# --- CORS so the Expo app (phone) can hit this from LAN ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Camera manager (single instance) ---
class CameraManager:
    def __init__(self, size=(640, 480), fps=6):
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
            except Exception as e:
                # Avoid spam; small sleep then retry
                time.sleep(0.1)
            time.sleep(frame_interval)

    def get_jpeg(self) -> Optional[bytes]:
        with self._lock:
            return self._last_jpeg

    def stop(self):
        self._running = False
        try:
            self.picam2.stop()
        except Exception:
            pass

camera = CameraManager(size=(640, 480), fps=6)

# --- Simple health ---
@app.get("/health")
def health():
    return {"ok": True}

# --- Latest frame as JPEG (good for polling) ---
@app.get("/frame.jpg")
def frame_jpg():
    data = camera.get_jpeg()
    if not data:
        return Response(content=b"", media_type="image/jpeg", status_code=503)
    return Response(content=data, media_type="image/jpeg")

# --- WebSocket: streams base64 JPEG frames ---
@app.websocket("/ws/camera")
async def ws_camera(ws: WebSocket):
    await ws.accept()
    try:
        while True:
            data = camera.get_jpeg()
            if data:
                # Send as data URL (base64) so the RN app can set <Image source={{uri}} />
                b64 = base64.b64encode(data).decode("ascii")
                await ws.send_text(f"data:image/jpeg;base64,{b64}")
            await asyncio_sleep(0.16)  # ~6 fps
    except WebSocketDisconnect:
        pass

# Small asyncio sleep helper (to avoid importing asyncio at top)
import asyncio
async def asyncio_sleep(t: float):
    await asyncio.sleep(t)

# --- Optional: record short MP4 to Desktop ---
from picamera2.encoders import H264Encoder
from picamera2.outputs import FfmpegOutput
from pathlib import Path
from time import sleep

@app.post("/record")
def record(seconds: int = Query(5, ge=1, le=60)):
    desktop = Path.home() / "Desktop"
    desktop.mkdir(parents=True, exist_ok=True)
    out_file = desktop / "mobile_clip.mp4"

    enc = H264Encoder(bitrate=5_000_000)
    out = FfmpegOutput(str(out_file))
    # Reuse running camera; start a temporary recording
    camera.picam2.start_recording(enc, out)
    try:
        sleep(seconds)
    finally:
        try:
            camera.picam2.stop_recording()
        except Exception:
            pass
    return {"saved": str(out_file), "seconds": seconds}

# --- Graceful shutdown ---
@app.on_event("shutdown")
def shutdown_event():
    camera.stop()

if __name__ == "__main__":
    import uvicorn
    # 0.0.0.0 so phones on LAN can reach it; change port if you like
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
