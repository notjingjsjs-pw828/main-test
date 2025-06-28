require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


function canAddCoins(user) {
  if (!user.lastCoinAdd) return true;
  const last = new Date(user.lastCoinAdd);
  return (new Date() - last) / (1000 * 60 * 60) >= 24;
}

// Auth Routes

app.post('/api/signup', async (req, res) => {
  const { username, phone, email, password } = req.body;

  if (!username || !phone || !email || !password)
    return res.json({ status: false, message: 'All fields required' });

  if (!/^[A-Za-z0-9._\-]+$/.test(username))
    return res.json({ status: false, message: 'Invalid username' });

  if (password.length < 6)
    return res.json({ status: false, message: 'Password too short' });

  try {
    const { data: users } = await axios.get('https://database-benbot.onrender.com/api/users');

    if (users.find(u => u.username === username))
      return res.json({ status: false, message: 'Username exists' });

    const newUser = {
      username,
      phone,
      email,
      password,
      coins: 0,
      lastCoinAdd: null
    };

    await axios.post('https://database-benbot.onrender.com/api/users', newUser);
    res.json({ status: true, message: 'Signup successful' });
  } catch {
    res.json({ status: false, message: 'Server error' });
  }
});

// اضافه کردن سکه

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const { data: user } = await axios.get(`https://database-benbot.onrender.com/api/users/${username}`);

    if (!user || user.password !== password)
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
  } catch {
    res.json({ status: false, message: 'Server error' });
  }
});

app.post('/api/delete-bot', async (req, res) => {
  const { appName, username } = req.body;

  if (!appName || !username) {
    return res.status(400).json({ status: false, message: 'Missing appName or username' });
  }

  try {
    // گرفتن همه ربات‌ها از دیتابیس آنلاین
    const { data: bots } = await axios.get('https://database-benbot.onrender.com/api/bots');

    // فیلتر ربات مورد نظر برای حذف
    const updatedBots = bots.filter(b => !(b.name === appName && b.byUser === username));

    if (updatedBots.length === bots.length) {
      return res.status(404).json({ status: false, message: 'Bot not found or unauthorized' });
    }

    // حذف اپ در Heroku
    await axios.delete(`https://api.heroku.com/apps/${appName}`, {
      headers: herokuHeaders
    });

    // آپدیت ربات‌ها در دیتابیس آنلاین
    await axios.put('https://database-benbot.onrender.com/api/bots', updatedBots);

    res.json({ status: true, message: 'App deleted successfully' });

  } catch (err) {
    console.error('❌ Delete Error:', err.response?.data || err.message);
    res.status(500).json({ status: false, message: 'Delete failed', error: err.message });
  }
});



app.post('/api/add-coins', async (req, res) => {
  const { username } = req.body;
  if (!username) return res.json({ status: false, message: 'Username is required' });

  try {
    const { data: user } = await axios.get(`https://database-benbot.onrender.com/api/users/${username}`);

    if (!user) return res.json({ status: false, message: 'User not found' });

    // اگر قبلاً سکه‌ای نگرفته بود
    if (!user.lastCoinAdd) {
      user.coins = 10;
      user.lastCoinAdd = new Date().toISOString();
      await axios.put(`https://database-benbot.onrender.com/api/users/${username}`, {
        coins: user.coins,
        lastCoinAdd: user.lastCoinAdd
      });
      return res.json({ status: true, message: '10 coins added to your account!', coins: user.coins });
    }

    const lastAddTime = new Date(user.lastCoinAdd);
    const now = new Date();
    const diffMs = now - lastAddTime;

    if (diffMs < 24 * 60 * 60 * 1000) {
      const secondsRemaining = Math.floor((24 * 3600 * 1000 - diffMs) / 1000);
      const h = Math.floor(secondsRemaining / 3600);
      const m = Math.floor((secondsRemaining % 3600) / 60);
      const s = secondsRemaining % 60;
      return res.json({ status: false, message: `Wait: ${h}h ${m}m ${s}s` });
    }

    // اگر ۲۴ ساعت گذشته باشد
    user.coins += 10;
    user.lastCoinAdd = now.toISOString();

    await axios.put(`https://database-benbot.onrender.com/api/users/${username}`, {
      coins: user.coins,
      lastCoinAdd: user.lastCoinAdd
    });

    res.json({ status: true, message: '10 coins added', coins: user.coins });
  } catch (err) {
    res.json({ status: false, message: 'Server error' });
  }
});

