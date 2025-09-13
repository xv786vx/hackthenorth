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
        <Text style={styles.title}>Title</Text>

        {/* Image between title and button */}
        <Image
          source={require("../assets/images/bracketbot256.png")} // replace with your image path
          style={{width: 256, height: 256, marginTop: -55, marginLeft: 10,}}
          resizeMode="contain"
        />

        <Link href="/about" asChild>
          <TouchableOpacity style={styles.button}>
            <Text style={styles.buttonText}>Check My Robot</Text>
          </TouchableOpacity>
        </Link>
      </View>
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
  content: {
    flex: 1,
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 50,
  },
  title: {
    fontFamily: "Sixtyfour_400Regular",
    fontSize: 32,
    color: "#ffffff",
    marginTop: 100,
  },
  image: {
    width: 200,
    height: 200,
    marginVertical: 30,
  },
  button: {
    backgroundColor: "#3a3a3a",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 2,
    borderColor: "#ffffff",
    borderRadius: 0,
    shadowColor: "#000000",
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
    marginBottom: 80,
  },
  buttonText: {
    fontFamily: "Sixtyfour_400Regular",
    fontSize: 16,
    color: "#ffffff",
  },
});
