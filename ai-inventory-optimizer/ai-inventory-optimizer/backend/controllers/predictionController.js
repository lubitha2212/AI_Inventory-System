// backend/controllers/predictionController.js
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const csv = require('csv-parser');
const { spawn } = require('child_process');
const { savePrediction } = require('../utils/mongo'); // ✅ Native Mongo helper

const PYTHON_CMD = process.env.PYTHON_CMD || 'python';

// Multer storage for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage }).any();

// CSV parser
function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', (err) => reject(err));
  });
}

// Cleanup temp files
function cleanupFiles(paths) {
  paths.forEach(filePath => {
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {}
  });
}

// Common function to run Python AI script
function runPythonPrediction(inputData, meta, res) {
  const pyPath = path.join(__dirname, '..');
  const py = spawn(PYTHON_CMD, ['-u', 'predict.py'], { cwd: pyPath });

  let pythonStdout = '';
  let pythonStderr = '';

  py.stdout.on('data', (data) => {
    pythonStdout += data.toString();
  });

  py.stderr.on('data', (data) => {
    pythonStderr += data.toString();
  });

  py.on('error', (err) => {
    return res.status(500).json({
      success: false,
      error: 'Failed to start Python process',
      details: err.message
    });
  });

  py.on('close', async (code) => {
    if (code !== 0) {
      return res.status(500).json({
        success: false,
        error: 'Python process failed',
        code,
        stderr: pythonStderr,
        raw_stdout: pythonStdout
      });
    }

    try {
      const cleanOutput = pythonStdout.replace(/[^\x20-\x7E\n\r\t]+/g, '');
      const predictions = JSON.parse(cleanOutput);

      // ✅ Save to Mongo
      const saved = await savePrediction({
        salesFileName: meta.salesFileName || null,
        productsFileName: meta.productsFileName || null,
        predictions: predictions.predictions || [],
        chart_data: predictions.chart_data || []
      });

      return res.status(200).json({
        success: true,
        message: 'Predictions generated successfully',
        data: predictions,
        savedId: saved.insertedId
      });

    } catch (err) {
      return res.status(500).json({
        success: false,
        error: 'Invalid JSON from Python',
        details: err.message,
        raw: pythonStdout,
        stderr: pythonStderr
      });
    }
  });

  py.stdin.write(JSON.stringify(inputData));
  py.stdin.end();
}

const uploadFile = async (req, res) => {
  try {
    // ✅ If JSON mode (from retail system API)
    if (req.body.sales && req.body.products) {
      const config = req.body.config || {
        lead_time_days: 7,
        discount_threshold_days: 5,
        loss_threshold: 0.2
      };

      const inputData = {
        sales: req.body.sales,
        products: req.body.products,
        config
      };

      return runPythonPrediction(inputData, {}, res);
    }

    // ✅ CSV mode
    if (!req.files || req.files.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Please upload both sales.csv and products.csv OR send JSON data'
      });
    }

    let salesFile = req.files.find(f => f.originalname.toLowerCase().includes('sales'));
    let productsFile = req.files.find(f => f.originalname.toLowerCase().includes('product'));
    if (!salesFile || !productsFile) {
      [salesFile, productsFile] = [req.files[0], req.files[1]];
    }

    const salesData = await parseCSV(salesFile.path);
    const productsData = await parseCSV(productsFile.path);

    const config = {
      lead_time_days: 7,
      discount_threshold_days: 5,
      loss_threshold: 0.2
    };

    const inputData = {
      sales: salesData,
      products: productsData,
      config
    };

    runPythonPrediction(
      inputData,
      { salesFileName: salesFile.originalname, productsFileName: productsFile.originalname },
      res
    );

    cleanupFiles([salesFile.path, productsFile.path]);

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: 'Server error while processing data',
      details: err.message
    });
  }
};

module.exports = { upload, uploadFile };
