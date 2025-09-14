import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';

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
          // Omit interruptionMode* to avoid invalid values on some SDKs
          shouldDuckAndroid: true,
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
    console.log('🎤 ElevenLabs status:', response.status, response.statusText);
    if (!response.ok) {
      const errTxt = await response.text().catch(() => '');
      console.log('🎤 ElevenLabs error body:', errTxt);
      throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
    }

    // Save the audio to a file and return file:// URI (more reliable on device)
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    // Convert to base64
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = typeof btoa !== 'undefined' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
    const fileUri = `${FileSystem.cacheDirectory || ''}tts_${Date.now()}.mp3`;
    await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
    console.log('🎤 Saved TTS file:', fileUri);
    return fileUri;
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
