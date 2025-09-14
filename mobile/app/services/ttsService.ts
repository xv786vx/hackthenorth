import { Audio } from 'expo-av';

export interface TTSConfig {
  apiKey: string;
  voiceId?: string;
  modelId?: string;
}

export class TTSService {
  private apiKey: string;
  private voiceId: string;
  private modelId: string;
  private sound: Audio.Sound | null = null;

  constructor(config: TTSConfig) {
    this.apiKey = config.apiKey;
    this.voiceId = config.voiceId || 'pNInz6obpgDQGcFmaJgB'; // Default Adam voice
    this.modelId = config.modelId || 'eleven_monolingual_v1';
  }

  async speak(text: string): Promise<void> {
    try {
      console.log("🎤 TTS Service: Starting to speak:", text);
      console.log("🎤 TTS Service: API Key available:", !!this.apiKey);
      console.log("🎤 TTS Service: Voice ID:", this.voiceId);
      // Ensure audio plays even in silent mode (iOS) and properly on Android
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          staysActiveInBackground: false,
          playsInSilentModeIOS: true,
          interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
          shouldDuckAndroid: true,
          interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
          playThroughEarpieceAndroid: false,
        });
      } catch (e) {
        console.warn("🎤 Could not set audio mode:", e);
      }
      
      // Stop any currently playing audio
      if (this.sound) {
        console.log("🎤 TTS Service: Stopping previous audio");
        await this.sound.unloadAsync();
        this.sound = null;
      }

      console.log("🎤 TTS Service: Generating speech...");
      // Generate speech using ElevenLabs API
      const audioData = await this.generateSpeech(text);
      
      console.log("🎤 TTS Service: Creating audio from data URL");
      // Create and play the audio
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioData },
        { shouldPlay: true, volume: 1.0 }
      );
      
      console.log("🎤 TTS Service: Audio created, starting playback");
      this.sound = sound;
      
      // Clean up when finished
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
          this.sound = null;
        }
      });
      
    } catch (error) {
      console.error('Error in TTS service:', error);
      throw error;
    }
  }

  private async generateSpeech(text: string): Promise<string> {
    console.log("🎤 TTS Service: Calling ElevenLabs API for text:", text);
    console.log("🎤 TTS Service: Using voice ID:", this.voiceId);
    
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey,
        },
        body: JSON.stringify({
          text: text,
          model_id: this.modelId,
          voice_settings: {
            stability: 0.3,
            similarity_boost: 0.8,
            style: 0.8,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
    }

    // Convert the audio blob to a data URL for expo-av
    const audioBlob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(audioBlob);
    });
  }

  async stop(): Promise<void> {
    if (this.sound) {
      await this.sound.unloadAsync();
      this.sound = null;
    }
  }

  async dispose(): Promise<void> {
    await this.stop();
  }
}
