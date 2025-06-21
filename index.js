  const express = require('express');
  const cors = require('cors');
  const bodyParser = require('body-parser');
  const fs = require('fs');
  const multer = require('multer');
  require('dotenv').config();

  const { GoogleGenerativeAI } = require('@google/generative-ai');

  const app = express();
  const PORT = 5000;

  app.use(cors());
  app.use(bodyParser.json({ limit: '10mb' }));

  // PDF Upload Endpoint
  const storage = multer.diskStorage({
    destination: 'uploads/',
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname}`);
    }
  });
  const upload = multer({ storage });

  app.post('/upload', upload.single('pdf'), async (req, res) => {
    const pdfParse = require('pdf-parse');
    try {
      const dataBuffer = fs.readFileSync(req.file.path);
      const pdfData = await pdfParse(dataBuffer);
      res.json({ text: pdfData.text });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to extract PDF text' });
    }
  });

  // GEMINI SUMMARY ENDPOINT
  app.post('/summarize', async (req, res) => {
    const { text } = req.body;
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    try {
      const model = genAI.getGenerativeModel({model: 'models/gemini-1.5-flash'});

      const result = await model.generateContent(
    `You're a smart and helpful study assistant. Convert the following academic text into detailed, structured study notes.

  - Use bullet points and headings where appropriate.
  - Simplify complex terms into plain language.
  - Include important definitions, examples, and explanations.
  - Keep the tone academic but student-friendly.

  Text to convert:
  ${text}`
  );

      const response = await result.response;
      const summary = response.text();

      res.json({ summary });
    } catch (error) {
      console.error('Gemini Error:', error.message);
      res.status(500).json({ error: 'Failed to summarize text with Gemini.' });
    }
  });

  app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
  });
  app.post('/chat', async (req, res) => {
    const { prompt } = req.body;
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    try {
      const model = genAI.getGenerativeModel({ model: 'models/gemini-1.5-flash' });
      const result = await model.generateContent(prompt);
      const reply = await result.response.text();
      res.json({ reply });
    } catch (err) {
      console.error('Chatbot Error:', err.message);
      res.status(500).json({ reply: 'Sorry, I couldn’t answer that.' });
    }
  });
  // QUIZ GENERATION ENDPOINT
app.post('/generate-quiz', async (req, res) => {
  const { text } = req.body;

  if (!text || text.trim().length === 0) {
    return res.status(400).json({ error: 'No content provided.' });
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  try {
    const model = genAI.getGenerativeModel({ model: 'models/gemini-1.5-flash' });

    const prompt = `
You're a study assistant. Generate 5 multiple-choice questions from the following content.

Each question object must include:
- "question": string
- "options": array of 4 strings
- "correct": integer (0–3) for the correct answer
- "explanation": a helpful string explaining why the correct answer is correct

Only respond with a valid JSON array of 5 question objects. No extra commentary.

Content:
${text}
`;

    const result = await model.generateContent(prompt);
    const responseText = await result.response.text();

    // Try extracting clean JSON
    const jsonStart = responseText.indexOf('[');
    const jsonEnd = responseText.lastIndexOf(']') + 1;
    const cleanJson = responseText.slice(jsonStart, jsonEnd);

    const quiz = JSON.parse(cleanJson);

    // Double check explanations exist
    const quizWithExplanations = quiz.map(q => ({
      ...q,
      explanation: q.explanation || "No explanation provided."
    }));

    res.json({ quiz: quizWithExplanations });
  } catch (err) {
    console.error('❌ Quiz generation error:', err.message || err);
    res.status(500).json({ error: 'Failed to generate quiz. Try with simpler or shorter text.' });
  }
});


