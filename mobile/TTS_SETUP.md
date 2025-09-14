# ElevenLabs Text-to-Speech Integration Setup

This guide will help you set up ElevenLabs text-to-speech functionality for the React Native app to receive audio feedback from the Groq productivity analysis.

## Prerequisites

1. **ElevenLabs API Key**: Sign up at [ElevenLabs](https://elevenlabs.io/) and get your API key
2. **React Native app** with the required dependencies installed
3. **Python backend** running with Groq integration

## Setup Steps

### 1. Configure ElevenLabs API Key

Edit `/mobile/app/config.ts` and replace the placeholder with your actual API key:

```typescript
export const ELEVENLABS_API_KEY = "your_actual_api_key_here";
```

### 2. Install Dependencies

The required packages should already be installed:
- `expo-av` - For audio playback
- `react-native-sound` - Alternative audio library

### 3. Test the Integration

You can test the TTS functionality using the test script:

```typescript
import { testTTS } from './app/services/testTTS';

// Test with your API key
testTTS('your_api_key_here').then(success => {
  console.log('TTS test result:', success);
});
```

## How It Works

1. **Camera Detection**: The Python backend uses Groq to analyze camera frames
2. **WebSocket Communication**: When productivity feedback is generated, it's sent via WebSocket to connected React Native clients
3. **Text-to-Speech**: The React Native app receives the feedback and converts it to speech using ElevenLabs API
4. **Audio Playback**: The generated audio is played through the phone's speakers

## Features

- **Real-time feedback**: Get audio feedback as soon as the camera detects productivity/unproductivity
- **Toggle control**: Enable/disable TTS functionality from the app
- **Status monitoring**: See WebSocket and TTS connection status
- **Last feedback display**: View the most recent feedback message

## Voice Options

The default voice is Adam (`pNInz6obpgDQGcFmaJgB`), but you can change it in the config:

```typescript
export const ELEVENLABS_VOICE_ID = "your_preferred_voice_id";
```

Available voices can be found in your ElevenLabs dashboard.

## Troubleshooting

### TTS Not Working
1. Check that your ElevenLabs API key is correctly set
2. Verify you have sufficient API credits
3. Check the console for error messages

### WebSocket Connection Issues
1. Ensure the Python backend is running
2. Check that the IP address in `config.ts` matches your Pi's IP
3. Verify network connectivity between devices

### Audio Not Playing
1. Check device volume settings
2. Ensure the app has audio permissions
3. Try testing with the TTS test script

## API Usage

The ElevenLabs API has usage limits based on your plan. Monitor your usage in the ElevenLabs dashboard to avoid hitting limits during development.

## Security Note

Never commit your actual API keys to version control. Consider using environment variables or a secure configuration system for production deployments.
