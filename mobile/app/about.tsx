import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Alert } from "react-native";
import { useEffect, useState, useRef } from "react";
import { useFonts, Sixtyfour_400Regular } from "@expo-google-fonts/sixtyfour";
import { BACKEND_URL, WS_URL, ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID } from "./config";
import { TTSService } from "./services/ttsService";
import { WebSocketService, FeedbackMessage } from "./services/websocketService";

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
  const ttsServiceRef = useRef<TTSService | null>(null);
  const wsServiceRef = useRef<WebSocketService | null>(null);

  // Initialize TTS service
  useEffect(() => {
    if (ELEVENLABS_API_KEY && ELEVENLABS_API_KEY !== "your_elevenlabs_api_key_here") {
      ttsServiceRef.current = new TTSService({
        apiKey: ELEVENLABS_API_KEY,
        voiceId: ELEVENLABS_VOICE_ID || "pNInz6obpgDQGcFmaJgB",
      });
    } else {
      Alert.alert(
        "TTS Not Configured",
        "Please set your ElevenLabs API key in the .env file to enable text-to-speech functionality."
      );
    }
  }, []);

  // Initialize WebSocket connection
  useEffect(() => {
    wsServiceRef.current = new WebSocketService(WS_URL);
    
    const handleFeedback = (message: FeedbackMessage) => {
      setLastFeedback(message.data.feedback);
      if (isTTSEnabled && ttsServiceRef.current) {
        ttsServiceRef.current.speak(message.data.feedback).catch(console.error);
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
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.toggleButton, { backgroundColor: isTTSEnabled ? "#f44336" : "#4CAF50" }]}
              onPress={() => setIsTTSEnabled(!isTTSEnabled)}
            >
              <Text style={styles.toggleButtonText}>
                {isTTSEnabled ? "Disable TTS" : "Enable TTS"}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.toggleButton, { backgroundColor: "#2196F3" }]}
              onPress={async () => {
                if (ttsServiceRef.current) {
                  try {
                    await ttsServiceRef.current.speak("Testing text to speech functionality. This is a test message.");
                  } catch (error) {
                    Alert.alert("TTS Test Failed", "Check your API key and internet connection.");
                  }
                } else {
                  Alert.alert("TTS Not Available", "TTS service is not initialized. Check your API key configuration.");
                }
              }}
            >
              <Text style={styles.toggleButtonText}>Test TTS</Text>
            </TouchableOpacity>
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
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 15,
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
