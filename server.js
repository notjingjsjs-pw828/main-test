require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

const USERS_FILE = path.join(__dirname, 'allusers.json');
const BOTS_FILE = path.join(__dirname, 'allbots.json');

const HEROKU_API_KEY = process.env.HEROKU_API_KEY;
const GITHUB_REPO_TARBALL = 'https://github.com/NOTHING-MD420/project-test/tarball/main';

const herokuHeaders = {
  Authorization: `Bearer ${HEROKU_API_KEY}`,
  Accept: 'application/vnd.heroku+json; version=3',
  'Content-Type': 'application/json'
};

app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function readJsonFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify([], null, 2));
      return [];
    }
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`Error reading file ${filePath}:`, err);
    return [];
  }
}

function writeJsonFile(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error(`Error writing file ${filePath}:`, err);
  }
}

function canAddCoins(user) {
  if (!user.lastCoinAdd) return true;
  const last = new Date(user.lastCoinAdd);
  return (new Date() - last) / (1000 * 60 * 60) >= 24;
}

// Auth Routes
// زمانی که کاربر ثبت‌نام می‌کند
app.post('/api/signup', (req, res) => {
  const { username, phone, email, password } = req.body;
  const users = readJsonFile(USERS_FILE);

  if (!username || !phone || !email || !password)
    return res.json({ status: false, message: 'All fields required' });

  if (!/^[A-Za-z0-9._\-]+$/.test(username))
    return res.json({ status: false, message: 'Invalid username' });

  if (password.length < 6)
    return res.json({ status: false, message: 'Password too short' });

  if (users.find(u => u.username === username))
    return res.json({ status: false, message: 'Username exists' });

  // کاربر جدید با سکه صفر
  const newUser = {
    username,
    phone,
    email,
    password,
    coins: 0, // سکه صفر
    lastCoinAdd: null // زمان دریافت اولین سکه
  };

  users.push(newUser);
  writeJsonFile(USERS_FILE, users);
  res.json({ status: true, message: 'Signup successful' });
});

// اضافه کردن سکه
app.post('/api/add-coins', (req, res) => {
  const { username } = req.body;
  const users = readJsonFile(USERS_FILE);
  const index = users.findIndex(u => u.username === username);
  if (index === -1) return res.json({ status: false, message: 'User not found' });

  const user = users[index];

  // اگر زمان دریافت اولین سکه وجود ندارد، به او 10 سکه بدهیم
  if (!user.lastCoinAdd) {
    user.coins = 10;
    user.lastCoinAdd = new Date().toISOString();
    writeJsonFile(USERS_FILE, users);
    return res.json({ status: true, message: '10 coins added to your account!', coins: user.coins });
  }

  // اگر کمتر از 24 ساعت گذشته باشد، به کاربر زمان باقی‌مانده را نمایش دهیم
  const lastAddTime = new Date(user.lastCoinAdd);
  const timeDiff = new Date() - lastAddTime;
  const hoursRemaining = Math.max(24 - timeDiff / (1000 * 60 * 60), 0); // ساعت باقی‌مانده
  const minutesRemaining = Math.max(Math.floor((24 * 60) - timeDiff / (1000 * 60)), 0); // دقیقه باقی‌مانده
  const secondsRemaining = Math.max(Math.floor((24 * 3600) - timeDiff / 1000), 0); // ثانیه باقی‌مانده

  if (hoursRemaining > 0) {
    // نمایش ساعت‌ها، دقیقه‌ها و ثانیه‌ها
    return res.json({ status: false, message: `Wait: ${Math.floor(hoursRemaining)}h ${Math.floor(minutesRemaining % 60)}m ${Math.floor(secondsRemaining % 60)}s` });
  }

  // اگر 24 ساعت گذشته باشد، 10 سکه دیگر به کاربر داده می‌شود
  user.coins += 10;
  user.lastCoinAdd = new Date().toISOString();
  writeJsonFile(USERS_FILE, users);
  res.json({ status: true, message: '10 coins added', coins: user.coins });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const users = readJsonFile(USERS_FILE);
  const user = users.find(u => u.username === username && u.password === password);

  if (!user)
    return res.json({ status: false, message: 'Invalid credentials' });

  res.json({
    status: true,
    message: 'Login successful',
    user: {
      username: user.username,
      phone: user.phone,
      email: user.email,
      coins: user.coins
    }
  });
});

