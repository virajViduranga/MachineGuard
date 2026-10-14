
from pathlib import Path
import json

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import Literal


# --------------------------------------------------
# 1. Load the trained model and metadata
# --------------------------------------------------

BASE_DIR = Path(__file__).resolve().parents[1]
ARTIFACT_DIR = BASE_DIR / "artifacts"

MODEL_PATH = ARTIFACT_DIR / "model.joblib"
METADATA_PATH = ARTIFACT_DIR / "metadata.json"

if not MODEL_PATH.exists() or not METADATA_PATH.exists():
    raise FileNotFoundError(
        "Model artifacts not found. Expected model.joblib "
        "and metadata.json inside ml/artifacts/."
    )

model = joblib.load(MODEL_PATH)

with open(METADATA_PATH, encoding="utf-8") as file:
    metadata = json.load(file)

THRESHOLD = float(metadata["decision_threshold"])
MODEL_VERSION = metadata["model_version"]


# --------------------------------------------------
# 2. Create the FastAPI application
# --------------------------------------------------

app = FastAPI(
    title="MachineGuard ML API",
    description="Predictive maintenance inference service",
    version=MODEL_VERSION,
)


# --------------------------------------------------
# 3. Define and validate the incoming request
# --------------------------------------------------

class MachineReading(BaseModel):
    machine_type: Literal["L", "M", "H"]

    air_temperature_k: float = Field(
        gt=0, le=1000
    )

    process_temperature_k: float = Field(
        gt=0, le=1000
    )

    rotational_speed_rpm: float = Field(
        gt=0, le=100000
    )

    torque_nm: float = Field(
        ge=0, le=10000
    )

    tool_wear_min: float = Field(
        ge=0, le=100000
    )


# --------------------------------------------------
# 4. Health-check endpoint
# --------------------------------------------------

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "model": metadata["model_name"],
        "model_version": MODEL_VERSION,
    }


# --------------------------------------------------
# 5. Prediction endpoint
# --------------------------------------------------

@app.post("/predict")
def predict_failure(reading: MachineReading):
    try:
        # Convert API field names into the exact
        # column names used during model training.
        machine_data = pd.DataFrame([{
            "Type": reading.machine_type,
            "Air temperature [K]":
                reading.air_temperature_k,
            "Process temperature [K]":
                reading.process_temperature_k,
            "Rotational speed [rpm]":
                reading.rotational_speed_rpm,
            "Torque [Nm]":
                reading.torque_nm,
            "Tool wear [min]":
                reading.tool_wear_min,
        }])

        # Positive-class probability: Machine failure = 1
        probability = float(
            model.predict_proba(machine_data)[0, 1]
        )

        prediction = int(probability >= THRESHOLD)

        return {
            "prediction": prediction,
            "label": (
                "failure_risk"
                if prediction == 1
                else "no_failure_flag"
            ),
            "failure_probability": probability,
            "decision_threshold": THRESHOLD,
            "model_version": MODEL_VERSION,
        }

    except Exception as exc:
        # Avoid exposing internal error details to clients.
        raise HTTPException(
            status_code=500,
            detail="Prediction failed.",
        ) from exc
