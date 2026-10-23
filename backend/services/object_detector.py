
from ultralytics import YOLO
from pathlib import Path

# Load a small pretrained model.
# The model weights may download the first time you run it.
MODEL_NAME = "yolo11n.pt"

model = YOLO(MODEL_NAME)


def detect_objects(image_path: str) -> dict:
    """
    Detect objects in an image and return their labels
    and confidence scores.
    """
    results = model.predict(
        source=image_path,
        conf=0.40,
        verbose=False,
    )

    detections = []

    for result in results:
        for box in result.boxes:
            class_id = int(box.cls[0].item())
            confidence = float(box.conf[0].item())
            label = result.names[class_id]

            detections.append({
                "label": label,
                "confidence": round(confidence, 3),
            })

    # Count unique object labels for a concise description.
    counts = {}
    for item in detections:
        label = item["label"]
        counts[label] = counts.get(label, 0) + 1

    if not counts:
        description = (
            "I could not confidently identify any supported objects."
        )
    else:
        parts = []
        for label, count in counts.items():
            if count == 1:
                parts.append(f"one {label}")
            else:
                parts.append(f"{count} {label}s")

        description = "I can see " + ", ".join(parts) + "."

    return {
        "description": description,
        "detections": detections,
        "object_counts": counts,
    }
