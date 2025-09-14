#!/usr/bin/env python3
"""
Simple script to set up Groq API key for the Raspberry Pi backend
"""

import os

def setup_groq():
    """Set up Groq API key"""
    print("🤖 Groq API Key Setup for Raspberry Pi")
    print("=" * 50)
    print("This will create a .env file with your Groq API key.")
    print("You need this for the productivity analysis to work.")
    print()
    
    # You can either input the key or set it directly here
    api_key = input("Enter your Groq API key: ").strip()
    
    if not api_key:
        print("❌ No API key provided!")
        return
    
    # Create .env file
    with open('.env', 'w') as f:
        f.write(f"GROQ_API_KEY={api_key}\n")
    
    print("✅ API key saved to .env file")
    print("🚀 Restart your backend to enable Groq analysis!")
    print()
    print("To restart the backend:")
    print("1. Stop the current backend (Ctrl+C)")
    print("2. Run: python main.py")

if __name__ == "__main__":
    setup_groq()
