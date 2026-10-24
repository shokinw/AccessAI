"use strict";

/* ==========================================
   AccessAI — Mobile Assistive Camera App
   Existing FastAPI backend; no backend rebuild
========================================== */

const API_URL = "https://accessai-ep6z.onrender.com";

const $ = (id) => document.getElementById(id);

const el = {
  video: $("camera-preview"),
  canvas: $("camera-canvas"),
  placeholder: $("camera-placeholder"),
  cameraStatus: $("camera-status"),
  cameraResult: $("camera-result"),
  cameraSpeak: $("camera-speak"),

  start: $("assist-start"),
  describe: $("assist-describe"),
  read: $("assist-read"),
  repeat: $("assist-repeat"),
  stop: $("assist-stop"),
  assistStatus: $("assist-status"),
  transcript: $("voice-transcript"),

  form: $("upload-form"),
  imageInput: $("image-input"),
  fileName: $("file-name"),
  preview: $("preview"),
  status: $("status"),
  result: $("result"),
  readButton: $("read-button"),
  speakButton: $("speak-button"),
  repeatButton: $("repeat-button"),
  stopSpeech: $("stop-button"),

  sceneInput: $("scene-input"),
  sceneButton: $("scene-button"),
  sceneResult: $("scene-result"),
  sceneSpeak: $("scene-speak")
};

let cameraStream = null;
let recognition = null;
let handsFreeActive = false;
let requestInProgress = false;
let autoDescribeTimer = null;
let previewUrl = null;

let lastCameraResult = "";
let lastOCRResult = "";
let lastSceneResult = "";
let lastSpokenResult = "";
let listening = false;
let recognitionRestartTimer = null;

const SpeechRecognitionAPI =
  window.SpeechRecognition || window.webkitSpeechRecognition;


/* ---------- Small helpers ---------- */

function update(element, message) {
  if (element) element.textContent = message;
}

function enable(element, value) {
  if (element) element.disabled = !value;
}

function rememberResult(text) {
  if (!text || !text.trim()) return;

  lastSpokenResult = text.trim();
  enable(el.repeat, true);
}

function setCameraUI(isOn) {
  if (el.placeholder) el.placeholder.hidden = isOn;

  if (el.cameraStatus) {
    el.cameraStatus.innerHTML = isOn
      ? '<span class="state-dot"></span> Camera on'
      : '<span class="state-dot"></span> Camera off';
  }

  enable(el.start, !isOn);
  enable(el.describe, isOn);
  enable(el.read, isOn);
  enable(el.stop, isOn);
}


/* ---------- Speech output ---------- */

function stopSpeaking() {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

function speak(text, source = "camera") {
  const message = String(text || "").trim();

  if (!message) {
    update(el.assistStatus, "There is nothing to read yet.");
    return;
  }

  if (!("speechSynthesis" in window)) {
    update(el.assistStatus, "Speech output is not supported in this browser.");
    return;
  }

  stopSpeaking();
  lastSpokenResult = message;

  const utterance = new SpeechSynthesisUtterance(message);
  utterance.lang = "en-IN";
  utterance.rate = 0.9;
  utterance.pitch = 1;

  utterance.onstart = () => {
    update(el.assistStatus, "Speaking…");

    if (recognition && listening) {
      try {
        recognition.stop();
      } catch (_) {}
    }
  };

  utterance.onend = () => {
    if (source === "ocr") {
      update(el.status, "Finished reading.");
    }

    if (handsFreeActive) {
      update(el.assistStatus, "Ready. Say a command.");
      restartRecognitionSoon();
    }
  };

  utterance.onerror = (event) => {
    if (!["canceled", "interrupted"].includes(event.error)) {
      update(el.assistStatus, "Speech could not finish. Please try again.");
    }

    if (handsFreeActive) restartRecognitionSoon();
  };

  window.speechSynthesis.speak(utterance);
}


/* ---------- Backend requests ---------- */

async function sendImage(endpoint, file, filename = "camera.jpg") {
  const data = new FormData();
  data.append("file", file, filename);

  const response = await fetch(`${API_URL}${endpoint}`, {
    method: "POST",
    body: data
  });

  let payload = {};

  try {
    payload = await response.json();
  } catch (_) {}

  if (!response.ok) {
    throw new Error(
      payload.detail ||
      payload.message ||
      `Server error (${response.status})`
    );
  }

  return payload;
}


/* ---------- Camera controls ---------- */

async function startCamera() {
  if (cameraStream && cameraStream.active) return;

  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error(
      "Camera access requires HTTPS or localhost. Open AccessAI using its secure website."
    );
  }

  cameraStream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1280 },
      height: { ideal: 720 }
    },
    audio: false
  });

  el.video.srcObject = cameraStream;

  try {
    await el.video.play();
  } catch (_) {}

  setCameraUI(true);
  update(el.assistStatus, "Camera is ready.");
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }

  if (el.video) el.video.srcObject = null;

  setCameraUI(false);
}

