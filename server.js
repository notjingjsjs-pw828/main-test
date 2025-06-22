// server.js 
require('dotenv').config(); 
const express = require('express'); 
const axios = require('axios'); 
const path = require('path'); 
const { v4: uuidv4 } = require('uuid');

const app = express(); 
const PORT = process.env.PORT || 3000; 
const HEROKU_API_KEY = process.env.HEROKU_API_KEY; 
const GITHUB_REPO_TARBALL = 'https://github.com/NOTHING-MD420/project-test/tarball/main';

const herokuHeaders = { 
  Authorization: `Bearer ${HEROKU_API_KEY}`, 
  Accept: 'application/vnd.heroku+json; version=3', 
  'Content-Type': 'application/json' 
};

app.use(express.static('public')); 
app.use(express.urlencoded({ extended: true })); 
app.use(express.json());

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Deploy bot
app.post('/deploy', async (req, res) => {
  const { sessionId, appName } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: 'SESSION_ID is required' });
  }

  const generatedAppName = appName?.trim() 
    ? appName.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-') 
    : `xbot-${uuidv4().slice(0, 6)}`;

  try {
    // Create Heroku app
    const createAppRes = await axios.post('https://api.heroku.com/apps', { name: generatedAppName }, { headers: herokuHeaders });
    const realAppName = createAppRes.data.name;

    // Get real URL
    const appInfoRes = await axios.get(`https://api.heroku.com/apps/${realAppName}`, { headers: herokuHeaders });
    const realWebUrl = appInfoRes.data.web_url;

    // Set config vars
    await axios.patch(`https://api.heroku.com/apps/${realAppName}/config-vars`, {
      SESSION_ID: sessionId
    }, { headers: herokuHeaders });

    // Trigger build
    await axios.post(`https://api.heroku.com/apps/${realAppName}/builds`, {
      source_blob: {
        url: GITHUB_REPO_TARBALL
      }
    }, { headers: herokuHeaders });

    res.json({ message: 'Deployment started!', appUrl: realWebUrl });
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: 'Deployment failed', details: error.response?.data || error.message });
  }
});

// Get logs
app.get('/logs/:appName', async (req, res) => {
  const { appName } = req.params;
  try {
    const logRes = await axios({
      method: 'GET',
      url: `https://api.heroku.com/apps/${appName}/log-sessions`,
      headers: herokuHeaders,
      data: {
        lines: 100,
        source: 'app',
        tail: false
      }
    });
    res.json({ logsUrl: logRes.data.logplex_url });
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch logs', details: error.response?.data || error.message });
  }
});

// Delete app
app.delete('/deleteapp/:appName', async (req, res) => {
  const { appName } = req.params;
  try {
    await axios.delete(`https://api.heroku.com/apps/${appName}`, { headers: herokuHeaders });
    res.json({ message: `App ${appName} deleted successfully.` });
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to delete app', details: error.response?.data || error.message });
  }
});

// More endpoints can be added here

app.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
});
