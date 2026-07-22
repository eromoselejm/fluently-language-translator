
import { File } from "expo-file-system";
import { fetch } from "expo/fetch";

const API_KEY = process.env.EXPO_PUBLIC_ASSEMBLY_AI_API_KEY;

export async function transcribeAudio(fileUri) {
  // Create a File from the local URI
  const file = new File(fileUri);

  // Upload to AssemblyAI
  const uploadResponse = await fetch(
    "https://api.assemblyai.com/v2/upload",
    {
      method: "POST",
      headers: {
        authorization: API_KEY,
        "Content-Type": "application/octet-stream",
      },
      body: file,
    }
  );

  const { upload_url } = await uploadResponse.json();

  // Create transcript
  const transcriptResponse = await fetch(
    "https://api.assemblyai.com/v2/transcript",
    {
      method: "POST",
      headers: {
        authorization: API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        audio_url: upload_url,
        language_detection: true,
      }),
    }
  );

  const { id } = await transcriptResponse.json();

  // Poll until complete
  while (true) {
    const pollResponse = await fetch(
      `https://api.assemblyai.com/v2/transcript/${id}`,
      {
        headers: {
          authorization: API_KEY,
        },
      }
    );

    const result = await pollResponse.json();

    if (result.status === "completed") {
      return result.text;
    }

    if (result.status === "error") {
      throw new Error(result.error);
    }

    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}