const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const HEROKU_API_KEY = "HRKU-AApVXwrdIydFr-9LZ1Wft5VZaZudD7TFylO8L8DOCpbQ_____w_ZDWksMubW";
const GITHUB_REPO_ZIP = 'https://github.com/YourUsername/your-repo/archive/refs/heads/main.zip';

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
// حذف این خط:
// app.use(express.static('public'));

// اضافه کن این رو:
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
    // Step 1: Download GitHub repo as ZIP
    const writer = fs.createWriteStream(zipPath);
    const response = await axios({ url: GITHUB_REPO_ZIP, method: 'GET', responseType: 'stream' });
    response.data.pipe(writer);
    await new Promise((resolve) => writer.on('finish', resolve));

    // Step 2: Unzip
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(extractPath, true);
    fs.unlinkSync(zipPath);
    const innerFolder = fs.readdirSync(extractPath)[0];
    const finalPath = path.join(extractPath, innerFolder);

    // Step 3: Modify .env file and update SESSION_ID
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

    // Step 4: Create Heroku app using Platform API
    await axios.post(
      'https://api.heroku.com/apps',
      { name: appName },
      {
        headers: {
          Authorization: `Bearer ${HEROKU_API_KEY}`,
          Accept: 'application/vnd.heroku+json; version=3',
          'Content-Type': 'application/json'
        }
      }
    );

    // Step 5: Initialize git repo and push to Heroku
    execSync(`cd ${finalPath} && git init`);
    execSync(`cd ${finalPath} && heroku git:remote -a ${appName}`);
    execSync(`cd ${finalPath} && git add . && git commit -m "Initial deploy"`);
    execSync(`cd ${finalPath} && git push heroku master -f`);

    res.send(`✅ App deployed successfully: <a href="https://${appName}.herokuapp.com" target="_blank">${appName}.herokuapp.com</a>`);
  } catch (err) {
    console.error(err);
    res.send('❌ Deployment failed: ' + err.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});