async function captureImage() {
  if (!cameraStream || !el.video.videoWidth) {
    throw new Error("Wait for the camera to become ready.");
  }

  el.canvas.width = el.video.videoWidth;
  el.canvas.height = el.video.videoHeight;

  const context = el.canvas.getContext("2d");
  context.drawImage(
    el.video,
    0,
    0,
    el.canvas.width,
    el.canvas.height
  );

  const blob = await new Promise((resolve) => {
    el.canvas.toBlob(resolve, "image/jpeg", 0.88);
  });

  if (!blob) {
    throw new Error("Could not capture the camera image.");
  }

  return blob;
}


/* ---------- Describe surroundings ---------- */

async function describeSurroundings() {
  if (requestInProgress) return;

  requestInProgress = true;
  update(el.assistStatus, "Looking at your surroundings…");
  update(el.cameraResult, "Analyzing the scene…");

  try {
    const image = await captureImage();
    const payload = await sendImage("/describe-scene", image);

    lastCameraResult = String(
      payload.description || "I could not describe this image."
    ).trim();

    update(el.cameraResult, lastCameraResult);
    enable(el.cameraSpeak, true);

    rememberResult(lastCameraResult);
    update(el.assistStatus, "Scene description ready.");

    speak(lastCameraResult, "camera");
  } catch (error) {
    update(el.cameraResult, error.message);
    update(el.assistStatus, "Could not describe the scene. Please try again.");
  } finally {
    requestInProgress = false;
  }
}


/* ---------- Read text from camera ---------- */

async function readCameraText() {
  if (requestInProgress) return;

  requestInProgress = true;
  update(el.assistStatus, "Reading text…");
  update(el.cameraResult, "Extracting text from the image…");

  try {
    const image = await captureImage();
    const payload = await sendImage("/read-text", image);

    lastCameraResult = String(payload.text || "").trim();

    if (!lastCameraResult) {
      lastCameraResult =
        "No readable text found. Move closer and try again with better lighting.";
    }

    update(el.cameraResult, lastCameraResult);
    enable(el.cameraSpeak, true);

    rememberResult(lastCameraResult);
    speak(lastCameraResult, "camera");
  } catch (error) {
    update(el.cameraResult, error.message);
    update(el.assistStatus, "Could not read the text. Please try again.");
  } finally {
    requestInProgress = false;
  }
}


/* ---------- Voice commands ---------- */

function setupVoiceRecognition() {
  if (!SpeechRecognitionAPI) {
    update(
      el.assistStatus,
      "Voice commands are not supported in this browser. Use the buttons."
    );
    return false;
  }

  if (recognition) return true;

  recognition = new SpeechRecognitionAPI();
  recognition.lang = "en-IN";
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    listening = true;
    update(el.assistStatus, "Listening for your command.");
  };

  recognition.onresult = (event) => {
    const result = event.results[event.results.length - 1];
    if (!result || !result[0]) return;

    const command = result[0].transcript.trim();

    update(el.transcript, `Heard: "${command}"`);
    handleVoiceCommand(command);
  };

  recognition.onerror = (event) => {
    listening = false;

    if (
      event.error === "not-allowed" ||
      event.error === "service-not-allowed"
    ) {
      update(
        el.assistStatus,
        "Microphone permission is needed for voice commands."
      );
    } else if (event.error !== "no-speech" && event.error !== "aborted") {
      update(
        el.assistStatus,
        "Voice recognition paused. You can still use the buttons."
      );
    }
  };

  recognition.onend = () => {
    listening = false;

    if (handsFreeActive && !window.speechSynthesis.speaking) {
      restartRecognitionSoon();
    }
  };

  return true;
}

