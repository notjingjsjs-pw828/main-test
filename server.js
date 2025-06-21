const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');
const tar = require('tar');
const axios = require('axios');
const crypto = require('crypto');
const bodyParser = require('body-parser');

const HEROKU_API_KEY = 'HRKU-AApVXwrdIydFr-9LZ1Wft5VZaZudD7TFylO8L8DOCpbQ_____w_ZDWksMubW';

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));

function generateAppName() {
  return 'bot-' + crypto.randomBytes(3).toString('hex');
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/save-session', (req, res) => {
  const sessionId = req.body.sessionId;
  const envPath = path.join(__dirname, 'bot', '.env');

  fs.readFile(envPath, 'utf8', (err, data) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Failed to read .env file');
    }

    let lines = data.split('\n');
    let found = false;

    lines = lines.map(line => {
      if (line.startsWith('SESSION_ID=')) {
        found = true;
        return `SESSION_ID=${sessionId}`;
      }
      return line;
    });

    if (!found) {
      lines.push(`SESSION_ID=${sessionId}`);
    }

    const newEnv = lines.join('\n');

    fs.writeFile(envPath, newEnv, (err) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Failed to save session ID');
      }
      res.send('Session ID saved successfully');
    });
  });
});

app.get('/logs/:app', async (req, res) => {
  const appName = req.params.app;

  try {
    // ساخت log session زنده با tail=true
    const logRes = await axios.post(`https://api.heroku.com/apps/${appName}/log-sessions`, {
      dyno: "web",
      lines: 100,
      source: "app",
      tail: true
    }, {
      headers: {
        Authorization: `Bearer ${HEROKU_API_KEY}`,
        Accept: 'application/vnd.heroku+json; version=3',
        'Content-Type': 'application/json'
      }
    });

    const logStreamURL = logRes.data.logplex_url;

    // صفحه HTML با iframe یا fetch به logplex
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <title>Live Logs - ${appName}</title>
        <style>
          body {
            background: #111;
            color: #fff;
            font-family: monospace;
            padding: 20px;
          }
          h2 { color: #0ff; }
          pre {
            background: #222;
            padding: 15px;
            border-radius: 10px;
            max-height: 90vh;
            overflow: auto;
            white-space: pre-wrap;
          }
        </style>
      </head>
      <body>
        <h2>📺 Live Logs for: ${appName}</h2>
        <pre id="logbox">Connecting to Heroku log stream...</pre>

        <script>
          const logbox = document.getElementById('logbox');
          const eventSource = new EventSource('/stream-log?url=${encodeURIComponent(logStreamURL)}');

          eventSource.onmessage = function(event) {
            logbox.textContent += '\\n' + event.data;
            logbox.scrollTop = logbox.scrollHeight;
          };
        </script>
      </body>
      </html>
    `);
  } catch (err) {
    console.error(err);
    res.status(500).send("❌ Could not get logs for this app.");
  }
});

app.post('/delete-app', async (req, res) => {
  const appName = req.body.appName;

  if (!appName) {
    return res.status(400).send('App name is required!');
  }

  try {
    await axios.delete(`https://api.heroku.com/apps/${appName}`, {
      headers: {
        Authorization: `Bearer ${HEROKU_API_KEY}`,
        Accept: 'application/vnd.heroku+json; version=3',
      }
    });

    res.send(`
      <html><body style="color:#0f0;font-family:sans-serif;text-align:center;margin-top:50px">
        ✅ App <b>${appName}</b> has been deleted successfully!
      </body></html>
    `);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).send(`
      <html><body style="color:red;text-align:center;font-family:sans-serif;margin-top:50px">
        ❌ Failed to delete app <b>${appName}</b><br>
        <pre>${err.response?.data?.message || err.message}</pre>
      </body></html>
    `);
  }
});


// مسیر مدیریت فایل‌ها
app.get('/files/*', (req, res) => {
  var targetPath = path.join(__dirname, req.path.replace('/files', ''));

  fs.stat(targetPath, (err, stats) => {
    if (err) return res.status(404).send('❌ Not found.');

    if (stats.isDirectory()) {
      fs.readdir(targetPath, (err, files) => {
        if (err) return res.status(500).send('Failed to read directory.');
        res.send(`
          <h2>📁 Directory: ${req.path}</h2>
          <ul>
            ${files.map(file => `<li><a href="${req.path}/${file}">${file}</a></li>`).join('')}
          </ul>
        `);
      });
    } else {
      fs.readFile(targetPath, 'utf8', (err, data) => {
        if (err) return res.status(500).send('Failed to read file.');
        res.send(`
          <h3>📝 Editing: ${req.path}</h3>
          <form method="POST" action="/files${req.path.replace('/files', '')}">
            <textarea name="content" rows="30" cols="100">${data.replace(/</g, '&lt;')}</textarea><br><br>
            <button type="submit">💾 Save</button>
          </form>
          <form method="POST" action="/files${req.path.replace('/files', '')}/delete" onsubmit="return confirm('Delete this file?')">
            <button type="submit" style="color:red">🗑️ Delete File</button>
          </form>
        `);
      });
    }
  });
});

