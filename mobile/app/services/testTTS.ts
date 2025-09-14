// Test script for TTS functionality
// This can be used to test the ElevenLabs integration independently

import { TTSService } from './ttsService';

export const testTTS = async (apiKey: string) => {
  try {
    const ttsService = new TTSService({
      apiKey: apiKey,
      voiceId: 'pNInz6obpgDQGcFmaJgB', // Adam voice
    });

    console.log('Testing TTS with sample feedback...');
    await ttsService.speak("Keep up the good work! You're being productive!");
    
    console.log('TTS test completed successfully!');
    return true;
  } catch (error) {
    console.error('TTS test failed:', error);
    return false;
  }
};

// Sample feedback messages for testing
export const sampleFeedbackMessages = [
  "Keep up the good work!",
  "You're doing great!",
  "Get back to work!",
  "Stop slacking off!",
  "Lock in!",
  "What are you doing?",
  "This is not the time for distractions!",
  "Your future self will thank you for being productive right now!",
  "Is this really the best use of your time?",
  "Come on, you can do better than this!",
  "Time to focus up!",
  "Are you sure this is productive?",
  "Nice work, productivity champion!",
  "That's what I like to see!",
  "You're on the right track!"
];
