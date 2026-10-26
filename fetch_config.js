import { exec } from 'child_process';
import fs from 'fs';

exec('npx firebase apps:sdkconfig web --json', (error, stdout) => {
    if (error) {
        console.error(`exec error: ${error}`);
        return;
    }

    try {
        // Find the JSON object in stdout (it might have "Downloading..." text before it)
        const jsonStart = stdout.indexOf('{');
        const jsonEnd = stdout.lastIndexOf('}') + 1;
        if (jsonStart !== -1 && jsonEnd !== -1) {
            const jsonStr = stdout.substring(jsonStart, jsonEnd);
            const config = JSON.parse(jsonStr);

            // Write to a clean file
            fs.writeFileSync('firebase_creds.json', JSON.stringify(config, null, 2));
            console.log("Config saved to firebase_creds.json");
        } else {
            console.log("Could not find JSON in output:", stdout);
        }

    } catch (e) {
        console.error("Parse error:", e);
    }
});