// ذخیره فایل
app.post('/files/*', (req, res) => {
  var filePath = path.join(__dirname, req.path.replace('/files', ''));
  fs.writeFile(filePath, req.body.content, (err) => {
    if (err) return res.status(500).send('❌ Failed to save file.');
    res.redirect(`/files${req.path.replace('/files', '')}`);
  });
});

// حذف فایل
app.post('/files/*/delete', (req, res) => {
  var filePath = path.join(__dirname, req.path.replace('/files', '').replace('/delete', ''));
  fs.unlink(filePath, (err) => {
    if (err) return res.status(500).send('❌ Failed to delete.');
    res.send(`<h2>✅ File Deleted</h2><a href="/files">⬅️ Back</a>`);
  });
});


app.get('/stream-log', async (req, res) => {
  const logUrl = req.query.url;
  if (!logUrl) return res.status(400).send("Missing log URL");

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const https = require('https');
  https.get(logUrl, stream => {
    stream.on('data', chunk => {
      const lines = chunk.toString().split('\n');
      lines.forEach(line => {
        res.write(`data: ${line}\n\n`);
      });
    });

    stream.on('end', () => res.end());
    stream.on('error', () => res.end());
  });
});

app.post('/deploy', async (req, res) => {
  const appName = req.body.appName || generateAppName();
  const sessionId = req.body.sessionId;
  const botPath = path.join(__dirname, 'bot');

  try {
    // ساخت فایل tar.gz موقت از bot/
    const tmpTarPath = path.join(os.tmpdir(), `${appName}.tar.gz`);
    await tar.c(
      {
        gzip: true,
        file: tmpTarPath,
        cwd: botPath,
      },
      fs.readdirSync(botPath)
    );
    const tarBuffer = fs.readFileSync(tmpTarPath);

    // ساخت اپ جدید
    await axios.post('https://api.heroku.com/apps', { name: appName }, {
      headers: {
        Authorization: `Bearer ${HEROKU_API_KEY}`,
        Accept: 'application/vnd.heroku+json; version=3',
        'Content-Type': 'application/json',
      }
    });

    // ست کردن SESSION_ID در config vars
    await axios.patch(`https://api.heroku.com/apps/${appName}/config-vars`, {
      SESSION_ID: sessionId
    }, {
      headers: {
        Authorization: `Bearer ${HEROKU_API_KEY}`,
        Accept: 'application/vnd.heroku+json; version=3',
        'Content-Type': 'application/json'
      }
    });

    // گرفتن لینک آپلود سورس
    const sourceRes = await axios.post(`https://api.heroku.com/apps/${appName}/sources`, {}, {
      headers: {
        Authorization: `Bearer ${HEROKU_API_KEY}`,
        Accept: 'application/vnd.heroku+json; version=3',
      }
    });

    const { source_blob } = sourceRes.data;

    // آپلود TAR.GZ
    await axios.put(source_blob.put_url, tarBuffer, {
      headers: {
        'Content-Type': '',
        'Content-Length': tarBuffer.length
      }
    });

    // ساخت Build جدید
    const buildRes = await axios.post(`https://api.heroku.com/apps/${appName}/builds`, {
      source_blob: { url: source_blob.get_url }
    }, {
      headers: {
        Authorization: `Bearer ${HEROKU_API_KEY}`,
        Accept: 'application/vnd.heroku+json; version=3',
        'Content-Type': 'application/json'
      }
    });

    const buildId = buildRes.data.id;

    // گرفتن خروجی build logs
    const buildInfo = await axios.get(`https://api.heroku.com/apps/${appName}/builds/${buildId}`, {
      headers: {
        Authorization: `Bearer ${HEROKU_API_KEY}`,
        Accept: 'application/vnd.heroku+json; version=3',
      }
    });

    const logUrl = buildInfo.data.output_stream_url;
    const logs = await axios.get(logUrl).then(r => r.data);

    res.send(`
      <html>
      <body style="background:#111;color:#fff;padding:20px;font-family:monospace">
        <h2 style="color:#0f0">✅ App Deployed: <a style="color:#0ff" href="https://${appName}.herokuapp.com" target="_blank">${appName}.herokuapp.com</a></h2>
        <h3 style="margin-top:30px;color:#ffde59">📄 Build Logs:</h3>
        <pre style="background:#222;padding:15px;border-radius:10px;max-height:500px;overflow:auto">${logs}</pre>
      </body>
      </html>
    `);

  } catch (err) {
    console.error(err.response?.data || err.message || err);
    res.send(`
      <html>
      <body style="color:red;text-align:center;margin-top:50px;font-family:sans-serif">
        ❌ Deployment failed:<br><pre>${err.message}</pre>
      </body>
      </html>
    `);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});