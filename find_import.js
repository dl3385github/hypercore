const fs = require("fs");
fs.readFile("/Users/donlee/Desktop/hypercore/src/renderer/app.js", "utf8", (err, data) => {
  if (err) { console.error("Error reading file:", err); return; }
  const lines = data.split("\\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("import") && lines[i].includes("FriendsPage")) {
      console.log(`Line ${i+1}: ${lines[i]}`);
    }
  }
});
