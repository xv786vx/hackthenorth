import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Alert } from "react-native";
import { useEffect, useState, useRef } from "react";
import { useFonts, Sixtyfour_400Regular } from "@expo-google-fonts/sixtyfour";
import { BACKEND_URL, WS_URL, ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID } from "./config";
import { TTSService } from "./services/ttsService";
import { WebSocketService, FeedbackMessage } from "./services/websocketService";
import * as FileSystem from "expo-file-system";
import { Asset } from "expo-asset";

export default function StatusScreen() {
  let [fontsLoaded] = useFonts({
    Sixtyfour_400Regular,
  });

  // ---- Camera: force HTTP polling for reliability on any Wi-Fi ----
  const [frameUri, setFrameUri] = useState<string | null>(null);
  const [connStatus, setConnStatus] = useState("polling /frame.jpg …");
  
  // ---- TTS and WebSocket services ----
  const [wsStatus, setWsStatus] = useState("disconnected");
  const [lastFeedback, setLastFeedback] = useState<string>("");
  const [isTTSEnabled, setIsTTSEnabled] = useState(true);
  const [isSessionRunning, setIsSessionRunning] = useState(false);
  const ttsServiceRef = useRef<TTSService | null>(null);
  const wsServiceRef = useRef<WebSocketService | null>(null);
  const lastFeedbackTimestampRef = useRef<number>(0);
  const lastSpokenTimestampRef = useRef<number>(0);
  const latestFeedbackRef = useRef<string>("");
  const speakTimerRef = useRef<NodeJS.Timeout | null>(null);
  const latestAnalysisRef = useRef<string>("");
  const voicesMapRef = useRef<Record<string, string[]>>({});

  const clearSpeakTimer = () => {
    if (speakTimerRef.current) {
      clearTimeout(speakTimerRef.current as unknown as number);
      speakTimerRef.current = null;
    }
  };

  const loadVoicesFile = async () => {
    try {
      const asset = Asset.fromModule(require("./assets/voices.txt"));
      await asset.downloadAsync();
      const uri = asset.localUri || asset.uri;
      const content = await FileSystem.readAsStringAsync(uri);
      const map: Record<string, string[]> = {};
      content.split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) return;
        const sep = trimmed.indexOf("|");
        if (sep === -1) return;
        const category = trimmed.slice(0, sep).trim().toLowerCase();
        const phrase = trimmed.slice(sep + 1).trim();
        if (!map[category]) map[category] = [];
        map[category].push(phrase);
      });
      voicesMapRef.current = map;
      console.log("🗣️ Loaded voices.txt categories:", Object.keys(map));
    } catch (e) {
      console.error("❌ Failed to load voices.txt:", e);
    }
  };

  const choosePhraseForLatest = (): string | null => {
    const analysis = (latestAnalysisRef.current || latestFeedbackRef.current || "").toLowerCase();
    const map = voicesMapRef.current;
    const pick = (cat: string) => {
      const arr = map[cat];
      if (!arr || arr.length === 0) return null;
      const idx = Math.floor(Math.random() * arr.length);
      return arr[idx];
    };
    if (/phone|mobile|scroll|instagram|tiktok|doom/.test(analysis)) {
      return pick("phone") || pick("doomscroll") || pick("sassy") || latestFeedbackRef.current || null;
    }
    if (/gaming|game|controller|console/.test(analysis)) {
      return pick("gaming") || pick("sassy") || latestFeedbackRef.current || null;
    }
    if (/sleep|lying|bed/.test(analysis)) {
      return pick("sleeping") || pick("unproductive") || latestFeedbackRef.current || null;
    }
    if (/work|laptop|typing|study|studying|writing|coding|clean|cook/.test(analysis)) {
      return pick("productive") || pick("encourage") || latestFeedbackRef.current || null;
    }
    return pick("sassy") || pick("general") || latestFeedbackRef.current || null;
  };

  const scheduleSpeakIn = (delayMs: number) => {
    clearSpeakTimer();
    speakTimerRef.current = setTimeout(async () => {
      try {
        const phrase = choosePhraseForLatest();
        if (!isSessionRunning || !isTTSEnabled || !ttsServiceRef.current || !phrase) {
          console.log("⏱️ Skip speaking (session/enabled/service/text):", isSessionRunning, isTTSEnabled, !!ttsServiceRef.current, !!phrase);
        } else {
          console.log("⏱️ Speaking (scheduled):", phrase);
          await ttsServiceRef.current.speak(phrase);
          lastSpokenTimestampRef.current = lastFeedbackTimestampRef.current || Date.now();
        }
      } catch (e) {
        console.error("⏱️ Scheduled TTS error:", e);
      } finally {
        const nextMs = 7000 + Math.floor(Math.random() * 8000);
        speakTimerRef.current = setTimeout(async () => {
          try {
            const again = choosePhraseForLatest();
            if (isSessionRunning && isTTSEnabled && ttsServiceRef.current && again) {
              console.log("⏱️ Speaking (repeat):", again, "in", nextMs, "ms");
              await ttsServiceRef.current.speak(again);
              lastSpokenTimestampRef.current = lastFeedbackTimestampRef.current || Date.now();
            } else {
              console.log("⏱️ Repeat skipped");
            }
          } catch (err) {
            console.error("⏱️ Repeat TTS error:", err);
          }
        }, nextMs) as unknown as NodeJS.Timeout;
      }
    }, delayMs) as unknown as NodeJS.Timeout;
  };

  // Initialize TTS service
  useEffect(() => {
    console.log("🎤 Initializing TTS service...");
    console.log("🎤 API Key:", ELEVENLABS_API_KEY ? "Available" : "Missing");
    console.log("🎤 Voice ID:", ELEVENLABS_VOICE_ID);
    
    if (ELEVENLABS_API_KEY && ELEVENLABS_API_KEY.length > 20) {
      ttsServiceRef.current = new TTSService({
        apiKey: ELEVENLABS_API_KEY,
        voiceId: ELEVENLABS_VOICE_ID || "pNInz6obpgDQGcFmaJgB",
      });
      console.log("🎤 TTS Service initialized successfully");
    } else {
      console.error("🎤 TTS Service initialization failed - no API key");
      Alert.alert(
        "TTS Not Configured",
        "Please set your ElevenLabs API key in the .env file to enable text-to-speech functionality."
      );
    }
  }, []);

  // Feedback polling effect (like camera polling)
  useEffect(() => {
    if (!isTTSEnabled) {
      console.log("🎯 TTS is disabled, not polling for feedback");
      return;
    }
    
    console.log("🎯 Starting feedback polling...");
    let alive = true;
    let lastFeedbackTimestamp = 0;
    
    const pollFeedback = async () => {
      while (alive) {
        try {
          console.log("🎯 Polling feedback from:", `${BACKEND_URL}/feedback/latest`);
          const response = await fetch(`${BACKEND_URL}/feedback/latest?ts=${Date.now()}`);
          if (response.ok) {
            const json = await response.json();
            console.log("🎯 Feedback latest received:", json);
            const feedbackData = json && json.success && json.data ? json.data : null;
            if (feedbackData && feedbackData.feedback && feedbackData.timestamp > lastFeedbackTimestamp) {
              console.log("🎯 NEW FEEDBACK DETECTED:", feedbackData.feedback);
              console.log("🎯 Timestamp:", feedbackData.timestamp, "Last:", lastFeedbackTimestamp);
              setLastFeedback(feedbackData.feedback);
              latestFeedbackRef.current = feedbackData.feedback;
              lastFeedbackTimestamp = feedbackData.timestamp;
              lastFeedbackTimestampRef.current = feedbackData.timestamp;
              scheduleSpeakIn(5000);
            } else {
              console.log("🎯 No new feedback (data present:", !!feedbackData, ")");
            }
          } else {
            console.error("🎯 Failed to fetch feedback:", response.status, response.statusText);
          }
        } catch (error) {
          console.error("🎯 Error polling feedback:", error);
        }
        
        await new Promise((r) => setTimeout(r, 2000)); // Poll every 2 seconds
      }
    };
    
    pollFeedback();
    
    return () => {
      console.log("🎯 Stopping feedback polling");
      alive = false;
    };
  }, [isTTSEnabled]);

  // Clear timers when disabling TTS
  useEffect(() => {
    if (!isTTSEnabled) {
      clearSpeakTimer();
    }
  }, [isTTSEnabled]);

  // Initialize WebSocket connection
  useEffect(() => {
    wsServiceRef.current = new WebSocketService(WS_URL);
    
    const handleFeedback = (message: any) => {
      console.log("🎯 FEEDBACK RECEIVED:", message);
      if (message.type === 'feedback' && message.data && message.data.feedback) {
        setLastFeedback(message.data.feedback);
        latestFeedbackRef.current = message.data.feedback;
        latestAnalysisRef.current = message.data.analysis || "";
        const ts = typeof message.timestamp === 'number' ? message.timestamp : Date.now();
        lastFeedbackTimestampRef.current = ts;
        if (isSessionRunning) scheduleSpeakIn(5000);
      }
    };

    wsServiceRef.current.addListener('feedback', handleFeedback);

    // Connect to WebSocket
    wsServiceRef.current.connect()
      .then(() => {
        setWsStatus("connected");
        console.log("WebSocket connected successfully");
      })
      .catch((error) => {
        setWsStatus("error");
        console.error("WebSocket connection failed:", error);
      });

    return () => {
      if (wsServiceRef.current) {
        wsServiceRef.current.removeListener('feedback', handleFeedback);
        wsServiceRef.current.disconnect();
      }
    };
  }, [isTTSEnabled]);

  // Camera polling effect
  useEffect(() => {
    let alive = true;
    const loop = async () => {
      setConnStatus("polling /frame.jpg …");
      while (alive) {
        // cache-buster avoids stale images
        setFrameUri(`${BACKEND_URL}/frame.jpg?ts=${Date.now()}`);
        await new Promise((r) => setTimeout(r, 125)); // ~8 fps
      }
    };
    loop();
    return () => {
      alive = false;
    };
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  // Battery percentage for conditional formatting (placeholder)
  const batteryPercentage = 100;

  const getBatteryColor = (percentage: number) => {
    if (percentage <= 20) return "#ff4444"; // Red
    if (percentage <= 50) return "#ffaa00"; // Yellow
    return "#44ff44"; // Green
  };

  const formatCleaningTime = (totalMinutes: number) => {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}hr ${minutes}m`;
  };

  const cleaningTimeMinutes = 125; // Placeholder

  const renderGrid = () => {
    const gridLines = [];
    const gridSize = 20;
    const screenWidth = 400; // Approximate screen width
    const screenHeight = 800; // Approximate screen height

    for (let i = 0; i <= screenWidth; i += gridSize) {
      gridLines.push(
        <View
          key={`v-${i}`}
          style={[styles.gridLine, { left: i, top: 0, width: 1, height: screenHeight }]}
        />
      );
    }

    for (let i = 0; i <= screenHeight; i += gridSize) {
      gridLines.push(
        <View
          key={`h-${i}`}
          style={[styles.gridLine, { left: 0, top: i, width: screenWidth, height: 1 }]}
        />
      );
    }

    return gridLines;
  };

  return (
    <View style={styles.container}>
      <View style={styles.gridBackground}>{renderGrid()}</View>
      <ScrollView style={styles.scrollContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>Status</Text>
          <TouchableOpacity
            style={{
              backgroundColor: "#FF0000",
              padding: 10,
              margin: 10,
              borderRadius: 5,
            }}
            onPress={() => {
              console.log("🎯 TOP TEST BUTTON PRESSED!");
              Alert.alert("SUCCESS!", "Top test button works! The buttons should be working now.");
            }}
          >
            <Text style={{ color: "white", textAlign: "center", fontWeight: "bold" }}>
              TOP TEST BUTTON
            </Text>
          </TouchableOpacity>
        </View>

        {/* ---- Camera Card ---- */}
        <View style={styles.cameraContainer}>
          <Text style={styles.sectionTitle}>Goose Camera Feed</Text>
          <Text style={{ color: "#8b4513", marginBottom: 6, fontFamily: "Sixtyfour_400Regular", fontSize: 12 }}>
            {connStatus}
          </Text>
          <View style={styles.cameraFeed}>
            {frameUri ? (
              <Image
                source={{ uri: frameUri }}
                style={{ width: "100%", height: "100%" }}
                resizeMode="cover"
              />
            ) : (
              <Text style={styles.cameraPlaceholder}>Connecting to camera…</Text>
            )}
          </View>
        </View>

        {/* ---- TTS Status Card ---- */}
        <View style={styles.ttsContainer}>
          <Text style={styles.sectionTitle}>Voice Feedback</Text>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>WebSocket:</Text>
            <Text style={[styles.statusValue, { color: wsStatus === "connected" ? "#4CAF50" : "#f44336" }]}>
              {wsStatus}
            </Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>TTS:</Text>
            <Text style={[styles.statusValue, { color: isTTSEnabled ? "#4CAF50" : "#f44336" }]}>
              {isTTSEnabled ? "enabled" : "disabled"}
            </Text>
          </View>
          {lastFeedback && (
            <View style={styles.feedbackContainer}>
              <Text style={styles.feedbackLabel}>Last Feedback:</Text>
              <Text style={styles.feedbackText}>{lastFeedback}</Text>
            </View>
          )}
          <View style={styles.debugContainer}>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.debugButton, { backgroundColor: isSessionRunning ? "#f44336" : "#4CAF50" }]}
                onPress={async () => {
                  if (!voicesMapRef.current || Object.keys(voicesMapRef.current).length === 0) {
                    await loadVoicesFile();
                  }
                  const next = !isSessionRunning;
                  setIsSessionRunning(next);
                  if (next) {
                    scheduleSpeakIn(5000);
                  } else {
                    clearSpeakTimer();
                  }
                }}
              >
                <Text style={styles.debugButtonText}>{isSessionRunning ? "Stop Session" : "Start Session"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ---- Summary Card (placeholders) ---- */}
        <View style={styles.summaryContainer}>
          <Text style={styles.sectionTitle}>End of Day Summary</Text>

          <View style={styles.pieChartContainer}>
            <Text style={styles.chartTitle}>Productivity Analysis</Text>
            <View style={styles.pieChart}>
              <View style={[styles.pieSlice, styles.productiveSlice]} />
              <View style={[styles.pieSlice, styles.unproductiveSlice]} />
            </View>
            <View style={styles.chartLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: "#4CAF50" }]} />
                <Text style={styles.legendText}>Productive (50%)</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: "#f44336" }]} />
                <Text style={styles.legendText}>Unproductive (50%)</Text>
              </View>
            </View>
          </View>

          <View style={styles.tasksContainer}>
            <Text style={styles.chartTitle}>Top 5 Detected Activities</Text>
            <View style={styles.taskItem}>
              <Text style={styles.taskText}>This person is gaming</Text>
              <Text style={styles.taskFrequency}>23</Text>
            </View>
            <View style={styles.taskItem}>
              <Text style={styles.taskText}>This person is sitting down</Text>
              <Text style={styles.taskFrequency}>18</Text>
            </View>
            <View style={styles.taskItem}>
              <Text style={styles.taskText}>This person is typing</Text>
              <Text style={styles.taskFrequency}>15</Text>
            </View>
            <View style={styles.taskItem}>
              <Text style={styles.taskText}>This person is eating</Text>
              <Text style={styles.taskFrequency}>12</Text>
            </View>
            <View style={styles.taskItem}>
              <Text style={styles.taskText}>This person is sleeping</Text>
              <Text style={styles.taskFrequency}>8</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

/* ----- Styles (from your original) ----- */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f0", // Warm off-white like goose feathers
  },
  gridBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#f5f5f0",
  },
  gridLine: {
    position: "absolute",
    backgroundColor: "rgba(139, 69, 19, 0.1)", // Saddle brown grid lines
  },
  scrollContainer: {
    flex: 1,
    zIndex: 1,
  },
  header: {
    paddingTop: 60,
    paddingLeft: 20,
    paddingBottom: 20,
  },
  title: {
    fontFamily: "Sixtyfour_400Regular",
    fontSize: 32,
    color: "#8b4513", // Saddle brown like goose beak
  },
  sectionTitle: {
    fontFamily: "Sixtyfour_400Regular",
    fontSize: 20,
    color: "#8b4513", // Saddle brown
    marginBottom: 15,
  },
  cameraContainer: {
    backgroundColor: "#d2b48c", // Tan like goose feathers
    marginHorizontal: 20,
    marginBottom: 30,
    borderRadius: 0,
    borderWidth: 2,
    borderColor: "#8b4513", // Saddle brown border
    padding: 20,
    // Pixel shadow effect
    shadowColor: "#8b4513",
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
  cameraFeed: {
    height: 200,
    backgroundColor: "#000",
    borderRadius: 0,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#8b4513", // Saddle brown border
    // Pixel shadow effect
    shadowColor: "#8b4513",
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
  cameraPlaceholder: {
    fontFamily: "Sixtyfour_400Regular",
    color: "#d2b48c", // Tan color for placeholder
    fontSize: 14,
    textAlign: "center",
  },
  summaryContainer: {
    backgroundColor: "#d2b48c", // Tan like goose feathers
    marginHorizontal: 20,
    marginBottom: 30,
    borderRadius: 0,
    borderWidth: 2,
    borderColor: "#8b4513", // Saddle brown border
    padding: 20,
    // Pixel shadow effect
    shadowColor: "#8b4513",
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
  pieChartContainer: {
    marginBottom: 25,
  },
  chartTitle: {
    fontFamily: "Sixtyfour_400Regular",
    fontSize: 16,
    color: "#8b4513",
    marginBottom: 10,
  },
  pieChart: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 10,
    alignSelf: "center",
    overflow: "hidden",
    position: "relative",
  },
  pieSlice: {
    position: "absolute",
    width: 60,
    height: 120,
  },
  productiveSlice: {
    backgroundColor: "#4CAF50",
    left: 0,
    top: 0,
    borderTopLeftRadius: 60,
    borderBottomLeftRadius: 60,
  },
  unproductiveSlice: {
    backgroundColor: "#f44336",
    right: 0,
    top: 0,
    borderTopRightRadius: 60,
    borderBottomRightRadius: 60,
  },
  chartLegend: {
    flexDirection: "column",
    alignItems: "center",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 6,
  },
  legendColor: {
    width: 12,
    height: 12,
    marginRight: 5,
  },
  legendText: {
    fontFamily: "Sixtyfour_400Regular",
    fontSize: 12,
    color: "#8b4513",
  },
  tasksContainer: {
    marginTop: 15,
  },
  taskItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#8b4513",
  },
  taskText: {
    fontFamily: "Sixtyfour_400Regular",
    fontSize: 12,
    color: "#8b4513",
    flex: 1,
  },
  taskFrequency: {
    fontFamily: "Sixtyfour_400Regular",
    fontSize: 12,
    color: "#8b4513",
    fontWeight: "bold",
  },
  ttsContainer: {
    backgroundColor: "#d2b48c", // Tan like goose feathers
    marginHorizontal: 20,
    marginBottom: 30,
    borderRadius: 0,
    borderWidth: 2,
    borderColor: "#8b4513", // Saddle brown border
    padding: 20,
    // Pixel shadow effect
    shadowColor: "#8b4513",
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  statusLabel: {
    fontFamily: "Sixtyfour_400Regular",
    fontSize: 14,
    color: "#8b4513",
  },
  statusValue: {
    fontFamily: "Sixtyfour_400Regular",
    fontSize: 14,
    fontWeight: "bold",
  },
  feedbackContainer: {
    marginTop: 15,
    padding: 10,
    backgroundColor: "#f5f5f0",
    borderWidth: 1,
    borderColor: "#8b4513",
  },
  feedbackLabel: {
    fontFamily: "Sixtyfour_400Regular",
    fontSize: 12,
    color: "#8b4513",
    marginBottom: 5,
  },
  feedbackText: {
    fontFamily: "Sixtyfour_400Regular",
    fontSize: 12,
    color: "#8b4513",
    fontStyle: "italic",
  },
  debugContainer: {
    marginTop: 15,
    padding: 15,
    backgroundColor: "#f0f0f0",
    borderWidth: 2,
    borderColor: "#8b4513",
  },
  debugTitle: {
    fontFamily: "Sixtyfour_400Regular",
    fontSize: 14,
    color: "#8b4513",
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
    gap: 10,
  },
  debugButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 0,
    borderWidth: 2,
    borderColor: "#8b4513",
    alignItems: "center",
  },
  debugButtonText: {
    fontFamily: "Sixtyfour_400Regular",
    fontSize: 11,
    color: "white",
    fontWeight: "bold",
    textAlign: "center",
  },
  toggleButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 0,
    borderWidth: 2,
    borderColor: "#8b4513",
    minWidth: 100,
  },
  toggleButtonText: {
    fontFamily: "Sixtyfour_400Regular",
    fontSize: 12,
    color: "#8b4513",
    fontWeight: "bold",
  },
});
