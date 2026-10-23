
/* =========================================================
   AccessAI — Assistive Agent for Visually Impaired
   OCR + Object Detection + Camera + Speech + Voice Commands
   ========================================================= */

const API_URL = "https://beginning-rocky-result-designer.trycloudflare.com";
   // ---------- OCR ELEMENTS ----------
const form = document.getElementById("upload-form");
const imageInput = document.getElementById("image-input");
const fileName = document.getElementById("file-name");
const preview = document.getElementById("preview");
const status = document.getElementById("status");
const result = document.getElementById("result");

const readButton = document.getElementById("read-button");
const speakButton = document.getElementById("speak-button");
const repeatButton = document.getElementById("repeat-button");
const stopButton = document.getElementById("stop-button");

let extractedText = "";
let previewUrl = null;

// ---------- SCENE ELEMENTS ----------
const sceneInput = document.getElementById("scene-input");
const sceneButton = document.getElementById("scene-button");
const sceneResult = document.getElementById("scene-result");
const sceneSpeak = document.getElementById("scene-speak");

let sceneDescription = "";

// ---------- CAMERA ELEMENTS ----------
const cameraPreview = document.getElementById("camera-preview");
const cameraCanvas = document.getElementById("camera-canvas");
const startCameraButton = document.getElementById("start-camera");
const capturePhotoButton = document.getElementById("capture-photo");
const stopCameraButton = document.getElementById("stop-camera");
const cameraReadTextButton = document.getElementById("camera-read-text");
const cameraDescribeButton = document.getElementById("camera-describe-scene");
const cameraStatus = document.getElementById("camera-status");
const cameraResult = document.getElementById("camera-result");
const cameraSpeakButton = document.getElementById("camera-speak");

let cameraStream = null;
let capturedImageBlob = null;
let cameraResultText = "";

// ---------- VOICE ELEMENTS ----------
const voiceButton = document.getElementById("voice-command-button");
const voiceStatus = document.getElementById("voice-status");
const voiceTranscript = document.getElementById("voice-transcript");

const SpeechRecognitionAPI =
    window.SpeechRecognition || window.webkitSpeechRecognition;

let voiceRecognition = null;
let isVoiceListening = false;

// Stores the latest useful result for the Repeat Result command.
let latestResultText = "";

// =========================================================
// 1. SPEECH OUTPUT
// =========================================================

function speak(text) {
    if (!text || !text.trim()) {
        if (status) status.textContent = "There is no text to speak.";
        if (voiceStatus) voiceStatus.textContent = "There is no result to speak.";
        return;
    }

    if (!("speechSynthesis" in window)) {
        if (status) {
            status.textContent = "Speech output is not supported in this browser.";
        }
        return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.85;

    utterance.onstart = () => {
        if (status) status.textContent = "Speaking text...";
    };

    utterance.onend = () => {
        if (status) status.textContent = "Finished speaking.";
    };

    utterance.onerror = (event) => {
        // Ignore cancellation errors caused by Stop Speaking.
        if (event.error === "canceled" || event.error === "interrupted") {
            return;
        }

        if (status) {
            status.textContent = `Speech error: ${event.error}. Try again.`;
        }
    };

    window.speechSynthesis.speak(utterance);
}

function stopSpeaking() {
    if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
    }

    if (status) status.textContent = "Speech stopped.";
    if (voiceStatus) voiceStatus.textContent = "Speech stopped.";
}

function rememberResult(text) {
    if (text && text.trim()) {
        latestResultText = text.trim();
    }
}

// =========================================================
// 2. IMAGE PREVIEW AND OCR
// =========================================================

if (imageInput) {
    imageInput.addEventListener("change", () => {
        const file = imageInput.files[0];

        extractedText = "";

        if (result) {
            result.textContent = "Your extracted text will appear here.";
        }

        if (speakButton) speakButton.disabled = true;
        if (repeatButton) repeatButton.disabled = true;

        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            previewUrl = null;
        }

        if (!file) {
            if (fileName) fileName.textContent = "No image selected.";
            if (preview) preview.hidden = true;
            return;
        }

        if (fileName) fileName.textContent = file.name;

        if (!file.type.startsWith("image/")) {
            if (status) status.textContent = "Please choose a valid image.";
            imageInput.value = "";

            if (fileName) fileName.textContent = "No image selected.";
            if (preview) preview.hidden = true;
            return;
        }

        previewUrl = URL.createObjectURL(file);

        if (preview) {
            preview.src = previewUrl;
            preview.hidden = false;
        }

        if (status) status.textContent = "Image selected. Ready to read.";
    });
}

