import os
import base64
import cv2
import time
from datetime import datetime
from groq import Groq
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

def encode_image(image_path):
    """Encode image to base64 for Groq API"""
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')

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
                        {"type": "text", "text": "Using one noun or phrase, describe the main object/subject in the image."},
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
        )
        
        return chat_completion.choices[0].message.content
    except Exception as e:
        return f"Error analyzing image: {e}"

def main():
    """Main webcam function with periodic photo capture and analysis"""
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
        
        # Check if it's time to capture and analyze
        current_time = time.time()
        if current_time - last_capture_time >= capture_interval:
            # Generate filename with timestamp
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            image_path = f"groq/capture_{timestamp}.jpg"
            
            # Save the current frame
            cv2.imwrite(image_path, frame)
            print(f"\n📸 Photo saved: {image_path}")
            
            # Analyze the image with Groq
            print("🔍 Analyzing image with Groq...")
            analysis = analyze_image_with_groq(image_path, client)
            
            print(f"🤖 Groq Analysis:")
            print("-" * 50)
            print(analysis)
            print("-" * 50)
            
            last_capture_time = current_time
        
        # Check for quit key
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
    
    # Cleanup
    cap.release()
    cv2.destroyAllWindows()
    print("Webcam session ended.")

if __name__ == "__main__":
    main()

# def main():
#     """Test Groq API with proper error handling"""
#     # Get API key from environment variable
#     api_key = os.getenv("GROQ_API_KEY")
    
#     if not api_key:
#         print("Error: GROQ_API_KEY environment variable not set")
#         print("Please set your API key with:")
#         print("  Windows PowerShell: $env:GROQ_API_KEY='your_api_key_here'")
#         print("  Windows CMD: set GROQ_API_KEY=your_api_key_here")
#         print("  Linux/Mac: export GROQ_API_KEY='your_api_key_here'")
#         return
    
#     try:
#         # Initialize Groq client
#         client = Groq(api_key=api_key)
        
#         # Test the API with a simple query
#         print("Testing Groq API...")
#         chat_completion = client.chat.completions.create(
#             messages=[
#                 {
#                     "role": "user",
#                     "content": "Explain the importance of fast language models",
#                 }
#             ],
#             model="meta-llama/llama-4-scout-17b-16e-instruct",  # Using a valid Groq model
#             stream=False,
#         )
        
#         print("✅ Groq API is working correctly!")
#         print("\nResponse:")
#         print(chat_completion.choices[0].message.content)
        
#     except Exception as e:
#         print(f"❌ Error with Groq API: {e}")
#         print("\nTroubleshooting tips:")
#         print("1. Make sure your API key is correct")
#         print("2. Check your internet connection")
#         print("3. Verify you have sufficient API credits")

# if __name__ == "__main__":
#     main()



# def main():
#     # Initialize the webcam (0 is the default camera)
#     cap = cv2.VideoCapture(0)
    
#     # Check if the webcam is opened successfully
#     if not cap.isOpened():
#         print("Error: Could not open webcam")
#         return
    
#     print("Webcam started. Press 'q' to quit.")
    
#     while True:
#         # Read frame from webcam
#         ret, frame = cap.read()
        
#         # If frame is read correctly, ret is True
#         if not ret:
#             print("Error: Can't read frame from webcam")
#             break
        
#         # Display the frame in a window
#         cv2.imshow('Webcam Feed', frame)
        
#         # Break the loop when 'q' is pressed
#         if cv2.waitKey(1) & 0xFF == ord('q'):
#             break
    
#     # Release the webcam and close all windows
#     cap.release()
#     cv2.destroyAllWindows()

# if __name__ == "__main__":
#     main()
