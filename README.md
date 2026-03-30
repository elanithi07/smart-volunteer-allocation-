# Vecto Volunteer System 🏢🚀

**Vecto** is a high-performance, disaster-relief volunteer coordination platform designed for the next generation of emergency response. Powered by the **SmartMatch Engine**, Vecto intelligently connects available volunteers with critical tasks based on real-time location, skill sets, and urgency.

![Vecto Logo](https://img.shields.io/badge/Vecto-Volunteer%20System-4f46e5?style=for-the-badge&logo=google-cloud&logoColor=white)

## ✨ key Features

- **🌐 Open-Source Mapping**: Fully migrated from Google Maps to **Leaflet.js** and **OpenStreetMap**, offering a high-performance, cost-free mapping solution.
- **🛡️ Privacy-First Geocoding**: Implemented a custom backend proxy for location searches to protect user IP addresses.
- **⚡ SmartMatch Engine**: An AI-powered coordination system using Gemini AI and native Haversine distance calculations for precise volunteer-to-task matching.
- **🛰️ Live Disaster Feed**: Integration with GDACS and Google News RSS for real-time global and local India-specific disaster alerts.
- **💎 Premium & Responsive UI**: Stunning Blue-to-Emerald Green design system built on high-performance vanilla HTML/CSS/JS.

## 🛠️ Technology Stack

- **Frontend**: Vanilla JS, HTML5, Tailwind CSS, GSAP (Animations), Lucide Icons, Leaflet.js
- **Backend**: Node.js, Express.js, Axios
- **Cloud Services**: Firebase (Auth & Firestore)
- **AI**: Gemini AI (Matching Logic)

## 📖 Quick Start

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v16+)
- A GitHub account

### 2. Local Setup
1. **Clone the repository**:
   ```bash
   git clone https://github.com/elanithi07/smart-volunteer-allocation-.git
   cd smart-volunteer-allocation-
   ```

2. **Initialize the Backend**:
   - Navigate to the `backend/` folder.
   - Run `npm install` to install dependencies.
   - Create a `.env` file based on `.env.example`.
   - Add your `GEMINI_API_KEY` and Firebase credentials.

3. **Launch the platform**:
   - Start the server: `node server.js`
   - Open `index.html` in your favorite browser (Chrome recommended).

## 🔒 Configuration

Ensure you have the following environment variables in your `backend/.env`:
```env
PORT=3000
GEMINI_API_KEY=your_gemini_api_key_here
# Firebase Admin SDK
# (Place serviceAccountKey.json in the backend/ folder)
```

## 🤝 Contribution

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

*© 2025 Vecto Volunteer System. Optimized for Indian disaster relief coordination.*
