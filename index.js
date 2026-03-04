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

  return Promise.all(
    CONFIG.GCS_JSON_FILES.map(filename => {
      const url = `${CONFIG.GCS_BASE_URL}/${filename}`;
      console.log(`Fetching ${url}...`);
      return fetchJson(url);
    })
  )
  .then((results) => {
    const merged = results.reduce((acc, data) => {
      return acc.concat(Array.isArray(data) ? data : (data.conversations || []));
    }, []);

    console.log(`Fetched ${merged.length} conversations total.`);

    const path = "./res/conversations.json";
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