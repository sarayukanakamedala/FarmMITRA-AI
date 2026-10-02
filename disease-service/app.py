"""
FarmMitra AI - Paddy Disease Detection Microservice

Exposes a single POST /predict endpoint that accepts a leaf image and
returns the predicted disease, confidence, and remedy text.

Run: python app.py  (defaults to http://localhost:8000)

If model/paddy_disease_model.h5 does not exist yet (i.e. you haven't run
train_model.py), this service falls back to a clearly-labeled MOCK prediction
so the rest of the pipeline (backend + frontend) can still be developed and
demoed end-to-end while the CNN is being trained separately.
"""

import os
import json
import random
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image

app = Flask(__name__)
CORS(app)

MODEL_PATH = "model/paddy_disease_model.h5"
LABELS_PATH = "class_labels.json"
IMG_SIZE = (224, 224)

with open(LABELS_PATH) as f:
    CLASS_LABELS = json.load(f)

model = None
USE_MOCK = True

if os.path.exists(MODEL_PATH):
    try:
        import tensorflow as tf
        model = tf.keras.models.load_model(MODEL_PATH)
        USE_MOCK = False
        print("Loaded trained model from", MODEL_PATH)
    except Exception as e:
        print("Could not load trained model, falling back to mock mode:", e)
else:
    print(f"No trained model found at {MODEL_PATH} - running in MOCK mode.")
    print("Run train_model.py after preparing the dataset to enable real predictions.")


def preprocess_image(file_stream):
    img = Image.open(file_stream).convert("RGB").resize(IMG_SIZE)
    arr = np.array(img) / 255.0
    return np.expand_dims(arr, axis=0)


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "mode": "mock" if USE_MOCK else "model"})


@app.route("/predict", methods=["POST"])
def predict():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]

    try:
        if USE_MOCK:
            # Clearly-labeled mock response for development/demo before the
            # real model is trained - keeps the full pipeline testable.
            idx = str(random.choice(list(CLASS_LABELS.keys())))
            info = CLASS_LABELS[idx]
            return jsonify({
                "disease": info["display_name"],
                "confidence": round(random.uniform(0.75, 0.95), 2),
                "remedy": info["remedy"],
                "mode": "MOCK - train_model.py has not been run yet",
            })

        img_array = preprocess_image(file.stream)
        predictions = model.predict(img_array)[0]
        top_idx = int(np.argmax(predictions))
        confidence = float(predictions[top_idx])
        info = CLASS_LABELS[str(top_idx)]

        return jsonify({
            "disease": info["display_name"],
            "confidence": round(confidence, 2),
            "remedy": info["remedy"],
            "mode": "model",
        })

    except Exception as e:
        return jsonify({"error": f"Prediction failed: {str(e)}"}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
