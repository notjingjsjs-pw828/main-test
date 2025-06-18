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