app.get('/api/coins/:username', async (req, res) => {
  const username = req.params.username;

  try {
    const { data: user } = await axios.get(`https://database-benbot.onrender.com/api/users/${username}`);

    if (!user)
      return res.json({ status: false, message: 'User not found' });

    res.json({ status: true, coins: user.coins });
  } catch (error) {
    res.json({ status: false, message: 'Server error' });
  }
});
app.get('/api/heroku-logs/:appName', async (req, res) => {
  const appName = req.params.appName;
  if (!appName) return res.status(400).json({ status: false, message: 'App name is required' });

  try {
    // مرحله اول: ارسال درخواست ایجاد سشن لاگ
    const result = await axios.post(
      `https://api.heroku.com/apps/${appName}/log-sessions`,
      {
        dyno: 'web',
        lines: 100,
        source: 'app',
        tail: false
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.HEROKU_API_KEY}`,
          Accept: 'application/vnd.heroku+json; version=3',
          'Content-Type': 'application/json'
        }
      }
    );

    if (!result.data?.logplex_url) {
      console.error("❌ No logplex URL returned");
      return res.status(500).json({ status: false, message: 'No log URL returned from Heroku' });
    }

    const logsResponse = await axios.get(result.data.logplex_url);
    res.json({ status: true, logs: logsResponse.data });

  } catch (err) {
    console.error('❌ Error in fetching logs from Heroku:');
    if (err.response) {
      console.error("Status:", err.response.status);
      console.error("Data:", err.response.data);
      console.error("Headers:", err.response.headers);
      return res.status(500).json({
        status: false,
        message: 'Failed to fetch logs',
        error: {
          status: err.response.status,
          data: err.response.data
        }
      });
    } else {
      console.error("Error Message:", err.message);
      return res.status(500).json({
        status: false,
        message: 'Log fetch failed',
        error: err.message
      });
    }
  }
});


app.post('/api/add-bot-repo', async (req, res) => {
  try {
    let { name, repoUrl, docs, byUser } = req.body;

    if (!name || !repoUrl) {
      return res.status(400).json({ status: false, message: '❌ Name and Repo URL are required.' });
    }

    if (!repoUrl.startsWith('https://github.com/')) {
      return res.status(400).json({ status: false, message: '❌ Repo URL must be from GitHub.' });
    }

    // تبدیل URL به tarball/main اگر لازم باشد
    if (!repoUrl.endsWith('/tarball/main')) {
      repoUrl = repoUrl.replace(/\/+$/, '') + '/tarball/main';
    }

    // گرفتن رپوهای موجود از دیتابیس آنلاین
    const { data: bots } = await axios.get('https://database-benbot.onrender.com/api/botrepos');

    if (bots.find(b => b.name.toLowerCase() === name.toLowerCase())) {
      return res.json({ status: false, message: '❌ Bot name already exists.' });
    }

    // اضافه کردن رپو جدید
    bots.push({
      name,
      repoUrl,
      docs: docs || '',
      status: 'pending',
      byUser: byUser || 'unknown'
    });

    // آپدیت دیتابیس آنلاین با لیست جدید
    await axios.put('https://database-benbot.onrender.com/api/botrepos', bots);

    res.json({ status: true, message: '✅ Bot submitted for approval.' });

  } catch (err) {
    console.error('❌ Error adding bot repo:', err.message);
    res.status(500).json({ status: false, message: 'Server error' });
  }
});


app.get('/api/bot-repos', async (req, res) => {
  try {
    const { data: bots } = await axios.get('https://database-benbot.onrender.com/api/botrepos');
    const approvedBots = bots.filter(b => b.status === 'approved');
    res.json(approvedBots);
  } catch (err) {
    console.error('❌ Error fetching approved bot repos:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/api/bot-repos', async (req, res) => {
  try {
    const { data: bots } = await axios.get('https://database-benbot.onrender.com/api/botrepos');
    res.json(bots);
  } catch (err) {
    console.error('❌ Error fetching all bot repos:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});



app.post('/deploy', async (req, res) => {
  const { sessionId, appName, username, repoUrl } = req.body;

  if (!sessionId || !repoUrl || !username)
    return res.status(400).json({ error: 'Session ID, repoUrl, and username are required' });

  const generatedAppName = appName?.trim()
    ? appName.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-')
    : `benbot-${uuidv4().slice(0, 6)}`;

  try {
    // 👤 دریافت و بررسی اطلاعات کاربر از دیتابیس آنلاین
    const { data: user } = await axios.get(`https://database-benbot.onrender.com/api/users/${username}`);
    if (!user)
      return res.status(404).json({ error: 'User not found' });

    if (user.coins < 10)
      return res.status(403).json({ error: 'Not enough coins to deploy a bot' });

    // 💰 کم کردن 10 سکه از کاربر
    await axios.put(`https://database-benbot.onrender.com/api/users/${username}`, {
      ...user,
      coins: user.coins - 10
    });

    // ✅ بررسی تعداد ربات‌ها از دیتابیس آنلاین
    const { data: bots } = await axios.get(`https://database-benbot.onrender.com/api/bots`);
    if (bots.length >= 100) {
      return res.status(403).json({
        error: 'Server limit reached',
        message: '💥 All server busy bots no allowed. Try again later.'
      });
    }

    // 🛠 ایجاد اپ در Heroku
    await axios.post('https://api.heroku.com/apps', { name: generatedAppName }, { headers: herokuHeaders });

    await axios.patch(`https://api.heroku.com/apps/${generatedAppName}/config-vars`, {
      SESSION_ID: sessionId
    }, { headers: herokuHeaders });

    await axios.post(`https://api.heroku.com/apps/${generatedAppName}/builds`, {
      source_blob: { url: repoUrl }
    }, { headers: herokuHeaders });

    // 📦 ذخیره اطلاعات ربات در دیتابیس آنلاین
    const newBot = {
      name: generatedAppName,
      byUser: username,
      date: new Date().toISOString(),
      session: sessionId,
      status: 'Deploying',
      repo: repoUrl
    };

    await axios.post(`https://database-benbot.onrender.com/api/bots`, newBot);

    // 🕒 آپدیت وضعیت ربات به Active بعد از ۲ دقیقه
    setTimeout(async () => {
      try {
        await axios.put(`https://database-benbot.onrender.com/api/bots/${generatedAppName}`, {
          ...newBot,
          status: 'Active'
        });
        console.log(`✅ Bot ${generatedAppName} status updated to Active`);
      } catch (err) {
        console.error(`❌ Failed to update bot status: ${err.message}`);
      }
    }, 2 * 60 * 1000);

    // ✅ پاسخ نهایی
    res.json({ appUrl: `https://${generatedAppName}.herokuapp.com` });

  } catch (err) {
    console.error('❌ Deployment error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Deployment failed', details: err.response?.data || err.message });
  }
});


