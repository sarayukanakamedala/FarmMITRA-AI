# FarmMitra AI - Architecture Notes

## High-Level Flow

```
                         ┌─────────────────────────┐
                         │   React Frontend (Web)   │
                         │  Mic input / Text / Image │
                         └───────────┬──────────────┘
                                     │ REST (axios)
                                     ▼
                         ┌─────────────────────────┐
                         │  Node.js + Express API    │
                         │        (backend/)         │
                         └───┬─────────┬─────────┬───┘
                             │         │         │
              ┌──────────────┘         │         └───────────────┐
              ▼                        ▼                         ▼
   ┌────────────────────┐   ┌────────────────────┐   ┌────────────────────────┐
   │  Sarvam AI STT/TTS   │   │   OpenAI (LLM)      │   │  Python CNN Microservice │
   │  Speech <-> Text     │   │  Reasoning +        │   │  (disease-service/)      │
   └────────────────────┘   │  Query parsing      │   │  Leaf image -> disease   │
                              └──────────┬──────────┘   └────────────────────────┘
                                         │
                    ┌────────────────────┼─────────────────────┐
                    ▼                    ▼                     ▼
        ┌──────────────────┐  ┌──────────────────┐  ┌───────────────────────┐
        │ Agmarknet API      │  │ OpenWeatherMap API │  │ ICAR Advisory Text     │
        │ (via data.gov.in)  │  │ (5-day forecast)   │  │ (simple keyword RAG)   │
        │ Live mandi prices  │  │                     │  │                        │
        └──────────────────┘  └──────────────────┘  └───────────────────────┘

                             ┌─────────────────────────┐
                             │  MongoDB Atlas            │
                             │  Farmer / Task / Chat     │
                             └─────────────────────────┘

                             ┌─────────────────────────┐
                             │  Resend (email)           │
                             │  Optional task reminders  │
                             └─────────────────────────┘
```

## Request Flow: Market Advisory Query

1. Farmer speaks/types a question in the React UI.
2. If voice: audio blob -> `POST /api/query/voice` -> Sarvam STT -> text.
3. Backend calls OpenAI once to extract `{crop, state, district}` from the question.
4. Backend fetches live data in parallel:
   - Agmarknet mandi prices (district-level, falling back to state-level if no
     data reported for that district today).
   - OpenWeatherMap forecast for the district.
   - Top-matching ICAR advisory text chunks via simple keyword-overlap retrieval.
5. All of the above is assembled into a single grounded prompt sent to OpenAI,
   which returns a concise, actionable recommendation.
6. Backend converts the answer to speech via Sarvam TTS and returns
   `{answerText, audioBase64, priceData, weatherData}` to the frontend.
7. Frontend plays the audio and displays the text.

## Request Flow: Disease Detection

1. Farmer uploads a leaf photo in the React UI.
2. `POST /api/disease/detect` (Node backend) forwards the image via multipart
   form-data to the Python microservice's `POST /predict`.
3. The microservice preprocesses the image (resize to 224x224, normalize) and
   runs it through the trained MobileNetV2-based classifier (or returns a
   labeled mock response if no trained model is present yet).
4. Backend receives `{disease, confidence, remedy}`, converts a summary to
   speech via Sarvam TTS, and returns the full response to the frontend.

## Request Flow: Crop Calendar & Reminders

1. On registration, backend runs `generateTaskList(plantingDate, soilType)` -
   a pure rule-based function reading `data/paddyCalendar.json` and applying
   soil-based offsets/notes. This is deterministic, not LLM-generated.
2. Tasks are stored in MongoDB against the farmer's profile.
3. **Voice reminder**: `GET /api/calendar/:phone/reminder` filters tasks due
   today or earlier, has OpenAI phrase them naturally, converts to speech via
   Sarvam TTS, and returns audio - this simulates "calling in" via the same
   voice interface.
4. **Email reminder** (secondary/optional): `POST /api/notify/:phone/email`
   sends the same due-task list via Resend.

## Why These Design Choices

- **Rule-based crop calendar, not LLM-generated**: reliability for a live demo -
  the schedule can't hallucinate wrong dates or doses.
- **Simple keyword RAG instead of a vector DB**: the advisory corpus is only
  1-2 documents for the paddy-only prototype scope: a vector database would be
  over-engineering for this size and adds unnecessary setup time.
- **Mock mode in the disease microservice**: decouples frontend/backend
  development from CNN training - the full pipeline is demoable at any point,
  even before the model finishes training.
- **Browser-mic voice demo instead of telephony**: avoids Twilio/Exotel
  account, KYC, and cost overhead while still proving the full voice pipeline;
  the same backend endpoint is IVR-ready for future integration.
