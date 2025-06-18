const express = require('express');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const axios = require('axios');
const crypto = require('crypto');
const bodyParser = require('body-parser');

const HEROKU_API_KEY = 'HRKU-AApVXwrdIydFr-9LZ1Wft5VZaZudD7TFylO8L8DOCpbQ_____w_ZDWksMubW';

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));

function generateAppName() {
  return 'bot-' + crypto.randomBytes(3).toString('hex');
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/deploy', async (req, res) => {
  const appName = req.body.appName || generateAppName();
  const sessionId = req.body.sessionId;
  const botPath = path.join(__dirname, 'bot');
  const envPath = path.join(botPath, '.env');

  try {
    // ساخت یا ویرایش .env
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    if (envContent.includes('SESSION_ID=')) {
      envContent = envContent.replace(/SESSION_ID=.*/g, `SESSION_ID=${sessionId}`);
    } else {
      envContent += `\nSESSION_ID=${sessionId}`;
    }
    fs.writeFileSync(envPath, envContent);

    // ساخت ZIP از پوشه bot
    const zip = new AdmZip();
    const addFolder = (folderPath, zipFolder) => {
      const items = fs.readdirSync(folderPath);
      items.forEach(item => {
        const fullPath = path.join(folderPath, item);
        const stats = fs.statSync(fullPath);
        if (stats.isDirectory()) {
          const subFolder = zipFolder.addFolder(item);
          addFolder(fullPath, subFolder);
        } else {
          zipFolder.addFile(item, fs.readFileSync(fullPath));
        }
      });
    };
    addFolder(botPath, zip);
    const zipBuffer = zip.toBuffer();

    // ایجاد اپ جدید
    await axios.post('https://api.heroku.com/apps', { name: appName }, {
      headers: {
        Authorization: `Bearer ${HEROKU_API_KEY}`,
        Accept: 'application/vnd.heroku+json; version=3',
        'Content-Type': 'application/json',
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

    // آپلود ZIP
    await axios.put(source_blob.put_url, zipBuffer, {
      headers: {
        'Content-Type': '',
        'Content-Length': zipBuffer.length
      }
    });

    // ساخت release/build
    await axios.post(`https://api.heroku.com/apps/${appName}/builds`, {
      source_blob: { url: source_blob.get_url }
    }, {
      headers: {
        Authorization: `Bearer ${HEROKU_API_KEY}`,
        Accept: 'application/vnd.heroku+json; version=3',
        'Content-Type': 'application/json'
      }
    });

    await delay(15000); // اختیاری

    res.send(`
      <html><body style="text-align:center;font-family:sans-serif;margin-top:50px">
      ✅ App deployed successfully!<br><br>
      <a href="https://${appName}.herokuapp.com" target="_blank">${appName}.herokuapp.com</a>
      </body></html>
    `);

  } catch (err) {
    console.error(err.response?.data || err.message || err);
    res.send(`
      <html><body style="color:red;text-align:center;margin-top:50px;font-family:sans-serif">
      ❌ Deployment failed:<br><pre>${err.message}</pre>
      </body></html>
    `);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});