app.post('/api/user-bots', async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username is required' });

  try {
    const { data: bots } = await axios.get('https://database-benbot.onrender.com/api/bots');
    const userBots = bots.filter(bot => bot.byUser === username);
    res.json(userBots);
  } catch (err) {
    console.error('Error fetching user bots:', err.message);
    res.status(500).json({ error: 'Server error fetching user bots' });
  }
});

app.post('/api/admin/add-coins', async (req, res) => {
  const { username, amount } = req.body;

  if (!username || typeof amount !== 'number') {
    return res.status(400).json({ status: false, message: 'Invalid input' });
  }

  try {
    // دریافت کاربر
    const { data: user } = await axios.get(`https://database-benbot.onrender.com/api/users/${username}`);
    if (!user) return res.json({ status: false, message: 'User not found' });

    // افزایش سکه و ذخیره
    await axios.put(`https://database-benbot.onrender.com/api/users/${username}`, {
      ...user,
      coins: user.coins + amount
    });

    res.json({ status: true, message: `Added ${amount} coins to ${username}` });

  } catch (err) {
    console.error('❌ Error in add-coins:', err.message);
    res.status(500).json({ status: false, message: 'Server error' });
  }
});


app.get('/api/admin/all-bots', async (req, res) => {
  try {
    const { data: bots } = await axios.get('https://database-benbot.onrender.com/api/bots');
    res.json(bots);
  } catch (err) {
    console.error('Error fetching all bots:', err.message);
    res.status(500).json({ error: 'Server error fetching bots' });
  }
});


// <!-- ✅ Bot Approval Management & File Tools Backend -->

app.post('/api/admin/add-main-bot', async (req, res) => {
  const { name, repoUrl, docs } = req.body;
  if (!name || !repoUrl) 
    return res.status(400).json({ status: false, message: 'Missing name or repoUrl' });

  try {
    // گرفتن همه ربات‌ها
    const { data: bots } = await axios.get('https://database-benbot.onrender.com/api/botrepos');

    if (bots.find(b => b.name === name)) 
      return res.json({ status: false, message: 'Bot name exists' });

    // اضافه کردن ربات جدید
    bots.push({
      name,
      repoUrl,
      docs: docs || '',
      status: 'approved',
      byUser: 'admin'
    });

    // ذخیره دوباره در دیتابیس آنلاین
    await axios.put('https://database-benbot.onrender.com/api/botrepos', bots);

    res.json({ status: true, message: 'Main bot added and approved.' });

  } catch (err) {
    console.error('Error adding main bot:', err.message);
    res.status(500).json({ status: false, message: 'Server error' });
  }
});

