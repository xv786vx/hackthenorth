#!/usr/bin/env python3
"""
Groq Camera Analyzer - Integrates Groq AI analysis with picamera
Takes every 10th frame from the camera and analyzes it for productivity
"""

import os
import base64
import time
import random
import threading
from datetime import datetime
from pathlib import Path
from typing import Optional

from picamera2 import Picamera2
from PIL import Image
import io

# Import Groq functionality
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
    """Determine the productivity of the image"""
    affirmations = ["Keep up the good work!", "You're doing great!", "You're on the right track!"]
    barbs = ["Get back to work!", "Stop slacking off!", "Lock in!", "What are you doing?"]
    
    if "empty" in analysis.lower():
        return "No person in the image"
    else:
        if "productive" in analysis.lower():
            return f"{random.choice(affirmations)}"
        else:
            return f"{random.choice(barbs)}"
from groq import Groq
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class GroqCameraAnalyzer:
    def __init__(self, size=(640, 480), fps=8):
        """Initialize the camera analyzer with Groq integration"""
        self.picam2 = Picamera2()
        self.picam2.configure(
            self.picam2.create_preview_configuration(
                main={"format": "RGB888", "size": size}
            )
        )
        self.picam2.start()
        
        # Groq setup
        self.api_key = os.getenv("GROQ_API_KEY")
        if not self.api_key:
            raise ValueError("GROQ_API_KEY environment variable not set")
        
        self.client = Groq(api_key=self.api_key)
        print("✅ Groq client initialized successfully")
        
        # Frame counting for every 10th frame
        self.frame_count = 0
        self.analysis_interval = 10  # Analyze every 10th frame
        
        # Threading
        self._lock = threading.Lock()
        self._running = True
        self._fps = max(1, min(fps, 15))
        self._thread = threading.Thread(target=self._capture_and_analyze_loop, daemon=True)
        self._thread.start()
        
        # Create output directory
        self.output_dir = Path("groq_analysis")
        self.output_dir.mkdir(exist_ok=True)
        
        print(f"🎥 Camera started - analyzing every {self.analysis_interval}th frame")
        print("Press Ctrl+C to stop")

    def _capture_and_analyze_loop(self):
        """Main loop that captures frames and analyzes every 10th one"""
        frame_interval = 1.0 / self._fps
        
        while self._running:
            try:
                # Capture frame
                arr = self.picam2.capture_array()  # RGB
                im = Image.fromarray(arr, mode="RGB")
                
                with self._lock:
                    self.frame_count += 1
                
                # Analyze every 10th frame
                if self.frame_count % self.analysis_interval == 0:
                    self._analyze_frame(im, self.frame_count)
                
                time.sleep(frame_interval)
                
            except Exception as e:
                print(f"❌ Error in capture loop: {e}")
                time.sleep(0.1)

    def _analyze_frame(self, image: Image.Image, frame_number: int):
        """Analyze a single frame with Groq"""
        try:
            # Save frame temporarily
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            temp_path = self.output_dir / f"frame_{frame_number}_{timestamp}.jpg"
            
            # Convert PIL image to JPEG bytes
            buf = io.BytesIO()
            image.save(buf, format="JPEG", quality=85, optimize=True)
            jpeg_bytes = buf.getvalue()
            
            # Save to file
            with open(temp_path, 'wb') as f:
                f.write(jpeg_bytes)
            
            print(f"\n📸 Frame {frame_number} saved: {temp_path}")
            
            # Analyze with Groq
            print("🔍 Analyzing frame with Groq...")
            analysis = analyze_image_with_groq(str(temp_path), self.client)
            
            # Display results
            print(f"🤖 Groq Analysis (Frame {frame_number}):")
            print("-" * 60)
            print(analysis)
            print("-" * 60)
            
            # Determine productivity and give feedback
            feedback = determine_image_productivity(analysis)
            print(f"💬 Feedback: {feedback}")
            
            # Clean up temp file (optional - comment out if you want to keep frames)
            # temp_path.unlink()
            
        except Exception as e:
            print(f"❌ Error analyzing frame {frame_number}: {e}")

    def get_latest_frame(self) -> Optional[Image.Image]:
        """Get the latest captured frame (for external use)"""
        try:
            arr = self.picam2.capture_array()
            return Image.fromarray(arr, mode="RGB")
        except Exception:
            return None

    def stop(self):
        """Stop the camera and analysis"""
        print("\n🛑 Stopping camera analyzer...")
        self._running = False
        try:
            self.picam2.stop()
            self.picam2.close()
        except Exception as e:
            print(f"Warning: Error stopping camera: {e}")
        print("✅ Camera analyzer stopped")

def main():
    """Main function to run the Groq camera analyzer"""
    try:
        # Initialize the analyzer
        analyzer = GroqCameraAnalyzer(size=(640, 480), fps=8)
        
        # Keep running until interrupted
        while True:
            time.sleep(1)
            
    except KeyboardInterrupt:
        print("\n🛑 Interrupted by user")
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        if 'analyzer' in locals():
            analyzer.stop()

if __name__ == "__main__":
    main()