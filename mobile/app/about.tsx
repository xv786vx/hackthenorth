import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useFonts, Sixtyfour_400Regular } from "@expo-google-fonts/sixtyfour";

export default function StatusScreen() {
  let [fontsLoaded] = useFonts({
    Sixtyfour_400Regular,
  });

  if (!fontsLoaded) {
    return null;
  }
  
  // Battery percentage for conditional formatting
  const batteryPercentage = 100; // This would come from your robot's actual battery data

  const getBatteryColor = (percentage: number) => {
    if (percentage <= 20) return "#ff4444"; // Red
    if (percentage <= 50) return "#ffaa00"; // Yellow
    return "#44ff44"; // Green
  };

  // Format cleaning time to show hours and minutes
  const formatCleaningTime = (totalMinutes: number) => {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}hr ${minutes}m`;
  };

  // Example: 125 minutes = 2hr 5m
  const cleaningTimeMinutes = 125; // This would come from your robot's actual cleaning time

  // Create grid pattern
  const renderGrid = () => {
    const gridLines = [];
    const gridSize = 20;
    const screenWidth = 400; // Approximate screen width
    const screenHeight = 800; // Approximate screen height
    
    // Vertical lines
    for (let i = 0; i <= screenWidth; i += gridSize) {
      gridLines.push(
        <View
          key={`v-${i}`}
          style={[
            styles.gridLine,
            {
              left: i,
              top: 0,
              width: 1,
              height: screenHeight,
            },
          ]}
        />
      );
    }
    
    // Horizontal lines
    for (let i = 0; i <= screenHeight; i += gridSize) {
      gridLines.push(
        <View
          key={`h-${i}`}
          style={[
            styles.gridLine,
            {
              left: 0,
              top: i,
              width: screenWidth,
              height: 1,
            },
          ]}
        />
      );
    }
    
    return gridLines;
  };

  return (
    <View style={styles.container}>
      <View style={styles.gridBackground}>
        {renderGrid()}
      </View>
      <ScrollView style={styles.scrollContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>Status</Text>
        </View>
      
      <View style={styles.metricsContainer}>
        <Text style={styles.sectionTitle}>Metrics</Text>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Things cleaned:</Text>
          <Text style={styles.metricValue}>0</Text>
        </View>
        
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Battery:</Text>
          <Text style={[styles.metricValue, { color: getBatteryColor(batteryPercentage) }]}>
            {batteryPercentage}%
          </Text>
        </View>
        
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Cleaning Time:</Text>
          <Text style={styles.metricValue}>{formatCleaningTime(cleaningTimeMinutes)}</Text>
        </View>
      </View>
      
      <View style={styles.cameraContainer}>
        <Text style={styles.sectionTitle}>Robot Camera Feed</Text>
        <View style={styles.cameraFeed}>
          <Text style={styles.cameraPlaceholder}>
            Camera feed will appear here
          </Text>
        </View>
      </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#2a2a2a",
  },
  gridBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#2a2a2a",
  },
  gridLine: {
    position: "absolute",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
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
    color: "#ffffff",
  },
  metricsContainer: {
    backgroundColor: "#3a3a3a",
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 0,
    borderWidth: 2,
    borderColor: "#ffffff",
    padding: 20,
    // Pixel shadow effect
    shadowColor: "#000000",
    shadowOffset: {
      width: 4,
      height: 4,
    },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
  sectionTitle: {
    fontFamily: "Sixtyfour_400Regular",
    fontSize: 20,
    color: "#cccccc",
    marginBottom: 15,
  },
  metricItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#555555",
  },
  metricLabel: {
    fontFamily: "Sixtyfour_400Regular",
    fontSize: 14,
    color: "#999999",
  },
  metricValue: {
    fontFamily: "Sixtyfour_400Regular",
    fontSize: 14,
    color: "#cccccc",
  },
  cameraContainer: {
    backgroundColor: "#3a3a3a",
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 0,
    borderWidth: 2,
    borderColor: "#ffffff",
    padding: 20,
    // Pixel shadow effect
    shadowColor: "#000000",
    shadowOffset: {
      width: 4,
      height: 4,
    },
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
    borderColor: "#ffffff",
    // Pixel shadow effect
    shadowColor: "#000000",
    shadowOffset: {
      width: 4,
      height: 4,
    },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
  cameraPlaceholder: {
    fontFamily: "Sixtyfour_400Regular",
    color: "#999999",
    fontSize: 14,
    textAlign: "center",
  },
});
