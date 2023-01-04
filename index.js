var CONFIG = require("./config");
var CrispImport = require("./lib/import");

var Import = new CrispImport({
  websiteId: CONFIG.WEBSITE_ID,
  urn: CONFIG.PLUGIN_URN,
  name: CONFIG.PLUGIN_NAME,
  identifier: CONFIG.PLUGIN_TOKEN_IDENTIFIER,
  key: CONFIG.PLUGIN_TOKEN_KEY,
  defaultEmail: CONFIG.DEFAULT_EMAIL
});

Import.importFromFile("./res/conversations.json")
  .then((result) => {
    console.log(`Import is done. ${result.count} conversations imported.`)
  })
  .catch((error) => {
    console.log("Import failed.");
    console.log(error);
  });