function restartRecognitionSoon() {
  if (!handsFreeActive || !recognition || recognitionRestartTimer) return;

  recognitionRestartTimer = window.setTimeout(() => {
    recognitionRestartTimer = null;

    if (!handsFreeActive || listening) return;

    try {
      recognition.start();
    } catch (_) {}
  }, 900);
}

function handleVoiceCommand(rawCommand) {
  const command = rawCommand.toLowerCase().replace(/[.,!?]/g, "").trim();

  if (
    command.includes("stop speaking") ||
    command.includes("stop talking") ||
    command === "be quiet"
  ) {
    stopSpeaking();
    update(el.assistStatus, "Speech stopped.");
    return;
  }

  if (
    command.includes("stop assistance") ||
    command.includes("turn off camera") ||
    command.includes("stop assistant")
  ) {
    stopAssistance();
    return;
  }

  if (
    command.includes("read text") ||
    command.includes("read this") ||
    command.includes("read sign") ||
    command.includes("read the paper") ||
    command.includes("what is written") ||
    command.includes("read the text")
  ) {
    readCameraText();
    return;
  }

  if (
    command.includes("describe") ||
    command.includes("surroundings") ||
    command.includes("what is around") ||
    command.includes("what do you see")
  ) {
    describeSurroundings();
    return;
  }

  if (
    command.includes("repeat") ||
    command.includes("say that again")
  ) {
    speak(lastSpokenResult || lastCameraResult || lastOCRResult);
    return;
  }

  if (command.includes("help") || command.includes("commands")) {
    speak(
      "Say describe surroundings, read text, repeat result, stop speaking, or stop assistance."
    );
    return;
  }

  update(
    el.assistStatus,
    "Command not recognised. Say help to hear available commands."
  );
}


/* ---------- Start and stop assistance ---------- */

async function startAssistance() {
  if (handsFreeActive) return;

  try {
    await startCamera();
  } catch (error) {
    update(el.assistStatus, error.message);
    return;
  }

  handsFreeActive = true;
  enable(el.start, false);
  enable(el.stop, true);
  enable(el.describe, true);
  enable(el.read, true);

  update(el.transcript, "Try saying “describe surroundings” or “read text”.");

  if (setupVoiceRecognition()) {
    try {
      recognition.start();
    } catch (_) {
      update(
        el.assistStatus,
        "Camera started. Use the buttons if voice listening does not start."
      );
    }
  }

  // Describe the first view immediately.
  await describeSurroundings();

  // Periodically refresh the description while assistance is active.
  if (autoDescribeTimer) clearInterval(autoDescribeTimer);

  autoDescribeTimer = setInterval(() => {
    if (
      handsFreeActive &&
      !requestInProgress &&
      !window.speechSynthesis.speaking
    ) {
      describeSurroundings();
    }
  }, 15000);
}

function stopAssistance() {
  handsFreeActive = false;

  if (autoDescribeTimer) {
    clearInterval(autoDescribeTimer);
    autoDescribeTimer = null;
  }

  if (recognition) {
    try {
      recognition.stop();
    } catch (_) {}
  }

  if (recognitionRestartTimer) {
    clearTimeout(recognitionRestartTimer);
    recognitionRestartTimer = null;
  }

  stopSpeaking();
  stopCamera();

  enable(el.start, true);
  enable(el.stop, false);
  enable(el.describe, false);
  enable(el.read, false);

  update(el.assistStatus, "Assistance stopped.");
  update(el.transcript, "Tap Start seeing when you are ready.");
}


