#!/usr/bin/env python3
"""
Setup script to configure Groq API key
"""

import os

def setup_groq_api_key():
    """Interactive setup for Groq API key"""
    print("🤖 Groq API Key Setup")
    print("=" * 50)
    print("To use Groq productivity analysis, you need an API key.")
    print("1. Go to https://console.groq.com/")
    print("2. Sign up/login and get your API key")
    print("3. Enter it below")
    print()
    
    api_key = input("Enter your Groq API key (or press Enter to skip): ").strip()
    
    if api_key:
        # Create .env file
        with open('.env', 'w') as f:
            f.write(f"GROQ_API_KEY={api_key}\n")
        print("✅ API key saved to .env file")
        print("🚀 You can now run your camera with Groq analysis!")
    else:
        print("⚠️ No API key provided - Groq analysis will be disabled")
        print("💡 You can set it later by editing the .env file")

if __name__ == "__main__":
    setup_groq_api_key()
