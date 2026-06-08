# Trading Journal Pro

Professional trading journal and risk management suite designed for traders who demand precision and clarity.

**Live Application:** [https://journey-s2fk.onrender.com](https://journey-s2fk.onrender.com)

## Features

- **Multi-Account Management**: Track different trading strategies or funding sources in separate accounts.
- **Trade Logging**: Detailed logging for every trade including entry/exit, position sizing, and P&L.
- **Risk Management**: Automatic calculation of risk-to-reward ratios and drawdown tracking.
- **Performance Analytics**: Visual insights into your trading performance over time.
- **PWA Support**: Install the application on your mobile device or desktop for a native-like experience.
- **Real-time Sync**: Powered by Supabase for instant data persistence across all your devices.

## Tech Stack

- **Frontend**: React 18 with TypeScript
- **Styling**: Tailwind CSS
- **Database & Auth**: Supabase
- **Deployment**: Render

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- Supabase Account

### Environment Setup

Create a `.env` file in the root directory and add your Supabase credentials:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

## Deployment

This project is optimized for deployment on **Render** as a **Web Service**.

1. Connect your GitHub repository to Render.
2. Create a new **Web Service**.
3. Set the **Build Command** to `npm install && npm run build`.
4. Set the **Start Command** to `npm start`.
5. Add your environment variables in the Render dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `NODE_ENV`: `production`

### Database Keep-Alive (Uptime Robot)

To prevent your Supabase database from pausing and keep your Render instance awake, you can use a service like **Uptime Robot** to monitor the following endpoint:

`https://your-app-name.onrender.com/api/health`

This endpoint performs a real database query every time it is called, ensuring your project stays active.

---
*Built for traders, by traders.*
