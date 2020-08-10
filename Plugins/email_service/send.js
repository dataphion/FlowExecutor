const Fs = require("fs");
const Path = require("path");
const Util = require("util");
const Puppeteer = require("puppeteer");
const Handlebars = require("handlebars");
const ReadFile = Util.promisify(Fs.readFile);

async function html(template_path, template_data) {
  try {
    const templatePath = Path.resolve(template_path);
    const content = await ReadFile(templatePath, "utf8");

    // compile and render the template with handlebars
    const template = Handlebars.compile(content);
    return template(template_data);
  } catch (error) {
    throw new Error("Cannot create invoice HTML template.");
  }
}

const getPdf = async function(template_path, template_data) {
  const html1 = await html(template_path, template_data);

  const browser = await Puppeteer.launch({headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox']});
  const page = await browser.newPage();
  await page.setContent(html1);

  let pdf = await page.pdf();
  let base64data = pdf.toString("base64");
  return base64data;
};

const rawdata = {
  getPdf: getPdf
};

module.exports = rawdata;