if (form) {
    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const file = imageInput?.files?.[0];

        if (!file) {
            if (status) status.textContent = "Please choose an image first.";
            return;
        }

        const data = new FormData();
        data.append("file", file);

        if (readButton) readButton.disabled = true;
        if (status) status.textContent = "Reading image. Please wait...";
        if (result) result.textContent = "Processing image...";

        try {
            const response = await fetch(`${API_URL}/read-text`, {
                method: "POST",
                body: data
            });

            const payload = await response.json();

            if (!response.ok) {
                throw new Error(payload.detail || "OCR request failed.");
            }

            extractedText = (payload.text || "").trim();

            if (result) {
                result.textContent = extractedText ||
                    "No readable text found. Try a clearer image.";
            }

            if (speakButton) speakButton.disabled = !extractedText;
            if (repeatButton) repeatButton.disabled = !extractedText;

            if (extractedText) rememberResult(extractedText);

            if (status) {
                status.textContent = payload.message ||
                    "Image processing complete.";
            }
        } catch (error) {
            if (status) {
                status.textContent = `Could not read the image: ${error.message}`;
            }

            if (result) {
                result.textContent =
                    "Please check that the AccessAI backend is running.";
            }
        } finally {
            if (readButton) readButton.disabled = false;
        }
    });
}

if (speakButton) {
    speakButton.addEventListener("click", () => speak(extractedText));
}

if (repeatButton) {
    repeatButton.addEventListener("click", () => {
        speak(extractedText || latestResultText);
    });
}

if (stopButton) {
    stopButton.addEventListener("click", stopSpeaking);
}

// =========================================================
// 3. UPLOADED IMAGE SCENE DETECTION
// =========================================================

if (sceneButton) {
    sceneButton.addEventListener("click", async () => {
        const file = sceneInput?.files?.[0];

        if (!file) {
            sceneResult.textContent = "Please choose an image first.";
            return;
        }

        if (!file.type.startsWith("image/")) {
            sceneResult.textContent = "Please select a valid image.";
            return;
        }

        const data = new FormData();
        data.append("file", file);

        sceneButton.disabled = true;
        sceneResult.textContent = "Analyzing the scene...";

        if (sceneSpeak) sceneSpeak.disabled = true;

        try {
            const response = await fetch(`${API_URL}/describe-scene`, {
                method: "POST",
                body: data
            });

            const payload = await response.json();

            if (!response.ok) {
                throw new Error(payload.detail || "Scene detection failed.");
            }

            sceneDescription = payload.description || "";

            sceneResult.textContent = sceneDescription ||
                "No scene description was returned.";

            if (sceneDescription) rememberResult(sceneDescription);
            if (sceneSpeak) sceneSpeak.disabled = !sceneDescription;

        } catch (error) {
            sceneResult.textContent =
                `Could not describe the scene: ${error.message}`;
        } finally {
            sceneButton.disabled = false;
        }
    });
}

if (sceneSpeak) {
    sceneSpeak.addEventListener("click", () => speak(sceneDescription));
}

// =========================================================
// 4. LIVE CAMERA
// =========================================================

if (startCameraButton) {
    startCameraButton.addEventListener("click", async () => {
        if (!navigator.mediaDevices?.getUserMedia) {
            cameraStatus.textContent =
                "Camera access is unavailable. Use localhost or HTTPS.";
            return;
        }

        try {
            cameraStatus.textContent = "Requesting camera permission...";

            cameraStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment" },
                audio: false
            });

            cameraPreview.srcObject = cameraStream;

            startCameraButton.disabled = true;
            capturePhotoButton.disabled = false;
            stopCameraButton.disabled = false;

            cameraStatus.textContent =
                "Camera is running. Position your image and capture it.";

        } catch (error) {
            cameraStatus.textContent =
                `Could not start camera: ${error.message}. Check camera permission.`;
        }
    });
}