app.post('/api/delete-bot', async (req, res) => {
  const { appName, username } = req.body;

  if (!appName || !username) {
    return res.status(400).json({ status: false, message: 'Missing appName or username' });
  }

  try {
    // حذف از Heroku
    await axios.delete(`https://api.heroku.com/apps/${appName}`, {
      headers: herokuHeaders
    });

    // حذف از allbots.json
    const bots = readJsonFile(BOTS_FILE);
    const updatedBots = bots.filter(b => !(b.name === appName && b.byUser === username));
    writeJsonFile(BOTS_FILE, updatedBots);

    res.json({ status: true, message: 'App deleted successfully' });
  } catch (err) {
    console.error('❌ Delete Error:', err.response?.data || err.message);
    res.status(500).json({ status: false, message: 'Delete failed', error: err.message });
  }
});


app.get('/api/coins/:username', (req, res) => {
  const username = req.params.username;
  const users = readJsonFile(USERS_FILE);
  const user = users.find(u => u.username === username);
  if (!user) return res.json({ status: false, message: 'User not found' });
  res.json({ status: true, coins: user.coins });
});


app.get('/api/heroku-logs/:appName', async (req, res) => {
  const appName = req.params.appName;
  try {
    const result = await axios({
      method: 'GET',
      url: `https://api.heroku.com/apps/${appName}/log-sessions`,
      headers: {
        Authorization: `Bearer ${process.env.HEROKU_API_KEY}`,
        Accept: 'application/vnd.heroku+json; version=3',
        'Content-Type': 'application/json',
      },
      data: {
        dyno: 'web',
        lines: 100,
        source: 'app',
        tail: false
      }
    });

    const { logplex_url } = result.data;

    const logsResponse = await axios.get(logplex_url);
    res.json({ status: true, logs: logsResponse.data });
  } catch (err) {
    console.error('Log fetch error:', err.message || err);
    res.status(500).json({ status: false, message: 'Failed to fetch logs' });
  }
});


app.post('/api/add-bot-repo', (req, res) => {
  const { name, repoUrl } = req.body;
  if (!name || !repoUrl) return res.status(400).json({ status: false, message: 'Name and Repo URL are required' });

  const bots = readJsonFile('botrepos.json');
  if (bots.find(b => b.name === name)) {
    return res.json({ status: false, message: 'Bot name already exists' });
  }

  bots.push({ name, repoUrl });
  writeJsonFile('botrepos.json', bots);

  res.json({ status: true, message: 'Bot added successfully' });
});

