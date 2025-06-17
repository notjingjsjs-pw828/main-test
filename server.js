const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const simpleGit = require('simple-git');

const HEROKU_API_KEY = "HRKU-AApVXwrdIydFr-9LZ1Wft5VZaZudD7TFylO8L8DOCpbQ_____w_ZDWksMubW";
const GITHUB_REPO_ZIP = 'https://github.com/NOTHING-MD420/project-test/archive/refs/heads/main.zip';

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

function generateAppName() {
  return 'bot-' + crypto.randomBytes(3).toString('hex');
}

app.post('/deploy', async (req, res) => {
  const appName = req.body.appName || generateAppName();
  const sessionId = req.body.sessionId;
  const zipPath = path.join(__dirname, `${appName}.zip`);
  const extractPath = path.join(__dirname, appName);

  try {
    // بررسی نصب بودن git
    const gitCheck = require('child_process').execSync('git --version').toString();
    console.log('Git version:', gitCheck);

    // دانلود ZIP
    const writer = fs.createWriteStream(zipPath);
    const response = await axios({ url: GITHUB_REPO_ZIP, method: 'GET', responseType: 'stream' });
    response.data.pipe(writer);
    await new Promise(resolve => writer.on('finish', resolve));

    // اکسترکت ZIP
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(extractPath, true);
    fs.unlinkSync(zipPath);

    // پیدا کردن پوشه اصلی
    const innerFolder = fs.readdirSync(extractPath)[0];
    const finalPath = path.join(extractPath, innerFolder);

    // ویرایش فایل .env
    const envFile = path.join(finalPath, '.env');
    let envContent = '';
    if (fs.existsSync(envFile)) {
      envContent = fs.readFileSync(envFile, 'utf8');
    }
    if (envContent.includes('SESSION_ID=')) {
      envContent = envContent.replace(/SESSION_ID=.*/g, `SESSION_ID=${sessionId}`);
    } else {
      envContent += `\nSESSION_ID=${sessionId}`;
    }
    fs.writeFileSync(envFile, envContent);

    // ساخت اپ در هروکو
    await axios.post('https://api.heroku.com/apps',
      { name: appName },
      {
        headers: {
          Authorization: `Bearer ${HEROKU_API_KEY}`,
          Accept: 'application/vnd.heroku+json; version=3',
          'Content-Type': 'application/json',
        },
      }
    );

    // deploy با git
    const git = simpleGit(finalPath);
    await git.init();
    await git.addRemote('heroku', `https://heroku:${HEROKU_API_KEY}@git.heroku.com/${appName}.git`);
    await git.add('.');
    await git.commit('Initial deploy');
    await git.push('heroku', 'master', { '--force': null });

    res.send(`✅ App deployed successfully: <a href="https://${appName}.herokuapp.com" target="_blank">${appName}.herokuapp.com</a>`);
  } catch (err) {
    console.error(err);
    res.send('❌ Deployment failed: ' + err.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});