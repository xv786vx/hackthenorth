import os
import base64
import cv2
import time
import random
from datetime import datetime
from groq import Groq
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

def encode_image(image_path):
    """Encode image to base64 for Groq API"""
    try:
        print(f"🔧 Encoding image: {image_path}")
        
        # Read the image file
        with open(image_path, "rb") as image_file:
            image_data = image_file.read()
        
        print(f"📊 Image data size: {len(image_data)} bytes")
        
        # Check if the file is not empty
        if len(image_data) == 0:
            raise ValueError("Image file is empty")
        
        # Encode to base64
        base64_string = base64.b64encode(image_data).decode('utf-8')
        
        print(f"📊 Base64 string length: {len(base64_string)} characters")
        print(f"📊 Base64 preview (first 50 chars): {base64_string[:50]}...")
        
        # Validate the base64 string
        if not base64_string:
            raise ValueError("Failed to encode image to base64")
        
        return base64_string
    except Exception as e:
        raise ValueError(f"Error encoding image '{image_path}': {e}")

### Groq ###
def analyze_image_with_groq(image_path, client):
    """Analyze image using Groq API"""
    try:
        # Encode the image
        base64_image = encode_image(image_path)
        
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


### Webcam ###
def capture_and_analyze_frame(cap, client, capture_interval, last_capture_time):
    """Capture a frame from webcam and analyze it with Groq"""
    current_time = time.time()
    
    # Check if it's time to capture
    if current_time - last_capture_time < capture_interval:
        return last_capture_time
    
    # Generate filename with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    image_path = f"groq/capture_{timestamp}.jpg"
    
    # Capture current frame
    ret, frame = cap.read()
    if not ret:
        print("Error: Could not capture frame")
        return last_capture_time
    
    # Save the frame
    cv2.imwrite(image_path, frame)
    print(f"\n📸 Photo saved: {image_path}")
    
    # Analyze the image with Groq
    print("🔍 Analyzing image with Groq...")
    analysis = analyze_image_with_groq(image_path, client)
    
    print(f"🤖 Groq Analysis:")
    print("-" * 50)
    print(analysis)
    print("-" * 50)
    
    return current_time

def analyze_existing_image(image_path, client):
    """Analyze an existing image file without webcam"""
    if not os.path.exists(image_path):
        print(f"Error: Image file '{image_path}' not found")
        return None
    
    # Check file size and basic info
    file_size = os.path.getsize(image_path)
    print(f"🔍 Analyzing existing image: {image_path}")
    print(f"📁 File size: {file_size} bytes")
    
    if file_size == 0:
        print("❌ Error: Image file is empty (0 bytes)")
        return None
    
    # Try to validate the image with OpenCV first
    try:
        test_img = cv2.imread(image_path)
        if test_img is None:
            print("❌ Error: OpenCV cannot read this image file")
            return None
        print(f"✅ Image validation passed - dimensions: {test_img.shape}")
    except Exception as e:
        print(f"❌ Error validating image with OpenCV: {e}")
        return None
    
    analysis = analyze_image_with_groq(image_path, client)
    
    print(f"🤖 Groq Analysis:")
    print("-" * 50)
    print(analysis)
    print("-" * 50)
    
    return analysis

def run_webcam_loop(cap, client):
    """Main webcam processing loop"""
    print("Webcam started. Taking photos every 10 seconds...")
    print("Press 'q' to quit.")
    
    # Create groq folder if it doesn't exist
    os.makedirs("groq", exist_ok=True)
    
    last_capture_time = 0
    capture_interval = 10  # seconds
    
    while True:
        # Read frame from webcam
        ret, frame = cap.read()
        
        if not ret:
            print("Error: Can't read frame from webcam")
            break
        
        # Display the frame
        cv2.imshow('Webcam Feed - Press q to quit', frame)
        
        # Capture and analyze if it's time
        last_capture_time = capture_and_analyze_frame(cap, client, capture_interval, last_capture_time)
        
        # Check for quit key
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

affirmations = ["Keep up the good work!", "You're doing great!", "You're on the right track!"]
barbs = ["Get back to work!", "Stop slacking off!", "Lock in!", "What are you doing?"]

def determine_image_productivity(analysis):
    """Determine the productivity of the image"""
    if "empty" in analysis.lower():
        return "No person in the image"
    else:
        if "working" in analysis.lower():
            return f"{random.choice(affirmations)}"
        else:
            return f"{random.choice(barbs)}"


def main():
    """Main function to initialize and run webcam with Groq analysis"""
    # Get API key
    api_key = os.getenv("GROQ_API_KEY")
    
    if not api_key:
        print("Error: GROQ_API_KEY environment variable not set")
        print("Please create a .env file with your API key")
        return
    
    # Initialize Groq client
    try:
        client = Groq(api_key=api_key)
        print("✅ Groq client initialized successfully")
    except Exception as e:
        print(f"❌ Error initializing Groq client: {e}")
        return
    
    # Initialize the webcam
    cap = cv2.VideoCapture(0)
    
    if not cap.isOpened():
        print("Error: Could not open webcam")
        return
    
    try:
        # Run the main webcam processing loop
        run_webcam_loop(cap, client)
    finally:
        # Cleanup
        cap.release()
        cv2.destroyAllWindows()
        print("Webcam session ended.")


if __name__ == "__main__":
    # Uncomment the line below to run the webcam version
    # main()
    
    # Test with existing image (no webcam)
    api_key = os.getenv("GROQ_API_KEY")
    
    if not api_key:
        print("Error: GROQ_API_KEY environment variable not set")
        print("Please create a .env file with your API key")
        exit(1)
    
    # Initialize Groq client
    try:
        client = Groq(api_key=api_key)
        print("✅ Groq client initialized successfully")
    except Exception as e:
        print(f"❌ Error initializing Groq client: {e}")
        exit(1)
    
    # Analyze existing image
    image_path = "htngroq_test5.jpg"
    try:
        analysis = analyze_existing_image(image_path, client)
        if analysis:
            print(f"\n✅ Analysis completed successfully!")
        else:
            print(f"\n❌ Analysis failed - check the error messages above")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
    print(determine_image_productivity(analysis))