if (capturePhotoButton) {
    capturePhotoButton.addEventListener("click", async () => {
        if (!cameraStream || !cameraPreview.videoWidth) {
            cameraStatus.textContent =
                "Wait for the camera preview, then try again.";
            return;
        }

        cameraCanvas.width = cameraPreview.videoWidth;
        cameraCanvas.height = cameraPreview.videoHeight;

        const context = cameraCanvas.getContext("2d");

        context.drawImage(
            cameraPreview,
            0,
            0,
            cameraCanvas.width,
            cameraCanvas.height
        );

        capturedImageBlob = await new Promise((resolve) => {
            cameraCanvas.toBlob(resolve, "image/jpeg", 0.9);
        });

        if (!capturedImageBlob) {
            cameraStatus.textContent =
                "Could not capture the image. Please try again.";
            return;
        }

        cameraResultText = "";

        cameraReadTextButton.disabled = false;
        cameraDescribeButton.disabled = false;
        cameraSpeakButton.disabled = true;

        cameraResult.textContent =
            "Photo captured. Choose Read Captured Text or Describe Captured Scene.";

        cameraStatus.textContent = "Photo captured successfully.";
    });
}

if (stopCameraButton) {
    stopCameraButton.addEventListener("click", () => {
        if (cameraStream) {
            cameraStream.getTracks().forEach((track) => track.stop());
            cameraStream = null;
        }

        cameraPreview.srcObject = null;

        startCameraButton.disabled = false;
        capturePhotoButton.disabled = true;
        stopCameraButton.disabled = true;

        cameraStatus.textContent = "Camera stopped.";
    });
}

async function processCapturedImage(endpoint, loadingMessage) {
    if (!capturedImageBlob) {
        cameraResult.textContent = "Capture a photo first.";
        return;
    }

    cameraReadTextButton.disabled = true;
    cameraDescribeButton.disabled = true;
    cameraSpeakButton.disabled = true;

    cameraResult.textContent = loadingMessage;

    try {
        const data = new FormData();
        data.append("file", capturedImageBlob, "camera-capture.jpg");

        const response = await fetch(`${API_URL}${endpoint}`, {
            method: "POST",
            body: data
        });

        const payload = await response.json();

        if (!response.ok) {
            throw new Error(payload.detail || "Image processing failed.");
        }

        if (endpoint === "/read-text") {
            cameraResultText = (payload.text || "").trim() ||
                "No readable text was found in the image.";
        } else {
            cameraResultText = payload.description ||
                "No scene description was returned.";
        }

        cameraResult.textContent = cameraResultText;

        rememberResult(cameraResultText);
        cameraSpeakButton.disabled = !cameraResultText;

    } catch (error) {
        cameraResult.textContent = `Error: ${error.message}`;
    } finally {
        cameraReadTextButton.disabled = false;
        cameraDescribeButton.disabled = false;
    }
}

if (cameraReadTextButton) {
    cameraReadTextButton.addEventListener("click", () => {
        processCapturedImage(
            "/read-text",
            "Reading text from your photo..."
        );
    });
}

if (cameraDescribeButton) {
    cameraDescribeButton.addEventListener("click", () => {
        processCapturedImage(
            "/describe-scene",
            "Analyzing objects in your photo..."
        );
    });
}

if (cameraSpeakButton) {
    cameraSpeakButton.addEventListener("click", () => {
        speak(cameraResultText);
    });
}

// =========================================================
// 5. VOICE RECOGNITION
// =========================================================


 // =========================================================
 // 5. VOICE RECOGNITION — IMPROVED
 // =========================================================