// دریافت همه ربات‌ها برای پنل ادمین
app.get('/api/admin/botrepos', async (req, res) => {
  try {
    const { data: bots } = await axios.get('https://database-benbot.onrender.com/api/botrepos');
    res.json(bots);
  } catch (err) {
    console.error('Error fetching bot repos:', err.message);
    res.status(500).json({ status: false, message: 'Server error' });
  }
});
// تایید ربات توسط ادمین

app.post('/api/admin/approve-bot-repo', async (req, res) => {
  const { index } = req.body;
  try {
    const { data: bots } = await axios.get('https://database-benbot.onrender.com/api/botrepos');

    if (typeof index !== 'number' || index < 0 || index >= bots.length) {
      return res.json({ status: false, message: 'Invalid index' });
    }

    bots[index].status = 'approved';

    await axios.put('https://database-benbot.onrender.com/api/botrepos', bots);
    res.json({ status: true, message: 'Bot approved.' });
  } catch (err) {
    console.error('Approve bot repo error:', err.message);
    res.status(500).json({ status: false, message: 'Server error' });
  }
});

app.post('/api/admin/edit-bot-repo', async (req, res) => {
  const { index, name, repoUrl, docs } = req.body;
  try {
    const { data: bots } = await axios.get('https://database-benbot.onrender.com/api/botrepos');

    if (typeof index !== 'number' || index < 0 || index >= bots.length) {
      return res.json({ status: false, message: 'Invalid index' });
    }

    if (name) bots[index].name = name;
    if (repoUrl) bots[index].repoUrl = repoUrl;
    if (docs) bots[index].docs = docs;

    await axios.put('https://database-benbot.onrender.com/api/botrepos', bots);
    res.json({ status: true, message: 'Repo updated.' });
  } catch (err) {
    console.error('Edit bot repo error:', err.message);
    res.status(500).json({ status: false, message: 'Server error' });
  }
});

app.post('/api/admin/delete-bot-repo', async (req, res) => {
  const { index } = req.body;
  try {
    const { data: bots } = await axios.get('https://database-benbot.onrender.com/api/botrepos');

    if (typeof index !== 'number' || index < 0 || index >= bots.length) {
      return res.json({ status: false, message: 'Invalid index' });
    }

    bots.splice(index, 1);

    await axios.put('https://database-benbot.onrender.com/api/botrepos', bots);
    res.json({ status: true, message: 'Repo deleted.' });
  } catch (err) {
    console.error('Delete bot repo error:', err.message);
    res.status(500).json({ status: false, message: 'Server error' });
  }
});

// جزئیات فایل همراه با مشاهده/ویرایش/حذف
app.get('/api/admin/file-content/:name', (req, res) => {
  const name = req.params.name;
  const fullPath = path.join(__dirname, name);
  if (!fs.existsSync(fullPath)) return res.status(404).json({ status: false, message: 'File not found' });
  const content = fs.readFileSync(fullPath, 'utf8');
  res.json({ status: true, content });
});

app.post('/api/admin/save-file', (req, res) => {
  const { name, content } = req.body;
  const fullPath = path.join(__dirname, name);
  if (!fs.existsSync(fullPath)) return res.status(404).json({ status: false, message: 'File not found' });
  fs.writeFileSync(fullPath, content, 'utf8');
  res.json({ status: true, message: 'File saved.' });
});


