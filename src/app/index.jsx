import { Ionicons } from "@expo/vector-icons";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  useAudioPlayer,
} from "expo-audio";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Animated,
  Easing,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useRef, useEffect } from "react";
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from "@gorhom/bottom-sheet";
import { languages } from "../../data/languages.js";
import { transcribeAudio } from "../../services/transcribe_helper.js";
import { translate } from "../../services/translate_helper.js";
import * as Speech from "expo-speech";
import AsyncStorage from '@react-native-async-storage/async-storage';
import formatSavedTime from "../../services/time_helper.js";

const BAR_COUNT = 8;
const MIN_HEIGHT = 20; // percent
const MAX_HEIGHT = 100; // percent

export default function Home() {
  const [translation, setTranslation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [comment, setComment] = useState(null);
  const [toast, setToast] = useState(null);
  const [savedTranslations, setSavedTranslations] = useState([]);
  const historySheetRef = useRef(null);

  const openHistorySheet = () => historySheetRef.current?.expand();
  const closeHistorySheet = () => historySheetRef.current?.close();

  const [permisssionGranted, setPermissionGranted] = useState(false);
  const [recorderUri, setRecorderUri] = useState(null);

  const [resultLanguage, setResultLanguage] = useState(languages[3]);

  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef(null);

  const showToast = (message) => {
    setToast(message);
    Animated.timing(toastAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();

    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => {
      Animated.timing(toastAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start(() => setToast(null));
    }, 3000);
  };

  // ----- Wave bar animation -----
  const barAnims = useRef(
    Array.from({ length: BAR_COUNT }, () => new Animated.Value(MIN_HEIGHT))
  ).current;
  const barLoops = useRef([]);

  useEffect(() => {
    if (loading) {
      barLoops.current = barAnims.map((anim, i) => {
        const loopAnim = Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: MAX_HEIGHT,
              duration: 420 + i * 35,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: false,
              delay: i * 60,
            }),
            Animated.timing(anim, {
              toValue: MIN_HEIGHT,
              duration: 420 + i * 35,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: false,
            }),
          ])
        );
        loopAnim.start();
        return loopAnim;
      });
    } else {
      barLoops.current.forEach((l) => l.stop());
      barAnims.forEach((anim) =>
        Animated.timing(anim, {
          toValue: MIN_HEIGHT,
          duration: 250,
          useNativeDriver: false,
        }).start()
      );
    }
    return () => barLoops.current.forEach((l) => l.stop());
  }, [loading]);

  const resultLanguageSheetRef = useRef(null);
  const openResultLanguageSheet = () => resultLanguageSheetRef.current?.expand();
  const closeResultLanguageSheet = () => resultLanguageSheetRef.current?.close();

  const audioPlayer = useAudioPlayer(recorderUri);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);

  const record = async () => {
    setLoading(true);
    setComment(null);
    setTranslation(null)
    if (!permisssionGranted) {
      await requestAudioPermission();
    }
    try {
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      Speech.stop();
      console.log("Recording...");
    } catch (err) {
      console.error(err);
      showToast("Couldn't start recording. Try again.");
    }
  };

  const playTranslation = (translation) => {
    Speech.speak(translation, {
      language: resultLanguage.speechCode,
      pitch: 1,
      rate: 1,
      onStart: () => setLoading(true),
      onStopped: () => setLoading(false),
      onError: () => {
        showToast("Playback failed. Try again.");
        setLoading(false);
      },
      onDone: () => setLoading(false),
    });
  };

  const stopRecording = async () => {
    setLoading(false);
    try {
      await audioRecorder.stop();
      console.log("Stopped recording.");
      if (audioRecorder.uri) {
        transcribeAndTranslate(audioRecorder.uri);
      }
    } catch (err) {
      console.error(err);
      showToast("Couldn't stop recording. Try again.");
    }
  };

  const requestAudioPermission = async () => {
    const status = await AudioModule.requestRecordingPermissionsAsync();
    if (!status.granted) {
      setPermissionGranted(false);
      showToast("Microphone permission is required to record.");
      return;
    }
    setPermissionGranted(true);
    setAudioModeAsync({
      playsInSilentMode: true,
      allowsRecording: true,
    });
  };

  const transcribeAndTranslate = async (uri) => {
    try {
      setComment("Transcribing...");
      const text = await transcribeAudio(uri);
      console.log("Transcription: ", text);
      setComment("Translating...");
      const translatedText = await translate(text, resultLanguage.code);
      console.log("Translation: ", translatedText);
      setTranslation({transcription: text, translation: translatedText});
      setSavedTranslations((prev) => [
        { From: text, To: translatedText, createdAt: Date.now() },
        ...prev,
      ]);
      playTranslation(translatedText);
    } catch (error) {
      console.error("Something went wrong: ", error);
      showToast("Something went wrong. Try again later.");
    }
  };

  const deleteSavedTranslation = (index) => {
    setSavedTranslations((prev) => prev.filter((_, i) => i !== index));
  };

  const getSavedTranslations = async () => {
    const stored = await AsyncStorage.getItem("savedTranslations");
    if (stored) {
      setSavedTranslations(JSON.parse(stored));
    }
  };

  const renderBackdrop = (props) => (
    <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.4} />
  );

  useEffect(() => {
    getSavedTranslations();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem("savedTranslations", JSON.stringify(savedTranslations));
  }, [savedTranslations]);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.contentContainer}>
        {/* ----- Top Header ----- */}
        <View style={styles.topHeader}>
          <TouchableOpacity
            onPress={openHistorySheet}
            style={styles.historyBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="time" color="#111" size={18} />
            <Text style={{ fontSize: 12, fontWeight: "bold", color: "#111" }}>History</Text>
          </TouchableOpacity>
        </View>

        {/* ----- Wave visualizer ----- */}
        <View style={styles.waveContainer}>
          {barAnims.map((anim, i) => (
            <Animated.View
              key={i}
              style={[
                styles.wave,
                {
                  height: anim.interpolate({
                    inputRange: [0, 100],
                    outputRange: ["0%", "100%"],
                  }),
                },
              ]}
            />
          ))}
        </View>

        {/* ----- Language Selector ----- */}
        <View style={styles.languageHeader}>
          <Text style={styles.toLabel}>Translate to</Text>
          <TouchableOpacity
            onPress={openResultLanguageSheet}
            style={styles.languageItem}
            activeOpacity={0.7}
          >
            <Text style={styles.languageText}>{resultLanguage.title}</Text>
            <Ionicons name="chevron-down" color="#111" size={18} />
          </TouchableOpacity>
        </View>

        {/* ----- Transcript / translation card ----- */}
        <View style={styles.translationContainer}>
          {translation ? (
            <View style={[styles.historyCard, {marginBottom: 0}]}>                  
                    <View style={styles.historyRow}>
                      <View style={styles.historyDot} />
                      <Text style={styles.historyFromText}>{translation?.transcription}</Text>
                    </View>

                    <View style={styles.historyDivider} />

                    <View style={styles.historyRow}>
                      <View style={[styles.historyDot, styles.historyDotActive]} />
                      <Text style={styles.historyToText}>{translation?.translation}</Text>
                    </View>
                  </View>
          ) : (
            <Text style={styles.translationPlaceholder}>
              {comment ? comment: "Your translation will appear here"}
            </Text>
          )}
        </View>

        {/* ----- Record Button ----- */}
        <TouchableOpacity
          style={[styles.recordBtn, recorderState.isRecording && styles.recordBtnActive]}
          onPress={recorderState.isRecording ? stopRecording : record}
          activeOpacity={0.85}
        >
          <Ionicons
            name={recorderState.isRecording ? "stop" : "mic-outline"}
            color="#fff"
            size={36}
          />
        </TouchableOpacity>

        {/* ----- Toast ----- */}
        {toast ? (
          <Animated.View
            style={[
              styles.toast,
              {
                opacity: toastAnim,
                transform: [
                  {
                    translateY: toastAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [20, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Ionicons name="alert-circle" color="#fff" size={18} />
            <Text style={styles.toastText}>{toast}</Text>
          </Animated.View>
        ) : null}

        {/* ----- Result Language Sheet ----- */}
        <BottomSheet
          ref={resultLanguageSheetRef}
          index={-1}
          enableDynamicSizing
          enablePanDownToClose
          animateOnMount={false}
          maxDynamicContentSize={400}
          backdropComponent={renderBackdrop}
          backgroundStyle={styles.sheetBackground}
          handleIndicatorStyle={styles.sheetHandle}
        >
          <BottomSheetScrollView style={styles.bottomSheet} contentContainerStyle={{ paddingBottom: 24 }}>
            <Text style={styles.sheetTitle}>Select a language</Text>
            {languages.map((language) => (
              <TouchableOpacity
                key={language.code}
                onPress={() => {
                  setResultLanguage(language);
                  closeResultLanguageSheet();
                }}
                style={[
                  styles.sheetItem,
                  resultLanguage.code === language.code && styles.sheetItemActive,
                ]}
                activeOpacity={0.6}
              >
                <Text
                  style={[
                    styles.sheetItemText,
                    resultLanguage.code === language.code && styles.sheetItemTextActive,
                  ]}
                >
                  {language.title}
                </Text>
                {resultLanguage.code === language.code && (
                  <Ionicons name="checkmark" color="#fff" size={18} />
                )}
              </TouchableOpacity>
            ))}
          </BottomSheetScrollView>
        </BottomSheet>

        {/* ----- Translation History Sheet ----- */}
        <BottomSheet
          ref={historySheetRef}
          index={-1}
          enableDynamicSizing
          enablePanDownToClose
          animateOnMount={false}
          maxDynamicContentSize={500}
          backdropComponent={renderBackdrop}
          backgroundStyle={styles.sheetBackground}
          handleIndicatorStyle={styles.sheetHandle}
        >
          <BottomSheetScrollView style={styles.bottomSheet} contentContainerStyle={{ paddingBottom: 50, minHeight: 500 }}>
            <Text style={styles.sheetTitle}>History</Text>

            {savedTranslations.length === 0 ? (
              <Text style={styles.historyEmptyText}>
                Your past translations will show up here.
              </Text>
            ) : (
              savedTranslations.map((item, i) => {
                return (
                  <View key={i} style={styles.historyCard}>
                    <View style={styles.historyCardHeader}>
                      <Text style={styles.historyTime}>{formatSavedTime(item.createdAt)}</Text>
                      <TouchableOpacity
                        onPress={() => deleteSavedTranslation(i)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="trash-outline" color="#eb2525ff" size={16} />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.historyRow}>
                      <View style={styles.historyDot} />
                      <Text style={styles.historyFromText}>{item.From}</Text>
                    </View>

                    <View style={styles.historyDivider} />

                    <View style={styles.historyRow}>
                      <View style={[styles.historyDot, styles.historyDotActive]} />
                      <Text style={styles.historyToText}>{item.To}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </BottomSheetScrollView>
        </BottomSheet>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  contentContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingTop: 20,
    paddingBottom: 60,
    paddingHorizontal: 20,
    backgroundColor: "#fff",
  },
  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    width: "100%",
  },
  historyBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F3F3",
  },
  languageHeader: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  toLabel: {
    color: "#8A8A8A",
    fontSize: 14,
    fontWeight: "500",
  },
  languageItem: {
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#F3F3F3",
  },
  languageText: {
    color: "#111",
    fontWeight: "600",
    fontSize: 14,
  },
  waveContainer: {
    width: "100%",
    height: 180,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  wave: {
    width: 10,
    backgroundColor: "#111",
    borderRadius: 50,
  },
  translationContainer: {
    width: "95%",
    minHeight: 100,
    borderRadius: 20,
    backgroundColor: "#F7F7F7",
    padding: 20,
    justifyContent: "center",
  },
  translationText: {
    color: "#111",
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "500",
  },
  translationPlaceholder: {
    color: "#B3B3B3",
    fontSize: 15,
    textAlign: "center",
  },
  recordBtn: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 6,
  },
  recordBtnActive: {
    backgroundColor: "#E43D3D",
  },
  toast: {
    position: "absolute",
    bottom: 100,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#111",
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 999,
    maxWidth: "90%",
  },
  toastText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "500",
    flexShrink: 1,
  },
  sheetBackground: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  sheetHandle: {
    backgroundColor: "#DDD",
    width: 40,
  },
  bottomSheet: {
    padding: 20,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111",
    marginBottom: 12,
    marginTop: 4,
  },
  sheetItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginBottom: 6,
  },
  sheetItemActive: {
    backgroundColor: "#111",
  },
  sheetItemText: {
    fontSize: 15,
    color: "#111",
    fontWeight: "500",
  },
  sheetItemTextActive: {
    color: "#fff",
    fontWeight: "700",
  },
  historyEmptyText: {
    color: "#B3B3B3",
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 24,
  },
  historyCard: {
    backgroundColor: "#F7F7F7",
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
  },
  historyCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  historyTime: {
    fontSize: 12,
    color: "#B3B3B3",
    fontWeight: "500",
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  historyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#CCC",
    marginTop: 6,
  },
  historyDotActive: {
    backgroundColor: "#111",
  },
  historyFromText: {
    flex: 1,
    fontSize: 14,
    color: "#8A8A8A",
    lineHeight: 20,
  },
  historyToText: {
    flex: 1,
    fontSize: 15,
    color: "#111",
    fontWeight: "500",
    lineHeight: 21,
  },
  historyDivider: {
    height: 1,
    backgroundColor: "#EAEAEA",
    marginVertical: 8,
    marginLeft: 14,
  },
});