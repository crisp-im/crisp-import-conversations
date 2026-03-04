var CONFIG     = require("./config");
var CrispImport = require("./lib/import");
var https      = require("https");
var fs         = require("fs");

var Import = new CrispImport(
  {
    websiteId               : CONFIG.WEBSITE_ID,
    websitePlan             : CONFIG.WEBSITE_PLAN,
    urn                     : CONFIG.PLUGIN_URN,
    name                    : CONFIG.PLUGIN_NAME,
    identifier              : CONFIG.PLUGIN_TOKEN_IDENTIFIER,
    key                     : CONFIG.PLUGIN_TOKEN_KEY,
    defaultUserEmail        : CONFIG.DEFAULT_USER_EMAIL,
    defaultUserNickname     : CONFIG.DEFAULT_USER_NICKNAME,
    defaultOperatorNickname : CONFIG.DEFAULT_OPERATOR_NICKNAME
  },
  {
    adapter    : "intercom",
    resume     : false,
    gcsBaseUrl : CONFIG.GCS_BASE_URL
  }
);

var fetchJson = (url) => {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        res.resume();
        return;
      }
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch(e) {
          reject(new Error(`Failed to parse JSON from ${url}: ${e.message}`));
        }
      });
    }).on("error", reject);
  });
};

var fetchAndMerge = () => {
  console.log("Fetching conversations from GCS...");
  if (!CONFIG.GCS_JSON_FILES || CONFIG.GCS_JSON_FILES.filter(f => f).length === 0) {
    return Promise.reject(new Error("GCS_JSON_FILES is required in config.json"));
  }
  if (!CONFIG.GCS_BASE_URL) {
    return Promise.reject(new Error("GCS_BASE_URL is required in config.json"));
  }
  const baseUrl = CONFIG.GCS_BASE_URL.replace(/\/+$/, '');
  const validFiles = CONFIG.GCS_JSON_FILES.filter(f => f);
  return Promise.all(
    validFiles.map(filename => {
      const url = `${baseUrl}/${encodeURIComponent(filename)}`;
      return fetchJson(url);
    })
  )
  .then((results) => {
    const merged = results.reduce((acc, data) => {
      let conversations;
      if (Array.isArray(data)) {
        conversations = data;
      } else if (data.conversations) {
        conversations = data.conversations;
      } else {
        console.warn(`⚠️  Unexpected format in ${filename}, skipping`);
        conversations = [];
      }
      return acc.concat(conversations);
    }, []);

    console.log(`Fetched ${merged.length} conversations total.`);

    const path = "./res/conversations.json";
    fs.mkdirSync("./res", { recursive: true });
    fs.writeFileSync(path, JSON.stringify(merged, null, 2));

    return path;
  });
};

fetchAndMerge()
  .then((path) => {
    return Import.importFromFile(path);
  })
  .then((result) => {
    console.log(`Import is done. ${result.count} conversations imported.`);
  })
  .catch((error) => {
    console.log("Import failed.");
    console.log(error);
  });