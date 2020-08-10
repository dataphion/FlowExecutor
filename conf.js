// const hostname = process.env.PROTRACTOR_HOST || "http://13.71.116.82:10001/wd/hub";
const hostname = process.env.PROTRACTOR_HOST;
// const hostname = process.env.PROTRACTOR_HOST || "http://localhost:4444/wd/hub";
const browser_name = process.env.BROWSER_NAME || "chrome";
console.log("hostname", hostname)
exports.config = {
	seleniumAddress: hostname,

  specs: ["spec.js"],
  multiCapabilities: [{ browserName: browser_name }],
  onPrepare: function() {
    browser.ignoreSynchronization = true;
    // browser.manage().window().setSize(1600, 1000);
  },
  jasmineNodeOpts: {
    defaultTimeoutInterval: 6000000000,
    allScriptsTimeout: 6000000
  }
};
