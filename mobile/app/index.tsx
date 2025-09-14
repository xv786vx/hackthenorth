import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { Link } from "expo-router";
import { useFonts, Sixtyfour_400Regular } from "@expo-google-fonts/sixtyfour";

export default function HomeScreen() {
  let [fontsLoaded] = useFonts({
    Sixtyfour_400Regular,
  });

  if (!fontsLoaded) {
    return null;
  }

  // Create grid pattern
  const renderGrid = () => {
    const gridLines = [];
    const gridSize = 20;
    const screenWidth = 400;
    const screenHeight = 800;

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

      <View style={styles.content}>
        {/* Title image */}
        <Image
          source={require("../assets/images/honcktext288.png")}
          style={styles.titleImage}
          resizeMode="contain"
        />

        {/* Goose image between title and button */}
        <Image
          source={require("../assets/images/totogoose256.png")}
          style={{width: 256, height: 256, marginTop: -55, marginLeft: 0}}
          resizeMode="contain"
        />

        <Link href="/about" asChild>
          <TouchableOpacity style={styles.button}>
            <Text style={styles.buttonText}>Check My Geese</Text>
          </TouchableOpacity>
        </Link>
      </View>
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
  content: {
    flex: 1,
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 50,
  },
  titleImage: {
    width: 400,
    height: 140,
    marginTop:40,
  },
  image: {
    width: 200,
    height: 200,
    marginVertical: 30,
  },
  button: {
    backgroundColor: "#d2b48c", // Tan like goose feathers
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 2,
    borderColor: "#8b4513", // Saddle brown border
    borderRadius: 0,
    shadowColor: "#8b4513",
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
    marginBottom: 80,
  },
  buttonText: {
    fontFamily: "Sixtyfour_400Regular",
    fontSize: 16,
    color: "#8b4513", // Saddle brown text
  },
});