app.get('/deploy/bot/:name', async (req, res) => {
  const botName = req.params.name;
  const appName = req.query.appname?.trim();
  const sessionId = req.query['session-id']?.trim();

  if (!botName || !appName || !sessionId) {
    return res.status(400).json({ status: false, message: "Missing bot name, appname or session-id" });
  }

  const botsList = readJsonFile('botrepos.json');
  const selected = botsList.find(b => b.name === botName);

  if (!selected) {
    return res.status(404).json({ status: false, message: "Bot repo not found" });
  }

  const formattedAppName = appName.toLowerCase().replace(/[^a-z0-9-]/g, '-');

  try {
    // Check if app already exists to avoid conflict
    await axios.get(`https://api.heroku.com/apps/${formattedAppName}`, {
      headers: herokuHeaders
    });

    return res.status(409).json({
      status: false,
      message: "App name is already taken"
    });

  } catch (checkErr) {
    if (checkErr.response?.status !== 404) {
      return res.status(500).json({ status: false, message: "Error checking app existence", error: checkErr.message });
    }
    // Continue if app doesn't exist (404 is OK here)
  }

  try {
    // Create new app
    await axios.post(`https://api.heroku.com/apps`, {
      name: formattedAppName
    }, { headers: herokuHeaders });

    // Set config var
    await axios.patch(`https://api.heroku.com/apps/${formattedAppName}/config-vars`, {
      SESSION_ID: sessionId
    }, { headers: herokuHeaders });

    // Build app from GitHub tarball
    await axios.post(`https://api.heroku.com/apps/${formattedAppName}/builds`, {
      source_blob: { url: selected.repoUrl }
    }, { headers: herokuHeaders });

    // Optional: Log success to your bots file
    const bots = readJsonFile(BOTS_FILE);
    bots.push({
      name: formattedAppName,
      byUser: 'api-deploy',
      date: new Date().toISOString(),
      session: sessionId,
      status: 'Deploying',
      repo: selected.repoUrl
    });
    writeJsonFile(BOTS_FILE, bots);

    // Update to Active after 2 mins
    setTimeout(() => {
      const updated = readJsonFile(BOTS_FILE);
      const index = updated.findIndex(b => b.name === formattedAppName);
      if (index !== -1) {
        updated[index].status = 'Active';
        writeJsonFile(BOTS_FILE, updated);
      }
    }, 2 * 60 * 1000);

    res.json({
      status: true,
      message: `✅ Bot deployed as ${formattedAppName}`,
      url: `https://${formattedAppName}.herokuapp.com`
    });
  } catch (err) {
    console.error("❌ API Deploy Error:", err.response?.data || err.message);
    res.status(500).json({ status: false, message: "Deployment failed", error: err.message });
  }
});

app.get('/api/bot-repos', (req, res) => {
  const bots = readJsonFile('botrepos.json');
  res.json(bots);
});

app.post('/deploy', async (req, res) => {
  const { sessionId, appName, username, repoUrl } = req.body;

  if (!sessionId || !repoUrl)
    return res.status(400).json({ error: 'Session ID and repoUrl are required' });

  const generatedAppName = appName?.trim()
    ? appName.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-')
    : `benbot-${uuidv4().slice(0, 6)}`;

  try {
    const bots = readJsonFile(BOTS_FILE);

    if (bots.length >= 100) {
      return res.status(403).json({
        error: 'Server limit reached',
        message: '💥 All server busy bots no allowed. Try again later.'
      });
    }

    await axios.post('https://api.heroku.com/apps', { name: generatedAppName }, { headers: herokuHeaders });

    await axios.patch(`https://api.heroku.com/apps/${generatedAppName}/config-vars`, {
      SESSION_ID: sessionId
    }, { headers: herokuHeaders });

    await axios.post(`https://api.heroku.com/apps/${generatedAppName}/builds`, {
      source_blob: { url: repoUrl }
    }, { headers: herokuHeaders });

    const newBot = {
      name: generatedAppName,
      byUser: username || 'anonymous',
      date: new Date().toISOString(),
      session: sessionId,
      status: 'Deploying',
      repo: repoUrl
    };

    bots.push(newBot);
    writeJsonFile(BOTS_FILE, bots);

    // وضعیت بعد از ۲ دقیقه Active شود
    setTimeout(() => {
      const updatedBots = readJsonFile(BOTS_FILE);
      const index = updatedBots.findIndex(b => b.name === generatedAppName);
      if (index !== -1) {
        updatedBots[index].status = 'Active';
        writeJsonFile(BOTS_FILE, updatedBots);
        console.log(`✅ Bot ${generatedAppName} status updated to Active`);
      }
    }, 2 * 60 * 1000);

    res.json({ appUrl: `https://${generatedAppName}.herokuapp.com` });

  } catch (err) {
    console.error('❌ Deployment error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Deployment failed', details: err.response?.data || err.message });
  }
});

app.post('/api/user-bots', (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username is required' });

  const bots = readJsonFile(BOTS_FILE);
  const userBots = bots.filter(bot => bot.byUser === username);
  res.json(userBots);
});

