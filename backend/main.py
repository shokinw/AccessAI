
from pathlib import Path
import io
import os
import tempfile
from services.object_detector import detect_objects

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, UnidentifiedImageError
import pytesseract

# Default Windows installation path.
# Change this if Tesseract is installed elsewhere.
tesseract_path = Path(
    r"C:\Program Files\Tesseract-OCR\tesseract.exe"
)

if tesseract_path.exists():
    pytesseract.pytesseract.tesseract_cmd = str(tesseract_path)
elif os.name == "nt":
    print("Warning: Tesseract executable was not found at the default path.")

app = FastAPI(
    title="AccessAI",
    description="Assistive text-reading API for visually impaired users",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Local development only
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/describe-scene")
async def describe_scene(file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail="Please upload an image file.",
        )

    contents = await file.read()

    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail="Image must be 10 MB or smaller.",
        )

    temp_path = None

    try:
        with Image.open(io.BytesIO(contents)) as image:
            image = image.convert("RGB")

            with tempfile.NamedTemporaryFile(
                suffix=".jpg", delete=False
            ) as temp_file:
                temp_path = temp_file.name

            image.save(temp_path, format="JPEG")

        result = detect_objects(temp_path)
        return result

    except UnidentifiedImageError:
        raise HTTPException(
            status_code=400,
            detail="The uploaded file is not a valid image.",
        )
    except Exception as exc:
        print(f"Scene detection error: {exc}")
        raise HTTPException(
            status_code=500,
            detail="Could not analyze the scene.",
        )
    finally:
        await file.close()
        if temp_path and Path(temp_path).exists():
            Path(temp_path).unlink()


@app.get("/")
def home():
    return {
        "project": "AccessAI",
        "message": "Assistive Agent for Visually Impaired",
        "status": "running",
    }


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.post("/read-text")
async def read_text(file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail="Please upload an image file.",
        )

    try:
        contents = await file.read()

        if len(contents) > 10 * 1024 * 1024:
            raise HTTPException(
                status_code=413,
                detail="Image must be 10 MB or smaller.",
            )

        image = Image.open(io.BytesIO(contents))
        image.verify()

        image = Image.open(io.BytesIO(contents)).convert("RGB")
        extracted_text = pytesseract.image_to_string(
            image,
            lang="eng",
        ).strip()

        return {
            "filename": file.filename,
            "text": extracted_text,
            "has_text": bool(extracted_text),
            "message": (
                "Text extracted successfully."
                if extracted_text
                else "No readable text found. Try a clearer image."
            ),
        }

    except HTTPException:
        raise
    except UnidentifiedImageError:
        raise HTTPException(
            status_code=400,
            detail="The uploaded file is not a valid image.",
        )
    except pytesseract.TesseractNotFoundError:
        raise HTTPException(
            status_code=500,
            detail="Tesseract OCR is not installed or its path is incorrect.",
        )
    except Exception as exc:
        print(f"OCR error: {exc}")
        raise HTTPException(
            status_code=500,
            detail="Could not process this image.",
        )
    finally:
        await file.close()
