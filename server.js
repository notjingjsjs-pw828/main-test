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

  const newUser = {
    username,
    phone,
    email,
    password,
    coins: 10,
    lastCoinAdd: new Date().toISOString()
  };

  users.push(newUser);
  writeJsonFile(USERS_FILE, users);
  res.json({ status: true, message: 'Signup successful' });
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

app.post('/api/add-coins', (req, res) => {
  const { username } = req.body;
  const users = readJsonFile(USERS_FILE);
  const index = users.findIndex(u => u.username === username);
  if (index === -1) return res.json({ status: false, message: 'User not found' });

  if (!canAddCoins(users[index]))
    return res.json({ status: false, message: 'Wait 24 hours' });

  users[index].coins += 10;
  users[index].lastCoinAdd = new Date().toISOString();
  writeJsonFile(USERS_FILE, users);
  res.json({ status: true, message: '10 coins added', coins: users[index].coins });
});

app.post('/deploy', async (req, res) => {
  const { sessionId, appName, username } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'Session ID required' });

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
      source_blob: { url: GITHUB_REPO_TARBALL }
    }, { headers: herokuHeaders });

    const newBot = {
      name: generatedAppName,
      byUser: username || 'anonymous',
      date: new Date().toISOString(),
      session: sessionId,
      status: 'Deploying'
    };

    bots.push(newBot);
    writeJsonFile(BOTS_FILE, bots);

    // Set status to Active after 3 minutes
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

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));