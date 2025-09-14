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
      
      <View style={styles.cameraContainer}>
        <Text style={styles.sectionTitle}>Goose Camera Feed</Text>
        <View style={styles.cameraFeed}>
          <Text style={styles.cameraPlaceholder}>
            Camera feed will appear here
          </Text>
        </View>
      </View>
      
      
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
    borderColor: "#8b4513", // Saddle brown border
    // Pixel shadow effect
    shadowColor: "#8b4513",
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
    shadowOffset: {
      width: 4,
      height: 4,
    },
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
    backgroundColor: "#4CAF50", // Green for productive
    left: 0,
    top: 0,
    borderTopLeftRadius: 60,
    borderBottomLeftRadius: 60,
  },
  unproductiveSlice: {
    backgroundColor: "#f44336", // Red for unproductive
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
});
