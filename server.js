require('dotenv').config();
const express = require('express');
const { OpenAI } = require('openai');

const app = express();
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Authentication Middleware
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token format' });
  }

  const token = authHeader.split(' ')[1];
  if (token !== process.env.API_SECRET_KEY) {
    return res.status(403).json({ error: 'Forbidden: Invalid API key' });
  }

  next();
};

app.use(authenticate);

// 1. POST /v1/analyze
app.post('/v1/analyze', async (req, res) => {
  try {
    const { language, code, error_log, framework, context } = req.body;

    if (!code || !error_log) {
      return res.status(400).json({ error: 'Missing required parameters: code, error_log' });
    }

    const systemPrompt = `You are a static analysis engine. Analyze the code and error log provided by the user. 
Return your response strictly as JSON with the following structure:
{
  "issue_type": string,
  "root_cause": string,
  "severity": "low" | "medium" | "high" | "critical",
  "affected_lines": number[]
}`;

    const userPrompt = `Language: ${language || 'Unknown'}
Framework: ${framework || 'None'}
Context: ${JSON.stringify(context || {})}

Code:
${code}

Error Log:
${error_log}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
    });

    const analysis = JSON.parse(response.choices[0].message.content);

    return res.status(200).json({
      status: 'success',
      analysis,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Analysis failed', details: error.message });
  }
});

// 2. POST /v1/patch
app.post('/v1/patch', async (req, res) => {
  try {
    const { language, code, error_log, options } = req.body;

    if (!code || !error_log) {
      return res.status(400).json({ error: 'Missing required parameters: code, error_log' });
    }

    const systemPrompt = `You are an automated code fixing engine. Fix the bug causing the error log in the provided code.
Return your response strictly as JSON with the following structure:
{
  "patched_code": string,
  "diff": string,
  "explanation": string
}`;

    const userPrompt = `Language: ${language || 'Unknown'}
Options: ${JSON.stringify(options || {})}

Code:
${code}

Error Log:
${error_log}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
    });

    const result = JSON.parse(response.choices[0].message.content);

    return res.status(200).json({
      status: 'success',
      patched_code: result.patched_code,
      diff: result.diff,
      explanation: result.explanation,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Patch generation failed', details: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`AutoDebug API running on port ${PORT}`);
});