if (voiceButton && voiceStatus && voiceTranscript) {
    if (!SpeechRecognitionAPI) {
        voiceButton.disabled = true;
        voiceStatus.textContent =
            "Voice recognition is not supported. Please use a recent version of Chrome.";
    } else {
        voiceRecognition = new SpeechRecognitionAPI();

        voiceRecognition.lang = "en-IN";
        voiceRecognition.continuous = false;
        voiceRecognition.interimResults = true;
        voiceRecognition.maxAlternatives = 3;

        let finalTranscript = "";

        voiceRecognition.onstart = () => {
            isVoiceListening = true;
            finalTranscript = "";

            voiceButton.textContent = "Stop Listening";
            voiceButton.setAttribute("aria-pressed", "true");
            voiceStatus.textContent =
                "Listening... Speak one command clearly.";
            voiceTranscript.textContent = "Waiting for your command...";
        };

        voiceRecognition.onresult = (event) => {
            let interimTranscript = "";

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;

                if (event.results[i].isFinal) {
                    finalTranscript += " " + transcript;
                } else {
                    interimTranscript += transcript;
                }
            }

            const displayedText = (finalTranscript || interimTranscript).trim();

            if (displayedText) {
                voiceTranscript.textContent = `You said: ${displayedText}`;
            }

            if (finalTranscript.trim()) {
                const command = normalizeVoiceCommand(finalTranscript);

                // Stop listening before speaking to reduce microphone echo.
                try {
                    voiceRecognition.stop();
                } catch (_) {
                    // Recognition may already have stopped.
                }

                handleVoiceCommand(command);
            }
        };

        voiceRecognition.onerror = (event) => {
            const messages = {
                "not-allowed":
                    "Microphone permission denied. Allow microphone access in Chrome.",
                "service-not-allowed":
                    "Speech recognition is blocked by the browser.",
                "no-speech":
                    "I didn't hear you. Try again and speak closer to the microphone.",
                "audio-capture":
                    "No microphone detected. Check your microphone connection.",
                "network":
                    "Speech recognition needs a working network connection in this browser.",
                "aborted":
                    "Listening was cancelled."
            };

            if (event.error !== "aborted" || !isVoiceListening) {
                voiceStatus.textContent =
                    messages[event.error] ||
                    `Voice recognition error: ${event.error}.`;
            }
        };

        voiceRecognition.onend = () => {
            isVoiceListening = false;
            voiceButton.textContent = "Start Voice Commands";
            voiceButton.setAttribute("aria-pressed", "false");
        };

        voiceButton.addEventListener("click", () => {
            if (!voiceRecognition) return;

            if (isVoiceListening) {
                voiceRecognition.stop();
                voiceStatus.textContent = "Stopped listening.";
                return;
            }

            try {
                voiceRecognition.start();
            } catch (error) {
                voiceStatus.textContent =
                    "Could not start listening. Wait a moment and try again.";
            }
        });
    }
}

// =========================================================
// 6. COMMAND NORMALIZATION
// =========================================================

