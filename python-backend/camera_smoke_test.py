#!/usr/bin/env python3
from picamera2 import Picamera2
from picamera2.encoders import H264Encoder
from picamera2.outputs import FfmpegOutput
from time import sleep
from pathlib import Path

def main():
    # Save to ~/Desktop/video.mp4
    desktop = Path.home() / "Desktop"
    desktop.mkdir(parents=True, exist_ok=True)
    out_file = desktop / "video.mp4"

    picam2 = Picamera2()

    # 720p @ 30fps keeps CPU/GPU load modest; adjust if you like
    video_config = picam2.create_video_configuration(
        main={"size": (1280, 720)},
        controls={"FrameDurationLimits": (33333, 33333)}  # ~30 fps
    )
    picam2.configure(video_config)

    encoder = H264Encoder(bitrate=5_000_000)  # ~5 Mbps
    output = FfmpegOutput(str(out_file))      # mux to MP4 via ffmpeg

    try:
        picam2.start_recording(encoder, output)
        sleep(5)  # record for 5 seconds
    finally:
        # Always stop cleanly even if Ctrl+C happens
        try:
            picam2.stop_recording()
        except Exception:
            pass
        picam2.close()

    print(f"Saved: {out_file}")

if __name__ == "__main__":
    main()

