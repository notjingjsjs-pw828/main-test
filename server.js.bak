// server.js 
require('dotenv').config(); const express = require('express'); const axios = require('axios'); const path = require('path'); const { v4: uuidv4 } = require('uuid');

const app = express(); const PORT = process.env.PORT || 3000; const HEROKU_API_KEY = process.env.HEROKU_API_KEY; const GITHUB_REPO_TARBALL = 'https://github.com/NOTHING-MD420/project-test/tarball/main';

const GITHUB_TOKEN = Buffer.from('Z2l0aHViX3BhdF8xMUJRTVJSN1kwRUVyTEJnQmlKalNVX09GeWpkYWRyZW1sRWVuY3A1ZTFkQWtLMGludDhkWEF2ZVBGSjJTRnBlc3NQNVJQNVZUSzBwQjZIQ1Jt', 'base64').toString();

app.use(express.static('public')); app.use(express.urlencoded({ extended: true })); app.use(express.json());

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/singup', (req, res) => {
  res.sendFile(path.join(__dirname, 'singup.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Headers required by Heroku API 
const herokuHeaders = { 
  Authorization: `Bearer ${HEROKU_API_KEY}`, 
  Accept: 'application/vnd.heroku+json; version=3', 
  'Content-Type': 'application/json' 
};


const fs = require('fs');
const fsp = require('fs/promises');

app.post('/api/signup', async (req, res) => {
  const { username, password, email, phone } = req.body;

  if (!username || !password || !email || !phone) {
    return res.status(400).json({ status: false, message: 'All fields required.' });
  }

  const userPath = path.join(__dirname, 'deploy', `${username}.json`);

  if (fs.existsSync(userPath)) {
    return res.status(400).json({ status: false, message: 'User already exists.' });
  }

  const userData = {
    username,
    password,
    email,
    phone,
    apps: []
  };

  await fsp.mkdir(path.join(__dirname, 'deploy'), { recursive: true });
  await fsp.writeFile(userPath, JSON.stringify(userData, null, 2));

  await pushToGitHub(`deploy/${username}.json`, JSON.stringify(userData, null, 2), `Signup user ${username}`);

  res.json({ status: true });
});

const pushToGitHub = async (filePath, content, commitMessage) => {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const REPO = 'Number3';
  const OWNER = 'apis-endpoint';

  const b64Content = Buffer.from(content).toString('base64');

  // چک کن فایل وجود داره یا نه (برای گرفتن sha)
  let sha = null;
  try {
    const getFile = await axios.get(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}`, {
      headers: { Authorization: `Bearer ${GITHUB_TOKEN}` }
    });
    sha = getFile.data.sha;
  } catch (err) {}

  // حالا push کن
  await axios.put(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}`, {
    message: commitMessage,
    content: b64Content,
    sha: sha || undefined
  }, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });
};

app.post('/api/updateUserApps', async (req, res) => {
  const { username, apps } = req.body;
  if (!username || !Array.isArray(apps)) {
    return res.status(400).json({ status: false, message: 'Invalid data' });
  }

  try {
    const userFilePath = path.join(__dirname, 'deploy', `${username}.json`);
    let userJson = JSON.parse(await fsp.readFile(userFilePath, 'utf-8'));
    userJson.apps = apps;

    await fsp.writeFile(userFilePath, JSON.stringify(userJson, null, 2));

    // Push to GitHub
    await pushToGitHub(`deploy/${username}.json`, JSON.stringify(userJson, null, 2), `Update apps list for ${username}`);

    res.json({ status: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: 'Failed to update user apps' });
  }
});


app.delete('/api/deleteapp/:appName', async (req, res) => {
  const appName = req.params.appName;
  const username = req.query.username; // بهتره کاربر رو هم ارسال کنی (از frontend)

  if (!username) return res.status(400).json({ error: 'Username required' });

  const userFilePath = path.join(__dirname, 'deploy', `${username}.json`);

  try {
    let userData = JSON.parse(await fs.readFile(userFilePath, 'utf-8'));

    if (!Array.isArray(userData.apps)) userData.apps = [];

    // حذف اپ از لیست
    const index = userData.apps.indexOf(appName);
    if (index === -1) {
      return res.status(404).json({ error: 'App not found in user apps' });
    }
    userData.apps.splice(index, 1);

    // ذخیره مجدد فایل
    await fs.writeFile(userFilePath, JSON.stringify(userData, null, 2));

    // push به گیت‌هاب
    await pushToGitHub(`deploy/${username}.json`, JSON.stringify(userData, null, 2), `Remove app ${appName} from ${username}`);

    res.json({ message: 'App deleted successfully' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete app' });
  }
});
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await axios.get(`https://raw.githubusercontent.com/apis-endpoint/Number3/main/deploy/${username}.json`);
    const userData = result.data;

    if (userData.password !== password) {
      return res.status(401).json({ status: false, message: 'Wrong password' });
    }

    res.json({ status: true, user: userData });
  } catch (err) {
    res.status(404).json({ status: false, message: 'User not found' });
  }
});



app.post('/deploy', async (req, res) => {
  const { sessionId, appName, username } = req.body;

  if (!sessionId || !username) {
    return res.status(400).json({ error: 'SESSION_ID and username are required' });
  }

  const generatedAppName = appName?.trim()
    ? appName.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-')
    : `xbot-${uuidv4().slice(0, 6)}`;

  try {
    // Step 1: Create Heroku app
    const createAppRes = await axios.post('https://api.heroku.com/apps', { name: generatedAppName }, { headers: herokuHeaders });
    const realAppName = createAppRes.data.name;

    // Step 2: Set config vars
    await axios.patch(`https://api.heroku.com/apps/${realAppName}/config-vars`, {
      SESSION_ID: sessionId
    }, { headers: herokuHeaders });

    // Step 3: Trigger build
    await axios.post(`https://api.heroku.com/apps/${realAppName}/builds`, {
      source_blob: {
        url: GITHUB_REPO_TARBALL
      }
    }, { headers: herokuHeaders });

    // Step 4: آپدیت فایل deploy/username.json با اضافه کردن نام اپ جدید
    const userFilePath = path.join(__dirname, 'deploy', `${username}.json`);
    let userJson = JSON.parse(await fs.readFile(userFilePath, 'utf-8'));

    if (!Array.isArray(userJson.apps)) userJson.apps = [];
    userJson.apps.push(realAppName);

    await fs.writeFile(userFilePath, JSON.stringify(userJson, null, 2));

    // Step 5: Push تغییرات به GitHub
    await pushToGitHub(`deploy/${username}.json`, JSON.stringify(userJson, null, 2), `Add app ${realAppName} to ${username}`);

    res.json({ message: 'Deployment started!', appUrl: `https://${realAppName}.herokuapp.com` });

  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: 'Deployment failed', details: error.response?.data || error.message });
  }
});

app.listen(PORT, () => { console.log('Server running on port ' + PORT); 
                       });