app.post('/api/admin/add-coins', (req, res) => {
  const { username, amount } = req.body;
  if (!username || typeof amount !== 'number') {
    return res.status(400).json({ status: false, message: 'Invalid input' });
  }

  const users = readJsonFile(USERS_FILE);
  const userIndex = users.findIndex(u => u.username === username);
  if (userIndex === -1) return res.json({ status: false, message: 'User not found' });

  users[userIndex].coins += amount;
  writeJsonFile(USERS_FILE, users);

  res.json({ status: true, message: `Added ${amount} coins to ${username}` });
});

app.get('/api/admin/all-bots', (req, res) => {
  const bots = readJsonFile(BOTS_FILE);
  res.json(bots);
});


app.get('/api/admin/all-users', (req, res) => {
  const users = readJsonFile(USERS_FILE);
  res.json(users.map(({ password, ...rest }) => rest)); // رمز عبور حذف شود
});


app.get('/api/admin/files', (req, res) => {
  const exclude = ['server.js', 'package.json', 'package-lock.json', 'node_modules'];
  fs.readdir(__dirname, (err, files) => {
    if (err) return res.status(500).json({ status: false, message: 'Error reading directory' });

    const filtered = files.filter(f => !exclude.includes(f) && fs.statSync(path.join(__dirname, f)).isFile());
    res.json(filtered);
  });
});


app.post('/api/redeploy', async (req, res) => {
  const { appName, repoUrl } = req.body;

  if (!appName || !repoUrl) {
    return res.status(400).json({ status: false, message: "Missing app name or repo URL" });
  }

  try {
    await axios.post(`https://api.heroku.com/apps/${appName}/builds`, {
      source_blob: { url: repoUrl }
    }, { headers: herokuHeaders });

    res.json({
      status: true,
      message: `Redeploy started for ${appName}`,
      appUrl: `https://${appName}.herokuapp.com`
    });
  } catch (err) {
    console.error("Redeploy error:", err.response?.data || err.message);
    res.status(500).json({
      status: false,
      message: err.response?.data?.message || "Redeploy failed"
    });
  }
});

// نمایش اطلاعات یک کاربر خاص
app.get('/api/admin/user/:username', (req, res) => {
  const users = readJsonFile(USERS_FILE);
  const user = users.find(u => u.username === req.params.username);
  if (!user) return res.status(404).json({ status: false, message: 'User not found' });
  const { password, ...safeUser } = user;
  res.json({ status: true, user: safeUser });
});

// حذف کاربر
app.post('/api/admin/delete-user', (req, res) => {
  const { username } = req.body;
  let users = readJsonFile(USERS_FILE);
  const index = users.findIndex(u => u.username === username);
  if (index === -1) return res.json({ status: false, message: 'User not found' });
  users.splice(index, 1);
  writeJsonFile(USERS_FILE, users);
  res.json({ status: true, message: `User ${username} deleted.` });
});

app.post('/api/admin/delete-file', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ status: false, message: 'Filename required' });

  const forbidden = ['server.js', 'package.json', 'package-lock.json'];
  const filePath = path.join(__dirname, name);

  if (forbidden.includes(name)) {
    return res.status(403).json({ status: false, message: 'Protected file. Cannot delete.' });
  }

  if (!fs.existsSync(filePath)) return res.json({ status: false, message: 'File not found' });

  fs.unlink(filePath, err => {
    if (err) return res.status(500).json({ status: false, message: 'Could not delete file' });
    res.json({ status: true, message: 'File deleted successfully' });
  });
});


// Static Routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/docs', (req, res) => res.sendFile(path.join(__dirname, 'indexx.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/signup', (req, res) => res.sendFile(path.join(__dirname, 'signup.html')));
app.get('/nothing-panel', (req, res) => res.sendFile(path.join(__dirname, 'panel.html')));
app.get('/addbots', (req, res) => res.sendFile(path.join(__dirname, 'addbots.html')));

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));