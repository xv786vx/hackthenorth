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
      // Stop any currently playing audio
      if (this.sound) {
        await this.sound.unloadAsync();
        this.sound = null;
      }

      // Generate speech using ElevenLabs API
      const audioData = await this.generateSpeech(text);
      
      // Create and play the audio
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioData },
        { shouldPlay: true }
      );
      
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
            stability: 0.5,
            similarity_boost: 0.5,
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
