<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/b81e7c20-a472-4381-9967-29a2d68da12c

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Deploy to Render

1. Create a new **Web Service** on [Render](https://render.com/).
2. Connect your repository (GitHub/GitLab).
3. Render should auto-detect the configuration from `render.yaml`.
4. If setting up manually, use:
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
5. Add required **Environment Variables**:
   - `NODE_ENV`: `production`
   - `VITE_TWELVE_DATA_API_KEY`: Your API Key
   - `GEMINI_API_KEY`: Your API Key
   - `PORT`: `3000`
