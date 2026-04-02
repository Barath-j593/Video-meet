const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const path = require('path');

function resolvePythonExecutable() {
  if (process.env.PYTHON_EXECUTABLE && process.env.PYTHON_EXECUTABLE.trim()) {
    return process.env.PYTHON_EXECUTABLE.trim();
  }

  const venvPython = path.join(__dirname, '..', '..', '.venv', 'Scripts', 'python.exe');
  return venvPython;
}

// POST /api/predict-job
router.post('/predict-job', (req, res) => {
  const { skills } = req.body;

  if (!skills || typeof skills !== 'string' || !skills.trim()) {
    return res.status(400).json({ error: 'skills text is required' });
  }

  const scriptPath = path.join(__dirname, '..', 'predict_job.py');
  const pythonExecutable = resolvePythonExecutable();

  const pythonProcess = spawn(pythonExecutable, [scriptPath, skills]);

  let output = '';
  let errorOutput = '';
  let responded = false; // ← guard flag

  const safeRespond = (status, body) => {
    if (responded) return;
    responded = true;
    res.status(status).json(body);
  };

  pythonProcess.stdout.on('data', (data) => {
    output += data.toString();
  });

  pythonProcess.stderr.on('data', (data) => {
    errorOutput += data.toString();
  });

  pythonProcess.on('error', (spawnError) => {
    console.error('Failed to start Python process:', spawnError);
    safeRespond(500, {
      error: 'Prediction failed',
      detail: `Unable to start Python: ${spawnError.message}`,
    });
  });

  pythonProcess.on('close', (code) => {
    if (code !== 0) {
      console.error('predict_job.py error', code, errorOutput);
      return safeRespond(500, { error: 'Prediction failed', detail: errorOutput.trim() });
    }

    if (errorOutput.trim()) {
      console.warn('predict_job.py warnings:', errorOutput.trim());
    }

    const jobRole = output.trim();
    if (!jobRole) {
      return safeRespond(500, {
        error: 'No prediction returned',
        detail: errorOutput.trim() || 'Empty output from prediction script',
      });
    }

    safeRespond(200, { jobRole });
  });
});

module.exports = router;