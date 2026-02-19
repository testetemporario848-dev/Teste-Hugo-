import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // Initialize GoogleGenAI here to ensure the latest API key is used
  const getGenAI = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not set.');
    }
    return new GoogleGenAI({ apiKey });
  };

  // API route for image editing
  app.post('/api/edit-image', async (req, res) => {
    try {
      const { prompt, imageData, mimeType } = req.body;

      if (!prompt || !imageData || !mimeType) {
        return res.status(400).json({ error: 'Missing prompt, image data, or mime type.' });
      }

      const ai = getGenAI();

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: {
          parts: [
            {
              inlineData: {
                data: imageData,
                mimeType: mimeType,
              },
            },
            { text: prompt },
          ],
        },
        config: {
          imageConfig: {
            aspectRatio: '1:1',
            imageSize: '1K',
          },
        },
      });

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return res.json({ image: part.inlineData.data, mimeType: part.inlineData.mimeType });
        } else if (part.text) {
          // Optionally handle text responses from the model if any
          console.log('Model text response:', part.text);
        }
      }
      return res.status(500).json({ error: 'No image data returned from AI.' });

    } catch (error: any) {
      console.error('AI Image Editing Error:', error);
      // Check for API key related errors
      if (error.message && error.message.includes('API key not valid')) {
        return res.status(401).json({ error: 'Invalid or missing API key. Please select a valid key.' });
      }
      return res.status(500).json({ error: error.message || 'Failed to edit image with AI.' });
    }
  });

  // Serve static files in production
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    // Vite middleware for development
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