function normalizeVoiceCommand(text) {
    return (text || "")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function commandMatches(command, phrases) {
    return phrases.some(phrase => command.includes(phrase));
}

// =========================================================
// 7. VOICE COMMAND HANDLER
// =========================================================

function handleVoiceCommand(command) {
    if (!command) {
        voiceStatus.textContent =
            "I didn't catch the command. Please try again.";
        return;
    }

    // STOP SPEECH
    if (commandMatches(command, [
        "stop speaking",
        "stop talking",
        "be quiet",
        "stop reading",
        "cancel speech",
        "stop"
    ])) {
        stopSpeaking();
        return;
    }

    // REPEAT THE MOST RECENT RESULT
    if (commandMatches(command, [
        "repeat result",
        "repeat the result",
        "repeat that",
        "say again",
        "read it again",
        "repeat"
    ])) {
        const textToRepeat =
            latestResultText ||
            cameraResultText ||
            sceneDescription ||
            extractedText;

        if (textToRepeat && textToRepeat.trim()) {
            voiceStatus.textContent = "Repeating the latest result.";
            speak(textToRepeat);
        } else {
            voiceStatus.textContent =
                "There is no result to repeat yet. Read text or describe a scene first.";
        }
        return;
    }

    // READ TEXT
    if (commandMatches(command, [
        "read text",
        "read the text",
        "read this",
        "read the image",
        "read image",
        "read everything",
        "read the page",
        "read this page",
        "what is written",
        "what is on the page",
        "tell me what is written",
        "read it"
    ])) {
        // If a new or existing uploaded image is selected, use that first.
        if (imageInput?.files?.length) {
            if (extractedText.trim()) {
                rememberResult(extractedText);
                voiceStatus.textContent = "Reading extracted text aloud.";
                speak(extractedText);
            } else if (form?.requestSubmit) {
                voiceStatus.textContent = "Extracting text from your selected image.";
                form.requestSubmit();
            } else if (readButton) {
                readButton.click();
                voiceStatus.textContent = "Extracting text from your selected image.";
            } else {
                voiceStatus.textContent = "The Read Text button is unavailable.";
            }
            return;
        }

        // Otherwise, use the most recently captured camera photo.
        if (capturedImageBlob && cameraReadTextButton) {
            voiceStatus.textContent = "Reading text from your captured photo.";
            cameraReadTextButton.click();
            return;
        }

        // Fall back to previously extracted text.
        if (extractedText.trim()) {
            rememberResult(extractedText);
            voiceStatus.textContent = "Reading the available extracted text.";
            speak(extractedText);
            return;
        }

        voiceStatus.textContent =
            "Please select a text image or capture a photo first.";
        return;
    }

    // DESCRIBE A SCENE
    if (commandMatches(command, [
        "describe scene",
        "describe the scene",
        "describe surroundings",
        "describe my surroundings",
        "describe this image",
        "describe the image",
        "describe this picture",
        "describe the picture",
        "what can you see",
        "what is in this picture",
        "what is in the picture",
        "tell me what you see"
    ])) {
        // Prefer the selected scene image over an old camera capture.
        if (sceneInput?.files?.length && sceneButton) {
            voiceStatus.textContent = "Analyzing your selected scene image.";
            sceneButton.click();
            return;
        }

        if (capturedImageBlob && cameraDescribeButton) {
            voiceStatus.textContent = "Analyzing your captured scene.";
            cameraDescribeButton.click();
            return;
        }

        if (sceneDescription.trim()) {
            rememberResult(sceneDescription);
            voiceStatus.textContent = "Speaking the latest scene description.";
            speak(sceneDescription);
            return;
        }

        voiceStatus.textContent =
            "Please select a scene image or capture a photo first.";
        return;
    }

    // COMMAND NOT RECOGNIZED
    voiceStatus.textContent =
        "I heard you, but couldn't identify that command. Try Read Text, Describe Scene, Repeat Result, or Stop Speaking.";
}


// =========================================================
// 6. VOICE COMMAND HANDLER
// =========================================================

function handleVoiceCommand(command) {
    // STOP SPEECH
    if (
        command.includes("stop speaking") ||
        command === "stop" ||
        command.includes("be quiet") ||
        command.includes("stop talking")
    ) {
        stopSpeaking();
        return;
    }

    // READ TEXT FROM CAMERA OR UPLOADED IMAGE
    if (
        command.includes("read text") ||
        command.includes("read this") ||
        command.includes("read image") ||
        command.includes("read everything") ||
        command.includes("what is written") ||
        command.includes("what's written") ||
        command.includes("tell me everything") ||
        command.includes("read the page") ||
        command.includes("read the text")
    ) {
        if (capturedImageBlob) {
            cameraReadTextButton.click();
            voiceStatus.textContent =
                "Reading text from the captured photo.";
        } else if (imageInput?.files?.length) {
            if (form.requestSubmit) {
                form.requestSubmit();
            } else {
                readButton.click();
            }

            voiceStatus.textContent =
                "Reading text from the selected image.";
        } else {
            voiceStatus.textContent =
                "Please capture a photo or select a text image first.";
        }

        return;
    }

    // DESCRIBE A SCENE
    if (
        command.includes("describe scene") ||
        command.includes("describe the scene") ||
        command.includes("describe surroundings") ||
        command.includes("describe my surroundings") ||
        command.includes("what can you see") ||
        command.includes("describe this picture") ||
        command.includes("what is in this picture") ||
        command.includes("tell me what you see") ||
        command.includes("describe the picture") ||
        command.includes("describe this image")
    ) {
        if (capturedImageBlob) {
            cameraDescribeButton.click();
            voiceStatus.textContent =
                "Describing the captured scene.";
        } else if (sceneInput?.files?.length) {
            sceneButton.click();
            voiceStatus.textContent =
                "Describing the selected scene image.";
        } else {
            voiceStatus.textContent =
                "Please capture a photo or select a scene image first.";
        }

        return;
    }

    // REPEAT THE MOST RECENT RESULT
    if (
        command.includes("repeat result") ||
        command.includes("repeat that") ||
        command.includes("say again") ||
        command.includes("repeat") ||
        command.includes("read it again")
    ) {
        const textToRepeat =
            latestResultText ||
            cameraResultText ||
            sceneDescription ||
            extractedText;

        if (textToRepeat) {
            speak(textToRepeat);
            voiceStatus.textContent = "Repeating the latest result.";
        } else {
            voiceStatus.textContent =
                "There is no result to repeat yet.";
        }

        return;
    }

    // UNKNOWN COMMAND
    voiceStatus.textContent =
        "Command not recognised. Try Read Text, Describe the Scene, Repeat Result, or Stop Speaking.";
}

