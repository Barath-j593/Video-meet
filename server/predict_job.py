import sys
import os
import joblib
import time

try:
    import mlflow
except Exception:
    mlflow = None

if len(sys.argv) < 2:
    print('')
    sys.exit(1)

skills_text = sys.argv[1]

# model files should be in project root (or adjust path as needed)
base_dir = os.path.dirname(os.path.abspath(__file__))
model_path = os.path.join(base_dir, '..', 'job_model.pkl')
vectorizer_path = os.path.join(base_dir, '..', 'vectorizer.pkl')

if mlflow is not None:
    tracking_uri = os.environ.get('MLFLOW_TRACKING_URI')
    if tracking_uri:
        mlflow.set_tracking_uri(tracking_uri)
    else:
        db_path = os.path.join(base_dir, '..', 'mlflow.db')
        mlflow.set_tracking_uri(f"sqlite:///{db_path}")
    mlflow.set_experiment("job-role-prediction")

try:
    model = joblib.load(model_path)
    vectorizer = joblib.load(vectorizer_path)
except Exception as e:
    print(f'ERROR_LOADING_MODEL: {e}', file=sys.stderr)
    sys.exit(1)

def run_prediction():
    X = vectorizer.transform([skills_text])
    prediction = model.predict(X)
    return prediction[0] if len(prediction) > 0 else ''


try:
    started_at = time.perf_counter()

    if mlflow is not None:
        with mlflow.start_run(run_name="predict"):
            mlflow.log_param("input_chars", len(skills_text))
            mlflow.log_param("model_path", os.path.basename(model_path))
            mlflow.log_param("vectorizer_path", os.path.basename(vectorizer_path))

            role = run_prediction()

            latency_ms = (time.perf_counter() - started_at) * 1000
            mlflow.log_metric("prediction_latency_ms", latency_ms)
            mlflow.set_tag("predicted_role", str(role))
    else:
        role = run_prediction()

    print(role)
except Exception as e:
    print(f'ERROR_PREDICTION: {e}', file=sys.stderr)
    sys.exit(1)
