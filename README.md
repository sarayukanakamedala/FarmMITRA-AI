# FarmMitra AI - Your Voice-Based Farming Companion

A voice-first AI companion for paddy farmers combining market advisory, paddy disease
detection, and a personalized crop calendar - built entirely as a software prototype
(no hardware/IoT), runnable on a single laptop.

Built for the 36-Hour National Level Hackathon 2026, Tata Centre for AI & ML, NIT
Tiruchirappalli - Thrust Area: AI for Agriculture.

## Modules

1. **Voice/Text Query Interface** - Sarvam AI STT/TTS for speech in/out.
2. **Market Advisory (RAG + LLM)** - Live Agmarknet mandi prices + weather + ICAR
   advisory text, reasoned over by OpenAI to recommend selling time/location.
3. **Paddy Disease Detection (CNN)** - Leaf image classification via a Python
   microservice (MobileNetV2 transfer learning).
4. **Crop Calendar & To-Do List** - Deterministic, soil-adjusted task schedule from
   planting date, with voice + optional email reminders (via Resend).

## Project Structure

```
FarmMitra-AI/
├── backend/            Node.js + Express API (MERN backend)
│   ├── config/          MongoDB connection
│   ├── models/          Farmer, Task, ChatHistory (Mongoose schemas)
│   ├── routes/          farmerRoutes, queryRoutes, diseaseRoutes, calendarRoutes, notifyRoutes
│   ├── services/        marketPriceService, weatherService, ragService, llmService,
│   │                     sarvamService, cropCalendarService, emailService, diseaseService
│   ├── data/             paddyCalendar.json (rule table), icar_paddy_advisory.txt (RAG source)
│   └── server.js
├── disease-service/     Python Flask microservice for CNN-based disease detection
│   ├── app.py            /predict endpoint (runs in mock mode until model is trained)
│   ├── train_model.py    MobileNetV2 transfer-learning training script
│   └── class_labels.json
├── frontend/             React web UI
│   └── src/
│       ├── components/   FarmerRegistration, ChatWindow, VoiceRecorder, DiseaseUpload, TodoDashboard
│       └── api/api.js    Central API client
└── docs/                 Architecture notes
```

## Prerequisites

- Node.js 18+
- Python 3.10+
- MongoDB Atlas account (free tier)
- API keys (see "API Keys Required" below)

## Setup

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
# Fill in your actual API keys in .env
npm run dev
```
Runs at `http://localhost:5000`.

### 2. Disease Detection Microservice

```bash
cd disease-service
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```
Runs at `http://localhost:8000`. Works immediately in **mock mode** even before
you train the CNN - see `disease-service/README.md` for training instructions.

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm start
```
Runs at `http://localhost:3000`.

## API Keys Required

| Key | Where to get it | Free? |
|---|---|---|
| `SARVAM_API_KEY` | https://www.sarvam.ai (signup dashboard) | Free tier |
| `OPENAI_API_KEY` | https://platform.openai.com/api-keys | Paid (has free trial credits for new accounts) |
| `AGMARKNET_API_KEY` | https://data.gov.in (Generate API Key after signup) | Free |
| `AGMARKNET_RESOURCE_ID` | data.gov.in dataset page ("Variety-wise Daily Market Prices Data of Commodity") - already filled with the default resource ID | Free |
| `OPENWEATHER_API_KEY` | https://openweathermap.org/api | Free tier |
| `RESEND_API_KEY` | https://resend.com (API Keys section) | Free tier |
| `MONGO_URI` | https://www.mongodb.com/cloud/atlas (free M0 cluster) | Free |

## Demo Flow (suggested order for judges)

1. **Register** a farmer with a planting date and soil type -> task calendar auto-generates.
2. **Ask a Question** tab - speak or type "Should I sell my paddy now?" -> hear a
   grounded, spoken recommendation using live mandi prices + weather.
3. **Disease Check** tab - upload a paddy leaf photo -> get disease + remedy, spoken aloud.
4. **My To-Do List** tab - show the soil-adjusted task list, play the voice reminder,
   and optionally trigger the email reminder.

## Notes on Scope

- Paddy-only prototype by design (keeps the disease dataset and crop-calendar rules
  small enough to finish in the hackathon window).
- Crop calendar logic is rule-based (not LLM-generated) for demo reliability - it
  cannot hallucinate incorrect fertilizer/irrigation dates.
- The disease-detection microservice runs in a clearly-labeled **mock mode** if no
  trained model file is present, so the full pipeline is demoable even if CNN
  training is still in progress.
- Real-time voice call flow is demoed via the browser mic (no telephony/Twilio
  dependency) - architecturally the same `/api/query/voice` endpoint could be wired
  to an IVR/WhatsApp voice provider later.
"# Farmmitra-ai" 
