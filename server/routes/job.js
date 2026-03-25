const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const path = require('path');

// POST /api/predict-job
router.post('/predict-job', (req, res) => {
  const { skills } = req.body;

  if (!skills || typeof skills !== 'string' || !skills.trim()) {
    return res.status(400).json({ error: 'skills text is required' });
  }

  const scriptPath = path.join(__dirname, '..', 'predict_job.py');

  const pythonProcess = spawn('python', [scriptPath, skills]);

  let output = '';
  let errorOutput = '';

  pythonProcess.stdout.on('data', (data) => {
    output += data.toString();
  });

  pythonProcess.stderr.on('data', (data) => {
    errorOutput += data.toString();
  });

  pythonProcess.on('close', (code) => {
    if (code !== 0 || errorOutput) {
      console.error('predict_job.py error', code, errorOutput);
      return res.status(500).json({ error: 'Prediction failed', detail: errorOutput.trim() });
    }

    const jobRole = output.trim();
    if (!jobRole) {
      return res.status(500).json({ error: 'No prediction returned' });
    }

    res.json({ jobRole });
  });
});

module.exports = router;
