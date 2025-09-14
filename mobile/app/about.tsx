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
    console.log("🎤 Initializing TTS service...");
    console.log("🎤 API Key:", ELEVENLABS_API_KEY ? "Available" : "Missing");
    console.log("🎤 Voice ID:", ELEVENLABS_VOICE_ID);
    
    if (ELEVENLABS_API_KEY && ELEVENLABS_API_KEY !== "your_elevenlabs_api_key_here") {
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
          console.log("🎯 Polling feedback from:", `${BACKEND_URL}/feedback.json`);
          const response = await fetch(`${BACKEND_URL}/feedback.json?ts=${Date.now()}`);
          
          if (response.ok) {
            const feedbackData = await response.json();
            console.log("🎯 Feedback data received:", feedbackData);
            
            // Check if this is new feedback
            if (feedbackData.feedback && 
                feedbackData.timestamp > lastFeedbackTimestamp && 
                feedbackData.is_new) {
              
              console.log("🎯 NEW FEEDBACK DETECTED:", feedbackData.feedback);
              console.log("🎯 Timestamp:", feedbackData.timestamp, "Last:", lastFeedbackTimestamp);
              setLastFeedback(feedbackData.feedback);
              
              // Speak the feedback
              if (ttsServiceRef.current) {
                console.log("🎯 Calling TTS service to speak:", feedbackData.feedback);
                ttsServiceRef.current.speak(feedbackData.feedback).catch((error) => {
                  console.error("🎯 TTS Error:", error);
                });
              } else {
                console.error("🎯 TTS Service not available!");
              }
              
              lastFeedbackTimestamp = feedbackData.timestamp;
            } else {
              console.log("🎯 No new feedback (feedback:", !!feedbackData.feedback, "timestamp:", feedbackData.timestamp, "last:", lastFeedbackTimestamp, "is_new:", feedbackData.is_new);
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

  // Initialize WebSocket connection
  useEffect(() => {
    wsServiceRef.current = new WebSocketService(WS_URL);
    
    const handleFeedback = (message: FeedbackMessage) => {
      console.log("🎯 FEEDBACK RECEIVED:", message);
      setLastFeedback(message.data.feedback);
      if (isTTSEnabled && ttsServiceRef.current) {
        console.log("🔊 SPEAKING:", message.data.feedback);
        ttsServiceRef.current.speak(message.data.feedback).catch(console.error);
      } else {
        console.log("🔇 TTS DISABLED OR NOT AVAILABLE");
        console.log("TTS Enabled:", isTTSEnabled);
        console.log("TTS Service:", ttsServiceRef.current);
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
          {/* Debug Buttons - Organized in rows */}
          <View style={styles.debugContainer}>
            <Text style={styles.debugTitle}>Debug Controls</Text>
            
            {/* First row - TTS controls */}
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.debugButton, { backgroundColor: isTTSEnabled ? "#f44336" : "#4CAF50" }]}
                onPress={() => setIsTTSEnabled(!isTTSEnabled)}
              >
                <Text style={styles.debugButtonText}>
                  {isTTSEnabled ? "Disable TTS" : "Enable TTS"}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.debugButton, { backgroundColor: "#2196F3" }]}
                onPress={async () => {
                  console.log("🎤 Test TTS button pressed");
                  console.log("🎤 TTS Service available:", !!ttsServiceRef.current);
                  
                  if (ttsServiceRef.current) {
                    try {
                      console.log("🎤 Calling TTS service directly...");
                      await ttsServiceRef.current.speak("EXCELLENT! You are being incredibly productive right now! This is a test of the dramatic productivity feedback system!");
                      console.log("🎤 TTS test completed successfully");
                    } catch (error) {
                      console.error("🎤 TTS Test Failed:", error);
                      Alert.alert("TTS Test Failed", "Check your API key and internet connection.");
                    }
                  } else {
                    console.error("🎤 TTS Service not available");
                    Alert.alert("TTS Not Available", "TTS service is not initialized. Check your API key configuration.");
                  }
                }}
              >
                <Text style={styles.debugButtonText}>Test TTS</Text>
              </TouchableOpacity>
            </View>
            
            {/* Second row - WebSocket controls */}
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.debugButton, { backgroundColor: "#FF9800" }]}
                onPress={async () => {
                  try {
                    const response = await fetch(`${BACKEND_URL}/test-feedback`, {
                      method: 'POST',
                    });
                    if (response.ok) {
                      Alert.alert("Test Sent", "Test feedback message sent to WebSocket!");
                    } else {
                      Alert.alert("Test Failed", "Could not send test feedback.");
                    }
                  } catch (error) {
                    Alert.alert("Test Failed", "Could not connect to backend.");
                  }
                }}
              >
                <Text style={styles.debugButtonText}>Test WebSocket</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.debugButton, { backgroundColor: "#9C27B0" }]}
                onPress={async () => {
                  try {
                    const response = await fetch(`${BACKEND_URL}/status`);
                    if (response.ok) {
                      const status = await response.json();
                      Alert.alert(
                        "Backend Status", 
                        `Backend: ${status.backend}\nGroq: ${status.groq_analysis}\nConnections: ${status.active_connections}\nFrames: ${status.frame_count}`
                      );
                    } else {
                      Alert.alert("Status Failed", "Could not get backend status.");
                    }
                  } catch (error) {
                    Alert.alert("Status Failed", "Could not connect to backend.");
                  }
                }}
              >
                <Text style={styles.debugButtonText}>Check Status</Text>
              </TouchableOpacity>
            </View>

            {/* Third row - Simple feedback controls */}
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.debugButton, { backgroundColor: "#4CAF50" }]}
                onPress={async () => {
                  console.log("🎯 Test Feedback button pressed");
                  try {
                    console.log("🎯 Sending test feedback to:", `${BACKEND_URL}/test-feedback`);
                    const response = await fetch(`${BACKEND_URL}/test-feedback`, {
                      method: 'POST',
                    });
                    console.log("🎯 Test feedback response:", response.status, response.ok);
                    
                    if (response.ok) {
                      const result = await response.json();
                      console.log("🎯 Test feedback result:", result);
                      Alert.alert("Test Sent", "Test feedback sent! Should hear TTS in ~2 seconds.");
                    } else {
                      console.error("🎯 Test feedback failed:", response.status, response.statusText);
                      Alert.alert("Test Failed", "Could not send test feedback.");
                    }
                  } catch (error) {
                    console.error("🎯 Test feedback error:", error);
                    Alert.alert("Test Failed", "Could not connect to backend.");
                  }
                }}
              >
                <Text style={styles.debugButtonText}>Test Feedback</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.debugButton, { backgroundColor: "#607D8B" }]}
                onPress={async () => {
                  console.log("🎯 Get Latest button pressed");
                  try {
                    console.log("🎯 Fetching latest feedback from:", `${BACKEND_URL}/feedback.json`);
                    const response = await fetch(`${BACKEND_URL}/feedback.json`);
                    console.log("🎯 Get latest response:", response.status, response.ok);
                    
                    if (response.ok) {
                      const feedback = await response.json();
                      console.log("🎯 Latest feedback data:", feedback);
                      
                      if (feedback.feedback) {
                        Alert.alert(
                          "Latest Feedback", 
                          `Frame: ${feedback.frame_number}\nFeedback: ${feedback.feedback}\nTimestamp: ${feedback.timestamp}\nIs New: ${feedback.is_new}`
                        );
                      } else {
                        Alert.alert("No Feedback", "No feedback available yet.");
                      }
                    } else {
                      console.error("🎯 Get latest failed:", response.status, response.statusText);
                      Alert.alert("Failed", "Could not get feedback.");
                    }
                  } catch (error) {
                    console.error("🎯 Get latest error:", error);
                    Alert.alert("Error", "Could not connect to backend.");
                  }
                }}
              >
                <Text style={styles.debugButtonText}>Get Latest</Text>
              </TouchableOpacity>
            </View>

            {/* Fourth row - Direct TTS test */}
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.debugButton, { backgroundColor: "#E91E63" }]}
                onPress={async () => {
                  console.log("🎯 Direct TTS Test button pressed");
                  try {
                    console.log("🎯 Fetching simple test feedback from:", `${BACKEND_URL}/test-feedback-simple`);
                    const response = await fetch(`${BACKEND_URL}/test-feedback-simple`);
                    console.log("🎯 Simple test response:", response.status, response.ok);
                    
                    if (response.ok) {
                      const feedback = await response.json();
                      console.log("🎯 Simple test feedback:", feedback);
                      
                      if (feedback.feedback && ttsServiceRef.current) {
                        console.log("🎯 Speaking simple test feedback:", feedback.feedback);
                        await ttsServiceRef.current.speak(feedback.feedback);
                        Alert.alert("TTS Test", "Should have heard TTS just now!");
                      } else {
                        Alert.alert("TTS Not Available", "TTS service not ready.");
                      }
                    } else {
                      console.error("🎯 Simple test failed:", response.status, response.statusText);
                      Alert.alert("Test Failed", "Could not get simple test feedback.");
                    }
                  } catch (error) {
                    console.error("🎯 Simple test error:", error);
                    Alert.alert("Error", "Could not connect to backend.");
                  }
                }}
              >
                <Text style={styles.debugButtonText}>Direct TTS Test</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.debugButton, { backgroundColor: "#795548" }]}
                onPress={() => {
                  console.log("🎯 Debug Info button pressed");
                  Alert.alert(
                    "Debug Info",
                    `TTS Enabled: ${isTTSEnabled}\nTTS Service: ${ttsServiceRef.current ? "Available" : "Not Available"}\nBackend URL: ${BACKEND_URL}\nLast Feedback: ${lastFeedback || "None"}`
                  );
                }}
              >
                <Text style={styles.debugButtonText}>Debug Info</Text>
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