/* ---------- OCR uploaded image ---------- */

el.imageInput.addEventListener("change", () => {
  const file = el.imageInput.files?.[0];

  enable(el.speakButton, false);
  enable(el.repeatButton, false);
  lastOCRResult = "";

  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  }

  if (!file) {
    update(el.fileName, "JPG, PNG or another image format");
    el.preview.hidden = true;
    return;
  }

  if (!file.type.startsWith("image/")) {
    update(el.status, "Please choose a valid image.");
    el.imageInput.value = "";
    return;
  }

  update(el.fileName, file.name);
  previewUrl = URL.createObjectURL(file);
  el.preview.src = previewUrl;
  el.preview.hidden = false;
  update(el.status, "Image selected. Ready to read.");
});

el.form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const file = el.imageInput.files?.[0];

  if (!file) {
    update(el.status, "Please choose an image first.");
    return;
  }

  enable(el.readButton, false);
  update(el.status, "Reading your image…");
  update(el.result, "Extracting text…");

  try {
    const payload = await sendImage("/read-text", file, file.name);

    lastOCRResult = String(payload.text || "").trim();

    update(
      el.result,
      lastOCRResult || "No readable text found. Try a clearer photo."
    );

    rememberResult(lastOCRResult);
    enable(el.speakButton, Boolean(lastOCRResult));
    enable(el.repeatButton, Boolean(lastOCRResult));

    update(el.status, "Text extraction complete.");
  } catch (error) {
    update(el.status, `Could not read image: ${error.message}`);
  } finally {
    enable(el.readButton, true);
  }
});


/* ---------- Saved photo description ---------- */

el.sceneButton.addEventListener("click", async () => {
  const file = el.sceneInput.files?.[0];

  if (!file) {
    update(el.sceneResult, "Please choose a photo first.");
    return;
  }

  enable(el.sceneButton, false);
  enable(el.sceneSpeak, false);
  update(el.sceneResult, "Analyzing photo…");

  try {
    const payload = await sendImage("/describe-scene", file, file.name);

    lastSceneResult = String(payload.description || "").trim();

    update(
      el.sceneResult,
      lastSceneResult || "No description was returned."
    );

    rememberResult(lastSceneResult);
    enable(el.sceneSpeak, Boolean(lastSceneResult));
  } catch (error) {
    update(el.sceneResult, `Could not describe photo: ${error.message}`);
  } finally {
    enable(el.sceneButton, true);
  }
});


/* ---------- Connect buttons ---------- */

el.start.addEventListener("click", startAssistance);
el.stop.addEventListener("click", stopAssistance);

el.describe.addEventListener("click", describeSurroundings);
el.read.addEventListener("click", readCameraText);

el.repeat.addEventListener("click", () => {
  speak(lastSpokenResult || lastCameraResult || lastOCRResult || lastSceneResult);
});

el.cameraSpeak.addEventListener("click", () => {
  speak(lastCameraResult);
});

el.speakButton.addEventListener("click", () => {
  speak(lastOCRResult, "ocr");
});

el.repeatButton.addEventListener("click", () => {
  speak(lastOCRResult || lastSpokenResult, "ocr");
});

el.stopSpeech.addEventListener("click", stopSpeaking);

el.sceneSpeak.addEventListener("click", () => {
  speak(lastSceneResult);
});


/* ---------- Clean up when leaving the app ---------- */

window.addEventListener("pagehide", () => {
  handsFreeActive = false;

  if (autoDescribeTimer) clearInterval(autoDescribeTimer);
  if (recognitionRestartTimer) clearTimeout(recognitionRestartTimer);

  if (recognition) {
    try {
      recognition.stop();
    } catch (_) {}
  }

  stopSpeaking();
  stopCamera();

  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
  }
});


/* ---------- Initial screen state ---------- */

setCameraUI(false);
enable(el.stop, false);
enable(el.describe, false);
enable(el.read, false);
enable(el.repeat, false);
enable(el.cameraSpeak, false);
enable(el.sceneSpeak, false);

update(el.assistStatus, "Ready to help.");