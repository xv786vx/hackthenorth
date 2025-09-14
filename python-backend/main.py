#!/usr/bin/env python3
import base64
import io
import threading
import time
from typing import Optional
from pathlib import Path
from time import sleep

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Response, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from picamera2 import Picamera2
from PIL import Image
from picamera2.encoders import H264Encoder
from picamera2.outputs import FfmpegOutput
import asyncio

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
                # avoid log spam; backoff briefly
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
