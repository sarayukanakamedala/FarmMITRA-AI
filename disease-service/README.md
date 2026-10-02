# FarmMitra AI - Disease Detection Microservice

Python Flask microservice that classifies paddy leaf diseases from an uploaded image.

## Setup

```bash
cd disease-service
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## Running without a trained model (mock mode)

The service works out of the box in **mock mode** - it returns a randomized but
correctly-shaped response so you can build and test the rest of the pipeline
(backend + frontend) immediately, without waiting on model training.

```bash
python app.py
```

Service runs at `http://localhost:8000`. Check `GET /health` to confirm mode
(`"mock"` or `"model"`).

## Training the real model

1. Download the **Paddy Doctor** dataset from Kaggle
   (search "Paddy Doctor Paddy Disease Classification" or "Rice Leaf Diseases").
2. Arrange it into `dataset/train/<class>/*.jpg` and `dataset/val/<class>/*.jpg`
   folders, matching the classes in `class_labels.json`.
3. Run:
   ```bash
   python train_model.py
   ```
   This uses MobileNetV2 transfer learning (frozen base + small trainable head),
   which trains reasonably fast on CPU - suitable for a hackathon timeline.
   If you have Google Colab/GPU access, training will be much faster.
4. The trained model saves to `model/paddy_disease_model.h5`. Restart `app.py`
   and it will automatically detect and load it, switching out of mock mode.

## API

**POST /predict**
- Body: `multipart/form-data` with a `file` field containing the leaf image.
- Response:
  ```json
  {
    "disease": "Leaf Blast",
    "confidence": 0.91,
    "remedy": "Avoid excess nitrogen fertilizer...",
    "mode": "model"
  }
  ```
