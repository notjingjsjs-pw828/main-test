// server.js 
require('dotenv').config(); const express = require('express'); const axios = require('axios'); const path = require('path'); const { v4: uuidv4 } = require('uuid');

const app = express(); const PORT = process.env.PORT || 3000; const HEROKU_API_KEY = process.env.HEROKU_API_KEY; const GITHUB_REPO_TARBALL = 'https://github.com/NOTHING-MD420/project-test/tarball/main';

app.use(express.static('public')); app.use(express.urlencoded({ extended: true })); app.use(express.json());

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Headers required by Heroku API 
const herokuHeaders = { 
  Authorization: `Bearer ${HEROKU_API_KEY}`, 
  Accept: 'application/vnd.heroku+json; version=3', 
  'Content-Type': 'application/json' 
};

app.post('/deploy', async (req, res) => { const { sessionId, appName } = req.body;

if (!sessionId) { return res.status(400).json({ error: 'SESSION_ID is required' }); }

const generatedAppName = appName?.trim() 
  ? appName.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-') 
  : `xbot-${uuidv4().slice(0, 6)}`;

try { 
  // Step 1: Create Heroku app 
const createAppRes = await axios.post('https://api.heroku.com/apps', { name: generatedAppName }, { headers: herokuHeaders });

// Step 2: Set config vars
await axios.patch(`https://api.heroku.com/apps/${generatedAppName}/config-vars`, {
  SESSION_ID: sessionId
}, { headers: herokuHeaders });

// Step 3: Trigger build
await axios.post(`https://api.heroku.com/apps/${generatedAppName}/builds`, {
  source_blob: {
    url: GITHUB_REPO_TARBALL
  }
}, { headers: herokuHeaders });

res.json({ message: 'Deployment started!', appUrl: `https://${generatedAppName}.herokuapp.com` });

} catch (error) { console.error(error.response?.data || error.message); res.status(500).json({ error: 'Deployment failed', details: error.response?.data || error.message }); } });

app.listen(PORT, () => { console.log('Server running on port ' + PORT); 
                       });

