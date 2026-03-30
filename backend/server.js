const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Firebase Admin (Requires serviceAccountKey.json in the same directory)
try {
    const serviceAccount = require('./serviceAccountKey.json');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log("Firebase Admin Initialized successfully.");
} catch (error) {
    console.warn("WARNING: Firebase could not be initialized. Please generate a service account key, name it 'serviceAccountKey.json' and place it in the backend folder.");
}

const db = admin.apps.length ? admin.firestore() : null;

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });


// ============================================
// VOLUNTEER ROUTES
// ============================================

// Fetch all volunteers
app.get('/api/volunteers', async (req, res) => {
    if (!db) return res.status(500).json({ error: "Firebase not initialized" });
    try {
        const snapshot = await db.collection('volunteers').get();
        const volunteers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(volunteers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add new volunteer
app.post('/api/volunteers', async (req, res) => {
    if (!db) return res.status(500).json({ error: "Firebase not initialized" });
    try {
        const { name, skill, available, location } = req.body;
        const newVolRef = await db.collection('volunteers').add({ name, skill, available, location, status: available ? 'Available' : 'Not Available' });
        res.status(201).json({ id: newVolRef.id, name, skill, available, location, status: available ? 'Available' : 'Not Available' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update volunteer availability
app.patch('/api/volunteers/:id', async (req, res) => {
    if (!db) return res.status(500).json({ error: "Firebase not initialized" });
    try {
        const { id } = req.params;
        const { available } = req.body;
        await db.collection('volunteers').doc(id).update({ available, status: available ? 'Available' : 'Not Available' });
        res.json({ success: true, id, available });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// ============================================
// TASK ROUTES
// ============================================

// Fetch all tasks
app.get('/api/tasks', async (req, res) => {
    if (!db) return res.status(500).json({ error: "Firebase not initialized" });
    try {
        const snapshot = await db.collection('tasks').get();
        const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(tasks);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add new task
app.post('/api/tasks', async (req, res) => {
    if (!db) return res.status(500).json({ error: "Firebase not initialized" });
    try {
        const { title, requiredSkill, priority, location } = req.body;
        const newTaskRef = await db.collection('tasks').add({
            title,
            requiredSkill,
            priority,
            location,
            assignedTo: null,
            status: 'Pending'
        });
        res.status(201).json({ id: newTaskRef.id, title, requiredSkill, priority, location, assignedTo: null, status: 'Pending' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Assign Volunteer
app.patch('/api/tasks/:id/assign', async (req, res) => {
    if (!db) return res.status(500).json({ error: "Firebase not initialized" });
    try {
        const { id } = req.params;
        const { volunteerId } = req.body;

        const batch = db.batch();
        const taskRef = db.collection('tasks').doc(id);
        const volunteerRef = db.collection('volunteers').doc(volunteerId);

        batch.update(taskRef, { assignedTo: volunteerId, status: 'Assigned' });
        batch.update(volunteerRef, { available: false, status: 'Not Available' });

        await batch.commit();

        res.json({ success: true, taskId: id, volunteerId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// ============================================
// AI MATCHING ROUTE
// ============================================

app.post('/api/match', async (req, res) => {
    if (!db) return res.status(500).json({ error: "Firebase not initialized" });
    try {
        const { taskId } = req.body;

        // Get Task
        const taskDoc = await db.collection('tasks').doc(taskId).get();
        if (!taskDoc.exists) return res.status(404).json({ error: "Task not found" });
        const task = { id: taskDoc.id, ...taskDoc.data() };

        // Get Available Volunteers
        const snapshot = await db.collection('volunteers').where('available', '==', true).get();
        const availableVolunteers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (availableVolunteers.length === 0) {
            return res.json({ bestVolunteer: null, explanation: "No available volunteers found." });
        }

        // Prompt Gemini
        const prompt = `
        You are a smart matching AI for a volunteer task system.
        You must find the BEST volunteer for this task based on skills and location (if location matches, it's better).
        
        Task: ${JSON.stringify(task, null, 2)}
        
        Available Volunteers: ${JSON.stringify(availableVolunteers, null, 2)}
        
        Return ONLY valid JSON matching this schema:
        {
           "bestVolunteerId": "the string id of the matched volunteer, or null if no one is suitable at all",
           "explanation": "A short, one sentence explanation of why this volunteer is the best fit."
        }
        Do not add markdown formatting or code blocks around the JSON output, just output the raw JSON.`;

        if (!process.env.GEMINI_API_KEY) {
            console.warn("Gemini API key is missing. Using fallback simple matcher.");
            // Fallback matching if Gemini is not configured
            const fallbackMatch = availableVolunteers.find(v => v.skill.toLowerCase().includes(task.requiredSkill.toLowerCase()));
            return res.json({ bestVolunteer: fallbackMatch || availableVolunteers[0], explanation: "Fallback matcher chosen." });
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { temperature: 0.1 }
        });

        const textOutput = response.text.trim().replace(/```json/g, '').replace(/```/g, '');
        const result = JSON.parse(textOutput);

        const bestVolunteer = availableVolunteers.find(v => v.id === result.bestVolunteerId) || null;

        res.json({
            bestVolunteer,
            explanation: result.explanation
        });

    } catch (error) {
        console.error("Match error:", error);
        res.status(500).json({ error: error.message });
    }
});


// --- Helper: Haversine distance for Vecto Matching Engine ---
function getHaversineDistance(c1, c2) {
    const R = 6371; // km
    const dLat = (c2.lat - c1.lat) * Math.PI / 180;
    const dLon = (c2.lng - c1.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(c1.lat * Math.PI / 180) * Math.cos(c2.lat * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return {
        text: distance.toFixed(1) + " km",
        value: Math.round(distance * 1000)
    };
}

// Distance Calculation Route (Now using Open Haversine)
app.post('/api/distance', async (req, res) => {
    const { origins, destinations } = req.body;

    if (!origins || !destinations) {
        return res.status(400).json({ error: "Origins and destinations are required." });
    }

    try {
        const originCoords = origins.split('|').map(s => {
            const [lat, lng] = s.split(',').map(Number);
            return { lat, lng };
        });

        const destCoords = destinations.split('|').map(s => {
            const [lat, lng] = s.split(',').map(Number);
            return { lat, lng };
        });

        const rows = originCoords.map(o => {
            return {
                elements: destCoords.map(d => {
                    const dist = getHaversineDistance(o, d);
                    // Estimate duration: 40km/h average in emergency zones
                    const durationSeconds = Math.round((dist.value / 1000) / 40 * 3600);
                    const durationMins = Math.round(durationSeconds / 60);

                    return {
                        distance: dist,
                        duration: {
                            text: durationMins + " mins",
                            value: durationSeconds
                        },
                        status: "OK"
                    };
                })
            };
        });

        res.json({ status: "OK", rows });
    } catch (error) {
        res.status(500).json({ error: "Failed to calculate distances: " + error.message });
    }
});

// Geocoding Proxy Route (Privacy-Focused)
app.get('/api/geocoding', async (req, res) => {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: "Query parameter 'q' is required." });

    try {
        const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=in&limit=5`;

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'VectoVolunteerSystem/1.0',
                'Referer': req.headers.referer || 'http://localhost:3000'
            }
        });
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "Geocoding failed: " + error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Vecto Backend running on http://localhost:${PORT}`);
});