app.get('/api/admin/all-users', async (req, res) => {
  try {
    const { data: users } = await axios.get('https://database-benbot.onrender.com/api/users');

    // حذف رمز عبور از هر کاربر
    const usersWithoutPasswords = users.map(({ password, ...rest }) => rest);

    res.json(usersWithoutPasswords);
  } catch (err) {
    console.error('❌ Error fetching all users:', err.message);
    res.status(500).json({ status: false, message: 'Server error while fetching users' });
  }
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

  console.log(`🔄 Redeploy called for appName: ${appName}, repoUrl: ${repoUrl}`);

  if (!appName || !repoUrl) {
    console.warn("⚠️ Missing input: appName or repoUrl");
    return res.status(400).json({ status: false, message: "Missing app name or repo URL" });
  }

  try {
    console.log(`📤 Sending build request to Heroku for ${appName}`);

    const herokuResponse = await axios.post(
      `https://api.heroku.com/apps/${appName}/builds`,
      { source_blob: { url: repoUrl } },
      { headers: herokuHeaders }
    );

    console.log(`✅ Build request sent successfully for ${appName}`);
    console.log(`🔗 Heroku Build ID: ${herokuResponse.data.id || "unknown"}`);
    console.log(`📦 Build Status: ${herokuResponse.status}`);

    res.json({
      status: true,
      message: `Redeploy started for ${appName}`,
      appUrl: `https://${appName}.herokuapp.com`
    });

  } catch (err) {
    console.error("❌ Error during redeploy process:");

    if (err.response) {
      console.error("📛 Status:", err.response.status);
      console.error("📄 Data:", err.response.data);
      console.error("📬 Headers:", err.response.headers);
      return res.status(500).json({
        status: false,
        message: err.response.data.message || "Redeploy failed",
        debug: {
          status: err.response.status,
          heroku: err.response.data
        }
      });
    } else {
      console.error("📉 Error Message:", err.message);
      return res.status(500).json({
        status: false,
        message: "Unknown error occurred during redeploy",
        debug: {
          message: err.message
        }
      });
    }
  }
});

const ROOT_DIR = __dirname;

// GET file content
app.get('/files/geting/:filepath(*)', (req, res) => {
  let filepath = req.params.filepath;
  if (!filepath.includes('.')) filepath = path.join(filepath, 'index.js');
  const fullPath = path.join(ROOT_DIR, filepath);

  fs.readFile(fullPath, 'utf8', (err, data) => {
    if (err) return res.status(404).send('File not found');
    res.type('text/plain').send(data);
  });
});

// POST save file content
app.post('/files/geting/:filepath(*)', (req, res) => {
  let filepath = req.params.filepath;
  if (!filepath.includes('.')) filepath = path.join(filepath, 'index.js');
  const fullPath = path.join(ROOT_DIR, filepath);
  const newContent = req.body;

  fs.writeFile(fullPath, newContent, 'utf8', (err) => {
    if (err) return res.status(500).send('Failed to save file');
    res.send('File saved successfully');
  });
});

// نمایش اطلاعات یک کاربر خاص
app.get('/api/admin/user/:username', async (req, res) => {
  const { username } = req.params;

  try {
    const { data: users } = await axios.get('https://database-benbot.onrender.com/api/users');
    const user = users.find(u => u.username === username);

    if (!user) {
      return res.status(404).json({ status: false, message: 'User not found' });
    }

    const { password, ...safeUser } = user;
    res.json({ status: true, user: safeUser });

  } catch (err) {
    console.error('❌ Error fetching user:', err.message);
    res.status(500).json({ status: false, message: 'Server error while fetching user' });
  }
});

// حذف کاربر
app.post('/api/admin/delete-user', async (req, res) => {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ status: false, message: 'Username is required' });
  }

  try {
    const { data: users } = await axios.get('https://database-benbot.onrender.com/api/users');
    const user = users.find(u => u.username === username);

    if (!user) {
      return res.json({ status: false, message: 'User not found' });
    }

    // ارسال درخواست حذف
    await axios.delete(`https://database-benbot.onrender.com/api/users/${user._id}`);

    res.json({ status: true, message: `User ${username} deleted.` });

  } catch (err) {
    console.error('❌ Delete user error:', err.message);
    res.status(500).json({ status: false, message: 'Server error while deleting user' });
  }
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


app.post('/api/admin/remove-coins', async (req, res) => {
  const { username, amount } = req.body;

  if (!username || typeof amount !== 'number') {
    return res.status(400).json({ status: false, message: 'Invalid input' });
  }

  try {
    // گرفتن کاربر از API ریموت
    const userRes = await axios.get(`https://database-benbot.onrender.com/api/users/${username}`);
    const user = userRes.data;

    if (user.coins === undefined || user.coins < amount) {
      return res.json({ status: false, message: 'User does not have enough coins' });
    }

    // کم کردن کوین‌ها
    const updatedUser = { ...user, coins: user.coins - amount };

    // آپدیت کاربر
    await axios.put(`https://database-benbot.onrender.com/api/users/${username}`, updatedUser);

    res.json({ status: true, message: `Removed ${amount} coins from ${username}` });
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return res.json({ status: false, message: 'User not found' });
    }
    console.error(error);
    res.status(500).json({ status: false, message: 'Server error' });
  }
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