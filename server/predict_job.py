import sys
import os
import joblib

if len(sys.argv) < 2:
    print('')
    sys.exit(1)

skills_text = sys.argv[1]

# model files should be in project root (or adjust path as needed)
base_dir = os.path.dirname(os.path.abspath(__file__))
model_path = os.path.join(base_dir, '..', 'job_model.pkl')
vectorizer_path = os.path.join(base_dir, '..', 'vectorizer.pkl')

try:
    model = joblib.load(model_path)
    vectorizer = joblib.load(vectorizer_path)
except Exception as e:
    print(f'ERROR_LOADING_MODEL: {e}', file=sys.stderr)
    sys.exit(1)

try:
    X = vectorizer.transform([skills_text])
    prediction = model.predict(X)
    role = prediction[0] if len(prediction) > 0 else ''
    print(role)
except Exception as e:
    print(f'ERROR_PREDICTION: {e}', file=sys.stderr)
    sys.exit(1)
