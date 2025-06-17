const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const HEROKU_API_KEY = 'HRKU-AApVXwrdIydFr-9LZ1Wft5VZaZudD7TFylO8L8DOCpbQ_____w_ZDWksMubW'; // کلید هروکو
const GITHUB_REPO_ZIP = 'https://github.com/NOTHING-MD420/project-test/archive/refs/heads/main.zip';

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

function generateAppName() {
  return 'bot-' + crypto.randomBytes(3).toString('hex');
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

app.post('/deploy', async (req, res) => {
  const appName = req.body.appName || generateAppName();
  const sessionId = req.body.sessionId;
  const zipPath = path.join(__dirname, `${appName}.zip`);
  const extractPath = path.join(__dirname, appName);

  try {
    // 1. دانلود ZIP پروژه از گیت‌هاب
    const writer = fs.createWriteStream(zipPath);
    const response = await axios({
      url: GITHUB_REPO_ZIP,
      method: 'GET',
      responseType: 'stream'
    });
    response.data.pipe(writer);
    await new Promise(resolve => writer.on('finish', resolve));

    // 2. باز کردن ZIP و تغییر sessionId در فایل .env
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(extractPath, true);
    fs.unlinkSync(zipPath);
    const innerFolder = fs.readdirSync(extractPath)[0];
    const finalPath = path.join(extractPath, innerFolder);

    // خواندن یا ایجاد .env
    const envFile = path.join(finalPath, '.env');
    let envContent = '';
    if (fs.existsSync(envFile)) {
      envContent = fs.readFileSync(envFile, 'utf8');
    }
    if (envContent.includes('SESSION_ID=')) {
      envContent = envContent.replace(/SESSION_ID=.*/g, `SESSION_ID=${sessionId}`);
    } else {
      envContent += `\nSESSION_ID=${sessionId}\n`;
    }
    fs.writeFileSync(envFile, envContent);

    // 3. ساخت ZIP جدید با تغییرات
    const newZip = new AdmZip();
    const addFolderToZip = (folderPath, zipFolder) => {
      const items = fs.readdirSync(folderPath);
      items.forEach(item => {
        const fullPath = path.join(folderPath, item);
        const stats = fs.statSync(fullPath);
        if (stats.isDirectory()) {
          const childZipFolder = zipFolder.addFolder(item);
          addFolderToZip(fullPath, childZipFolder);
        } else {
          zipFolder.addFile(item, fs.readFileSync(fullPath));
        }
      });
    };
    addFolderToZip(finalPath, newZip);
    const newZipBuffer = newZip.toBuffer();

    // 4. درخواست ساخت اپ در هروکو
    await axios.post('https://api.heroku.com/apps', { name: appName }, {
      headers: {
        Authorization: `Bearer ${HEROKU_API_KEY}`,
        Accept: 'application/vnd.heroku+json; version=3',
        'Content-Type': 'application/json'
      }
    });

    // 5. گرفتن source upload URL از Heroku Source API
    const sourceResponse = await axios.post('https://api.heroku.com/apps/' + appName + '/sources', {}, {
      headers: {
        Authorization: `Bearer ${HEROKU_API_KEY}`,
        Accept: 'application/vnd.heroku+json; version=3',
      }
    });

    const { source_blob } = sourceResponse.data;

    // 6. آپلود ZIP به URL ارائه شده
    await axios.put(source_blob.put_url, newZipBuffer, {
      headers: {
        'Content-Type': '',
        'Content-Length': newZipBuffer.length
      }
    });

    // 7. ساخت release (deploy)
    await axios.post(`https://api.heroku.com/apps/${appName}/builds`, {
      source_blob: {
        url: source_blob.get_url
      }
    }, {
      headers: {
        Authorization: `Bearer ${HEROKU_API_KEY}`,
        Accept: 'application/vnd.heroku+json; version=3',
        'Content-Type': 'application/json'
      }
    });

    // کمی صبر برای ساخت اپ (اختیاری)
    await delay(15000);

    // پاک کردن فایل‌های موقت
    fs.rmSync(extractPath, { recursive: true, force: true });

    res.send(`✅ App deployed successfully: <a href="https://${appName}.herokuapp.com" target="_blank">${appName}.herokuapp.com</a>`);
  } catch (err) {
    console.error(err.response?.data || err.message || err);
    res.send('❌ Deployment failed: ' + (err.response?.data?.message || err.message || 'Unknown error'));
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});