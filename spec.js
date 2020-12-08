const { ElementFinder, NoSuchElementError } = require("protractor");
const helpers = require("./fetch-execution-details");
var dragAndDrop = require("html-dnd").code;
const axios = require("axios");
const xlsx = require("node-xlsx");
var FormData = require("form-data");

var fs = require("fs");
var http = require("http");
var path = require("path");
const strapiReq = helpers.strapiReq;
const AIMatchReq = helpers.AIMatchReq;
const beforeExecution = helpers.beforeExecution;
const beforeExecuteStep = helpers.beforeExecuteStep;
const afterExecuteStep = helpers.afterExecuteStep;
const afterExecution = helpers.afterExecution;
const FindELementReq = helpers.FindELementReq;
const AIMatchHealdata = helpers.AIMatchHealdata;
const failureUpdate = helpers.failureUpdate;
let bestMatchingData = [];
let AIMATCH = true;
var EC = protractor.ExpectedConditions;
let application_id = null;
let best_match = false;
let steps_length = null;
let DRIVEN_DATA = null;
let LOCATORS_DATA = null;
var remote = require("selenium-webdriver/remote");
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
const host = process.env.STRAPI_HOST || "http://localhost:1337";
// const host = process.env.STRAPI_HOST || "https://admin.dataphion.com";
const url = host + "/graphql";
const ch_path = __dirname;
const fetch = require("node-fetch");
let identifier = false;
let timeout = null;
// let failureImage_path = "/home/amit/Documents/aitester-dev/server-exec/executor/Image-logs/error_view.png";
// let image_path = process.env.IMG_PATH || "/home/amit/Documents/aitester-dev/server-exec/executor/image.png";
let failureImage_path =
  process.env.ERR_IMG_PATH || "/srv/executor/error_view.png";
let image_path = process.env.IMG_PATH || "/srv/executor/image.png";

let PAGINATION_XPATH = null;

describe("Test end to end session..", function () {
  let data = {};
  let ai_data = {};
  jasmine.DEFAULT_TIMEOUT_INTERVAL = 100000;
  let status = true;

  let checkelementpresent = async function (type, locator, all = false) {
    try {
      ele_present_timeout = timeout || 10000;
      if (all) {
        let element2 = await element.all(locator);
      } else {
        let count = await element.all(locator).count();
        // console.log("counting...");
        if (type !== "id") {
          if (count > 1) {
            console.log("more than one");
            return null;
          }
        }
        let element1 = await element(locator);

        let status = await browser.wait(
          EC.presenceOf(element1),
          ele_present_timeout
        );
        if (status) {
          console.log("success");
          return element1;
        } else {
          console.log("fail");
          return null;
        }
      }
      console.log("done");
    } catch (error) {
      console.log("element not present....");
      // console.log(error);
      return null;
    }
  };

  // check if element is still visible (wait till element is invisible)
  let checkElementInvisibility = async function (element, timeout) {
    try {
      let invisibility = await browser.wait(
        EC.invisibilityOf(element),
        timeout
      );
      if (invisibility) {
        console.log("element invisible");
        return true;
      } else {
        console.log("element still visible");
        return false;
      }
    } catch (error) {
      console.log("element still visible....");
      // console.log(error);
      return false;
    }
  };

  // check if element is visible (wait till element visibility)
  let checkElementVisiblilty = async function (element, timeout) {
    try {
      let visible = await browser.wait(EC.visibilityOf(element), timeout);
      if (visible) {
        console.log(" element visible");
        return true;
      } else {
        console.log("element not visible");
        return false;
      }
    } catch (error) {
      console.log("element still not visible");
      return false;
    }
  };

  let checkECconditionForMouseclick = async function (
    element,
    isclickable = true,
    isVisible = true
  ) {
    let isPresent = EC.presenceOf(element);
    // console.log("isPresent--->", isPresent);
    console.log(status);

    return status;
  };

  let checkECcondition = async function (
    element,
    isclickable = true,
    isVisible = true
  ) {
    let isPresent = EC.presenceOf(element);
    // console.log("isPresent--->", isPresent);

    // let conditionChecker = EC.and(isPresent, isVisible)
    conditional_timeout = timeout || 500;
    console.log("timeout ee------------>", ele_present_timeout);
    let status = true;
    if (isclickable) {
      let isClickable = EC.elementToBeClickable(element);
      conditionChecker = EC.and(isPresent, isClickable);
      console.log("isClickable ----->", isClickable);

      status =
        status & (await browser.wait(conditionChecker, conditional_timeout));
      console.log("clickable. --->", isClickable);
    }
    if (isVisible) {
      let isVisible = EC.visibilityOf(element);
      // console.log("isVisible ----->", isVisible);

      conditionChecker = EC.and(isPresent, isVisible);
      console.log();

      status =
        status & (await browser.wait(conditionChecker, conditional_timeout));
    }
    // status = await browser.wait(conditionChecker, 10000)
    console.log(status);

    return status;
  };

  // replace values for locators {dynamic locators value}
  let get_locators = async function (objectrepository, selector) {
    console.log("test locators----------------------------->");
    let query = {};
    let regex = /{{(.+?)}}/g; // regex for double curly braces
    let regex_match = regex.test(selector);
    if (regex_match) {
      for (let i = 0; i < LOCATORS_DATA.length; i++) {
        if (objectrepository.tag === LOCATORS_DATA[i].tag) {
          query[LOCATORS_DATA[i]["label"]] = LOCATORS_DATA[i]["value"];
        }
      }
      console.log("query----------->", query);
      // replace double braces with actual values
      let replaceDoubleBraces = async (str, result) => {
        console.log("string", str);
        console.log("result --->", result);
        return str.replace(/{{(.+?)}}/g, (_, g1) => result[g1] || g1);
      };
      let ele_selector = await replaceDoubleBraces(selector, query);
      console.log("updated selector --------------->", ele_selector);
      if (ele_selector) {
        return ele_selector;
      } else {
        return selector;
      }
    } else {
      return selector;
    }
  };

  //// get best matching identifier
  let get_best_matching_identifier = async function (
    objectrepository,
    action_type = ""
  ) {
    console.log("Finding element using selectors...");

    //----------------------- update heal component count in strapi --------------------
    const query = `{
      applications(where:{id:"${application_id}"}){
        name,
        healedcomponents{
          id,
          heal_count,
          vision_count
        }
      }
    }`;

    const healed_component = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
      }),
    });
    let get_healed_component = await healed_component.json();
    console.log("get_healed_component -->", get_healed_component);

    get_healed_component =
      get_healed_component.data.applications[0].healedcomponents[0];
    // console.log("healed component", get_healed_component);
    // update
    // console.log("update------->");
    let heal_component = {
      heal_count: get_healed_component.heal_count + 1,
    };
    await fetch(`${host}/healedcomponents/${get_healed_component.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(heal_component),
    });

    // ---------------------- updation done -------------

    best_match = true;
    // console.log("Using new identifier ---------------------->");
    bestMatchingData = [];
    let webelement;
    let ELEMENT_FOUND = false;

    // Condition for found by XPATH 1
    if (objectrepository.element_xpaths && !ELEMENT_FOUND) {
      let element_xpaths = [];
      for (let xpathh of objectrepository.element_xpaths) {
        if (xpathh.includes("svg")) {
          element_xpaths.push(xpathh.split("/svg")[0]);
        } else {
          element_xpaths.push(xpathh);
        }
      }
      console.log("Trying by XPATHS ->", element_xpaths);

      for (const xpath of element_xpaths) {
        let selector = await get_locators(objectrepository, xpath);
        webelement = await checkelementpresent("xpath", by.xpath(selector));

        if (webelement) {
          // console.log("still going inside");

          bestMatchingData.push({ selector });
          ELEMENT_FOUND = true;
          console.log("Found by XPATH ->", selector);
          break;
        }
      }

      ELEMENT_FOUND
        ? ""
        : console.log("Failed by XPATHS ->", objectrepository.element_xpaths);
    }

    // Condition for found by ID
    if (objectrepository.element_id && !ELEMENT_FOUND) {
      let selector = await get_locators(
        objectrepository,
        objectrepository.element_id
      );
      let count = await element.all(by.id(selector)).count();

      console.log("Trying by ID ->", selector);
      if (count === 1) {
        webelement = await checkelementpresent("id", by.id(selector));
        if (webelement) {
          bestMatchingData.push({ id: selector });
          ELEMENT_FOUND = true;
        } else {
          console.log("Failed by ID");
        }
      }
    }

    // Condition for found by NAME
    if (
      objectrepository.element_attributes &&
      "name" in objectrepository.element_attributes &&
      !ELEMENT_FOUND
    ) {
      console.log(
        "Trying by Name ->",
        objectrepository.element_attributes.name
      );
      let selector = await get_locators(
        objectrepository,
        objectrepository.element_attributes.name
      );
      webelement = await checkelementpresent("name", by.name(selector));
      ELEMENT_FOUND = webelement ? true : false;
      if (webelement) {
        bestMatchingData.push({
          name: selector,
        });
        ELEMENT_FOUND = true;
        console.log("found by Name");
      } else {
        console.log("failed by Name");
      }
    }

    // Condition for found by CLASS and TEXT COMBO
    if (
      objectrepository.element_css &&
      objectrepository.element_css.length > 0 &&
      !ELEMENT_FOUND
    ) {
      let element_class = objectrepository.element_css;
      let tmp_class = "." + element_class.trim().split(" ").join(".");
      console.log("Trying by Class ->", tmp_class);
      let selector = await get_locators(objectrepository, tmp_class);
      let count = await element.all(by.css(selector)).count();

      console.log("count -->", count);

      if (
        count > 1 &&
        objectrepository.value &&
        objectrepository.value.length > 0
      ) {
        console.log("cssContainingText -->", objectrepository.value);

        webelement = await checkelementpresent(
          "class",
          by.cssContainingText(selector, objectrepository.value)
        );
        if (webelement) {
          bestMatchingData.push({
            cssContainingText: [selector, objectrepository.value],
          });
          ELEMENT_FOUND = true;
          console.log("Found by Class ->", selector);
        } else {
          console.log("Failed by Class ->", selector);
        }
      } else if (count == 1) {
        webelement = await checkelementpresent("class", by.css(selector));
        if (webelement) {
          bestMatchingData.push({
            css: selector,
          });
          ELEMENT_FOUND = true;
          console.log("Found by Class ->", selector);
        } else {
          console.log("Failed by Class ->", selector);
        }
      }
    }

    // Condition for found by Text
    if (objectrepository.value && !ELEMENT_FOUND) {
      console.log("Trying by Text ->", objectrepository.value);
      let selector = await get_locators(
        objectrepository,
        objectrepository.value
      );
      webelement = await checkelementpresent(
        "text",
        by.xpath(`.//*[.="${selector}"]`)
      );
      if (webelement) {
        bestMatchingData.push({ text: selector });
        ELEMENT_FOUND = true;
        console.log("Found by Text");
      } else {
        console.log("Failed by Text");
      }
    }

    // AI Match
    // don't check for element having custom action
    if (action_type !== "custom") {
      if (!ELEMENT_FOUND && AIMATCH) {
        AIMATCH = true;
        console.log("Doing AI Matching..................");
        // ----------------- update vision used count ---------------
        let heal_component = {
          vision_count: get_healed_component.vision_count + 1,
        };
        await fetch(`${host}/healedcomponents/${get_healed_component.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(heal_component),
        });

        // ---------------upate done

        let i = parseFloat("0");
        let doc_height = Number(
          await browser.executeScript(
            "var body=document.body;html=document.documentElement;return height=Math.max(body.scrollHeight,body.offsetHeight,html.clientHeight,html.scrollHeight,html.offsetHeight);"
          )
        );
        let viewport = Number(
          await browser.executeScript("return window.innerHeight")
        );

        console.log("doc height ---> ", doc_height);
        console.log("view port ---> ", viewport);

        let threshold = doc_height / viewport;
        console.log("--->", threshold);
        console.log("count", i);

        while (i < threshold) {
          console.log(i);
          let image;
          await browser.takeScreenshot().then(async function (png) {
            console.log(typeof png);
            image = png;
          });

          var stream = fs.createWriteStream(image_path);
          stream.write(new Buffer.from(image, "base64"));
          stream.end();

          let jsonreq = {
            image: "data:image/png;base64," + image,
            id: objectrepository.id,
          };

          ai_data = await AIMatchReq(jsonreq);
          console.log("-----ai_response------");
          console.log(ai_data);

          if (ai_data.status === "success") {
            AIMATCH = false;
            // webelement = await AutoHeal(ai_data, objectrepository.id);
            let objresp = await AutoHeal(ai_data, objectrepository.id);
            webelement = await get_best_matching_identifier(objresp);
            if (webelement) {
              ELEMENT_FOUND = true;
              AIMATCH = true;
            }
            console.log("------break---------");
            break;
          } else {
            i++;
            var jss = `window.scrollTo(0,${viewport * i - 150});`;
            //js = "var ele = " + webelement + ";ele.scrollIntoView(true);";
            browser.executeScript(jss);
          }
        }
        console.log("------came out---------");
        console.log(ELEMENT_FOUND);
      }
    }

    if (!ELEMENT_FOUND) {
      console.log("Duhhhhhh!!!!!!! I am Still Learning");
      AIMATCH = false;
      return null;
    }

    return webelement;
  };

  //// get previous best match
  let get_previous_best_match = async function (strapiBestMatch) {
    console.log("Using best match");
    bestMatchingData = [];
    console.log(strapiBestMatch[0]);

    const key = Object.keys(strapiBestMatch[0])[0];

    if (key === "id") {
      bestMatchingData.push({ id: strapiBestMatch[0][key] });
      return await checkelementpresent("id", by.id(strapiBestMatch[0][key]));
    } else if (key === "name") {
      bestMatchingData.push({ name: strapiBestMatch[0][key] });
      return await checkelementpresent(
        "name",
        by.name(strapiBestMatch[0][key])
      );
    } else if (key === "css") {
      bestMatchingData.push({
        css: strapiBestMatch[0][key],
      });
      return await checkelementpresent(
        "check",
        by.css(strapiBestMatch[0][key])
      );
    } else if (key === "cssContainingText") {
      bestMatchingData.push({
        cssContainingText: [
          strapiBestMatch[0][key][0],
          strapiBestMatch[0][key][1],
        ],
      });
      return await checkelementpresent(
        "cssContainingText",
        by.cssContainingText(
          strapiBestMatch[0][key][0],
          strapiBestMatch[0][key][1]
        )
      );
    } else if (key === "xpath") {
      bestMatchingData.push({ xpath: strapiBestMatch[0][key] });
      return await checkelementpresent(
        "xpath",
        by.xpath(strapiBestMatch[0][key])
      );
    } else if (key === "text") {
      bestMatchingData.push({ text: strapiBestMatch[0][key] });
      return await checkelementpresent(
        by.xpath("text", `.//*[.="${strapiBestMatch[0][key]}"]`)
      );
    }
  };

  let send_key_downs = async function (element, key) {
    console.log("came to send_key_downs");

    switch (key[1]) {
      case "ENTER":
        element.sendKeys(protractor.Key.ENTER);
        break;
      case "ESC":
        element.sendKeys(protractor.Key.ESCAPE);
        break;
      case "TAB":
        element.sendKeys(protractor.Key.TAB);
        break;
      case "UP":
        element.sendKeys(protractor.Key.UP);
        break;
      case "DOWN":
        element.sendKeys(protractor.Key.DOWN);
        break;

      default:
        break;
    }
  };

  beforeEach(async function (done) {
    browser.setFileDetector(new remote.FileDetector());
    browser.driver.manage().window().maximize();
    let d = await strapiReq();
    console.log("d", d);

    application_id = d.data.testcases[0].application.id;

    data = d;
    done();
    console.log("Received strapi data..");

    // Data driven file
    console.log(
      "ddt file data ------------->",
      data.data.testcases[0].ddt_file
    );
    if (data.data.testcases[0].ddt_file) {
      if (data.data.testcases[0].ddt_file.ext === ".json") {
        // for json file
        let response = await fetch(
          `${host}${data.data.testcases[0].ddt_file.url}`
        );
        DRIVEN_DATA = await response.json();
      } else if (data.data.testcases[0].ddt_file.ext === ".csv") {
        // for csv file
        var request = new XMLHttpRequest();
        request.open(
          "GET",
          `${host}${data.data.testcases[0].ddt_file.url}`,
          true
        );
        request.send(null);
        request.onreadystatechange = function () {
          if (request.readyState === 4 && request.status === 200) {
            var type = request.getResponseHeader("Content-Type");
            if (type.indexOf("text") !== 1) {
              console.log(request.responseText);
              let csv = request.responseText;
              var lines = csv.split("\n");
              var result = [];
              var headers = lines[0].split(",");
              for (var i = 1; i < lines.length; i++) {
                var obj = {};
                var currentline = lines[i].split(",");
                for (var j = 0; j < headers.length; j++) {
                  let val = currentline[j].trim();
                  obj[headers[j]] = val.replace(/"/g, "");
                }
                result.push(obj);
              }
              console.log("result", result[0]);
              DRIVEN_DATA = result[0];
            }
          }
        };
      } else if (
        data.data.testcases[0].ddt_file.ext === ".xlsx" ||
        data.data.testcases[0].ddt_file.ext === ".xls"
      ) {
        // for xlsx file
        const getHeaders = (xl_data) => {
          console.log("xls data --->", xl_data);
          return new Promise((resolve, reject) => {
            try {
              console.log("trying to get the headers ...");
              const workSheetsFromBuffer = xlsx.parse(xl_data, {
                sheetRows: 2,
                cellDates: true,
                cellNF: false,
                cellText: true,
              });
              console.log("parsed the rows");
              if (workSheetsFromBuffer.length > 1) {
                console.log("found the output ... returning ...");
                resolve({
                  sheet1: {
                    header: workSheetsFromBuffer[0]["data"][0],
                    first_row: workSheetsFromBuffer[0]["data"][1],
                  },
                  sheet2: {
                    header: workSheetsFromBuffer[1]["data"][0],
                    first_row: workSheetsFromBuffer[1]["data"][1],
                  },
                });
              } else if (workSheetsFromBuffer.length === 1) {
                resolve({
                  sheet1: {
                    header: workSheetsFromBuffer[0]["data"][0],
                    first_row: workSheetsFromBuffer[0]["data"][1],
                  },
                });
              } else {
                resolve(
                  `Expected sheets: 1/2. Sheets in uploaded file: ${workSheetsFromBuffer.length}`
                );
              }
            } catch (error) {
              console.error("Error in getHeaders function");
              console.error(error);
              reject(error);
            }
          });
        };
        console.log(
          "data --->",
          `${host}${data.data.testcases[0].ddt_file.url}`
        );
        let response = await axios({
          method: "get",
          responseType: "arraybuffer",
          url: `${host}${data.data.testcases[0].ddt_file.url}`,
        });
        console.log("response data -->", response.data);
        let file_data = await getHeaders(response.data);
        // console.log(file_data);
        if (!!file_data.sheet1) {
          // input field values
          let obj = {};
          if (!!file_data.sheet1.header) {
            for (let i = 0; i < file_data.sheet1.header.length; i++) {
              obj[file_data.sheet1.header[i]] = file_data.sheet1.first_row[i];
            }
          }
          // console.log("obj", obj);
          DRIVEN_DATA = obj;
        }
        if (!!file_data.sheet2) {
          // locator variablize
          let locators = [];
          for (let i = 0; i < file_data.sheet2.header.length; i++) {
            let obj = {};

            let prop = file_data.sheet2.header[i].split(".");
            // console.log(prop);
            for (let j = 0; j < prop.length; j++) {
              obj["tag"] = prop[0];
              obj["label"] = prop[1];
              obj["value"] = file_data.sheet2.first_row[i];
            }
            locators.push(obj);
          }
          console.log("locators values", locators);
          LOCATORS_DATA = locators;
        }
      }
    }
    await beforeExecution();
    done();
  });

  it("get test data from server and start test", async (done) => {
    let tcc = data.data.testcases[0].testcasecomponents;

    try {
      tcc = tcc.sort(function (a, b) {
        var x = Number(a["sequence_number"], 10);
        var y = Number(b["sequence_number"], 10);

        return x < y ? -1 : x > y ? 1 : 0;
      });

      // -----------------if group found in testcases------------------
      let temp_tcc = [];
      for (let g = 0; g < tcc.length; g++) {
        if (!!tcc[g].testcasegroup) {
          if (tcc[g].sequence_number % 1 !== 0) {
            for (const group of tcc[g].testcasegroup.testcasecomponents) {
              if (group.sequence_number % 1 === 0) {
                temp_tcc.push(group);
              }
            }
          } else {
            temp_tcc.push(tcc[g]);
          }
        } else {
          temp_tcc.push(tcc[g]);
        }
      }
      tcc = temp_tcc;
      // ------------------------------------

      // console.log("steps length", tcc);

      for (i in tcc) {
        // await browser.driver.sleep(3000);
        identifier = false;

        // Call before execute step
        await beforeExecuteStep(tcc[i]);

        console.log("timeout", tcc[i].objectrepository.timeout);
        if (tcc[i].objectrepository.timeout) {
          timeout = tcc[i].objectrepository.timeout * 1000;
        } else {
          timeout = null;
        }
        const strapiBestMatch = tcc[i].objectrepository.best_match
          ? JSON.parse(tcc[i].objectrepository.best_match)
          : [];

        // ------------------- select working tab -----------------------
        let windowHandles = browser.getAllWindowHandles();
        await windowHandles.then(async function (handles) {
          let tab_index;
          if (tcc[i].objectrepository.current_tab) {
            tab_index = tcc[i].objectrepository.current_tab;
          } else {
            tab_index = 0;
          }
          console.log("working tab is------------------->", tab_index);

          let tabHandler = handles[tab_index];
          await browser
            .switchTo()
            .window(tabHandler)
            .then(function () {
              console.log("---------------switched tabs---------");
            });
        });

        // get grid data -------
        const getRowCol = async (
          xpath_,
          captured_row_data,
          grid_pagination_xpath
        ) => {
          return new Promise(async (resolve, reject) => {
            try {
              console.log("grid_pagination_xpath ---->", grid_pagination_xpath);
              console.log("xpath --->", xpath_);

              // REMOVE SVG FROM PAGINATION XPATH
              if (grid_pagination_xpath.includes("svg")) {
                grid_pagination_xpath = grid_pagination_xpath.split("/svg")[0];
              }

              let disabled_value = "disabled";
              // GET PREVIOUS_BTN PAGINATION XPATH
              let prev_btn_xpath = null;
              if (grid_pagination_xpath.includes("li")) {
                prev_btn_xpath = `${grid_pagination_xpath.split("li")[0]}li[1]`;
                disabled_value = "aria-disabled";
              } else {
                prev_btn_xpath = `${grid_pagination_xpath.split("a")[0]}a[1]`;
              }
              console.log("prev_btn_xpath ---->", prev_btn_xpath);

              // CLICK ON PREVIOUS PAGINATION BUTTON UNTIL ITS COMES TO FIRST PAGE
              // if (PAGINATION_XPATH !== grid_pagination_xpath) {
              //   if (prev_btn_xpath) {
              //     prev_btn_disabled = true;
              //     while (prev_btn_disabled) {
              //       // browser.sleep(1500);
              //       await element(by.xpath(prev_btn_xpath))
              //         .getAttribute(disabled_value)
              //         .then(function(value) {
              //           console.log("value ---->", value);
              //           if (value) {
              //             prev_btn_disabled = false;
              //           } else {
              //             element(by.xpath(`${prev_btn_xpath}`)).click();
              //           }
              //         });
              //     }
              //   }
              // }

              let actual_xpath = null;
              let pagination = true;
              let page_count = 1;
              while (pagination) {
                await browser.sleep(2500);
                // GET ROWS/COL COUNT
                console.log("navigation xpath", xpath_[0]);
                console.log("current pagination ---->", page_count);

                let rows = await element
                  .all(by.xpath(`${xpath_[0]}tr`))
                  .count();
                let col = await element
                  .all(by.xpath(`${xpath_[0]}tr[2]/td`))
                  .count();
                console.log("rows -->", rows, "col -->", col);

                // console.log("captured_row_data --->", captured_row_data[1]);
                let FOUND_ELEMENT = false;
                for (let i = 1; i <= rows; i++) {
                  let current_row_data = [];
                  for (let j = 1; j <= col; j++) {
                    // if current column length not equal to column length
                    let current_col_length = await element
                      .all(by.xpath(`${xpath_[0]}tr[${i}]/td`))
                      .count();
                    if (current_col_length === col) {
                      actual_xpath = `${xpath_[0]}tr[${i}]/td[${j}]`;
                      await element(by.xpath(`${xpath_[0]}tr[${i}]/td[${j}]`))
                        .getText()
                        .then(function (text) {
                          // GET COLUMN DATA
                          current_row_data.push(text);
                        });
                    }
                  }
                  // console.log("current_row data", current_row_data[1]);
                  if (
                    JSON.stringify(current_row_data) ==
                    JSON.stringify(captured_row_data)
                  ) {
                    console.log("match found at row", i);

                    FOUND_ELEMENT = true;
                    pagination = false;
                    PAGINATION_XPATH = grid_pagination_xpath;
                    break;
                  } else {
                    actual_xpath = null;
                  }
                }
                if (FOUND_ELEMENT) {
                  break;
                } else {
                  // CHECK IF IT COMES TO LAST PAGE/ NEXT PAGE XPATH ELEMENT DISABLED
                  await element(by.xpath(grid_pagination_xpath))
                    .getAttribute("disabled")
                    .then(function (value) {
                      if (value) {
                        FOUND_ELEMENT = true;
                        pagination = false;
                      } else {
                        console.log(
                          "navigate next --------------------->",
                          grid_pagination_xpath
                        );

                        element(by.xpath(`${grid_pagination_xpath}`)).click();
                      }
                    });
                }
                page_count = page_count + 1;
              }

              // ITERATE THROUGH NUMBER OF PAGINATION TABS. EXCLUDE 1ST AND LAST STEP
              // for (let page_count = 1; page_count <= pagination_count; page_count++) {
              //   await element(by.xpath(`${grid_pagination_xpath}li[${page_count}]`)).click();
              //   // GET ROWS COUNT
              //   await browser.sleep(3000);
              //   console.log("rows xpath --->", `${xpath_[0]}tr`);

              //   let rows = await element.all(by.xpath(`${xpath_[0]}tr`)).count();
              //   // GET COLUMN COUNT
              //   console.log("col xpath --->", `${xpath_[0]}tr[1]/td`);

              //   let col = await element.all(by.xpath(`${xpath_[0]}tr[1]/td`)).count();
              //   console.log("rows -->", rows, "col -->", col);
              //   console.log("captured_row_data --->", captured_row_data);
              //   let FOUND_ELEMENT = false;
              //   for (let i = 1; i <= rows; i++) {
              //     let current_row_data = [];
              //     for (let j = 1; j <= col; j++) {
              //       actual_xpath = `${xpath_[0]}tr[${i}]/td[${j}]`;
              //       await element(by.xpath(`${xpath_[0]}tr[${i}]/td[${j}]`))
              //         .getText()
              //         .then(function(text) {
              //           // GET COLUMN DATA
              //           current_row_data.push(text);
              //         });
              //     }
              //     console.log("current_row data", current_row_data);
              //     if (JSON.stringify(current_row_data) == JSON.stringify(captured_row_data)) {
              //       FOUND_ELEMENT = true;
              //       break;
              //     } else {
              //       actual_xpath = null;
              //     }
              //   }
              //   if (FOUND_ELEMENT) {
              //     break;
              //   }
              // }

              resolve(actual_xpath);
            } catch (error) {
              console.log(error);
              // reject(error);
              resolve("element not found");
            }
          });
        };

        // ---------------------switched to working tab----------------
        console.log("steps action ---->", tcc[i].objectrepository.action);
        console.log("Best match from Strapi");
        if (tcc[i].objectrepository.action === "custom_api") {
          console.log("came to custom_api step");

          const data = tcc[i].objectrepository.api_attributes;
          // const data = {
          //   Method: "GET",
          //   AceEditorValue: '{\n  "hello":"world"\n}',
          //   Uri: "https://easelqa.com",
          //   AuthorizationUsername: "Daksh",
          //   QueryParametersAdd: [
          //     {
          //       QueryParametersKey: "count",
          //       QueryParametersValue: "10",
          //     },
          //   ],
          //   BodyFormDataAdd: [],
          //   PathParametersAdd: [
          //     {
          //       PathParametersKey: "count",
          //       PathParametersValue: "10",
          //     },
          //   ],
          //   AuthorizationPassword: "Rathod",
          //   HeadersAdd: [
          //     {
          //       HeadersKey: "content-type",
          //       HeadersValue: "application/json",
          //     },
          //   ],
          //   BodySelectedMenu: "JSON",
          // };
          const returnobj = (arrays, form = false) => {
            const obj = {};
            const formdata = FormData();
            for (const arr in arrays) {
              const Key = _.filter(Object.keys(arr), function (e) {
                return e.includes("Key");
              });
              const Value = _.filter(Object.keys(arr), function (e) {
                return e.includes("Value");
              });
              if (Key.length > 0 && Value.length > 0) {
                obj[Key[0]] = Value[0];
                if (form) {
                  formdata.append(Key[0], Value[0]);
                }
              }
            }
            if (form) {
              return formdata;
            }
            return obj;
          };
          // const params = returnobj(data.PathParametersAdd);
          const params = returnobj(data.QueryParametersAdd);
          const headers = returnobj(data.HeadersAdd);
          let url = data.Uri;

          if (
            data.BodySelectedMenu === "JSON" ||
            data.BodySelectedMenu === "XML" ||
            data.BodySelectedMenu === "TEXT"
          ) {
            if (data.BodySelectedMenu === "JSON") {
              try {
                const jsondata = JSON.parse(data.AceEditorValue);
                headers["Content-Type"] = "application/json";
              } catch (error) {
                throw "Not serializable";
              }
            }
            const resp = await axios({
              method: data.Method,
              url,
              headers,
              params,
              auth: {
                username: data.AuthorizationUsername,
                password: data.AuthorizationPassword,
              },
              data: data.AceEditorValue,
            });
          } else if (data.BodySelectedMenu === "FormData") {
            const formdata = returnobj(data.BodyFormDataAdd, true);
            headers["Content-Type"] = "multipart/form-data";
            const resp = await axios({
              method: data.Method,
              url,
              headers,
              params,
              auth: {
                username: data.AuthorizationUsername,
                password: data.AuthorizationPassword,
              },
              data: formdata,
            });
          } else if (data.BodySelectedMenu === "None") {
            const resp = await axios({
              method: data.Method,
              url,
              headers,
              params,
              auth: {
                username: data.AuthorizationUsername,
                password: data.AuthorizationPassword,
              },
            });
          }
        } else if (tcc[i].objectrepository.action === "custom") {
          console.log("came to custom steps");
          if (strapiBestMatch.length > 0) {
            identifier = await get_previous_best_match(strapiBestMatch);
          }
          if (!identifier) {
            identifier = await get_best_matching_identifier(
              tcc[i].objectrepository,
              tcc[i].objectrepository.action
            );
          }
          if (identifier) {
            let check = null;
            if (
              tcc[i].objectrepository.expected_condition === "invisibilityOf"
            ) {
              check = await checkElementInvisibility(identifier, timeout);
              check
                ? console.log("element invisible")
                : console.log("element visible");
            } else if (
              tcc[i].objectrepository.expected_condition === "visibilityOf"
            ) {
              check = await checkElementVisiblilty(identifier, timeout);
              check
                ? console.log("element visible")
                : console.log("element not visible");
            }
          } else {
            throw "Cannot find Element";
          }
        } else if (tcc[i].objectrepository.action === "selectframe") {
          try {
            console.log("came to select frame");
            console.log(tcc[i].objectrepository.frame);
            let ids = tcc[i].objectrepository.frame.split(":");

            console.log("waiting");
            await browser.driver.sleep(3000);
            console.log("waiting done");
            console.log(ids);

            if (ids.length > 1) {
              for (let i in ids) {
                if (Number(i) !== 0) {
                  console.log(ids[i]);
                  await browser.switchTo().frame(Number(ids[i]));
                }
              }
            } else {
              console.log("only root");
              await browser.switchTo().defaultContent();
            }
          } catch (error) {
            throw "Cannot find Element";
          }
        } else if (tcc[i].objectrepository.action === "drag") {
          console.log("Doing Drag and Drop");
          let drop_element_id = parseInt(i) + 1;
          if (tcc[drop_element_id].objectrepository.action === "drop") {
            let source, target;

            if (strapiBestMatch.length > 0) {
              source = await get_previous_best_match(strapiBestMatch);
            }
            if (!source) {
              source = await get_best_matching_identifier(
                tcc[i].objectrepository
              );
            }

            const nextstrapiBestMatch = tcc[drop_element_id].objectrepository
              .best_match
              ? JSON.parse(tcc[drop_element_id].objectrepository.best_match)
              : [];
            if (nextstrapiBestMatch.length > 0) {
              target = await get_previous_best_match(nextstrapiBestMatch);
            }
            if (!target) {
              target = await get_best_matching_identifier(
                tcc[i].objectrepository
              );
            }

            if (source && target) {
              await browser.executeScript(dragAndDrop, source, target);
            } else {
              throw "Cannot find Element";
            }
          }
        } else if (tcc[i].objectrepository.action === "mouseover") {
          console.log("Doing Mouseover");
          if (strapiBestMatch.length > 0) {
            identifier = await get_previous_best_match(strapiBestMatch);
          }
          if (!identifier) {
            identifier = await get_best_matching_identifier(
              tcc[i].objectrepository
            );
          }
          //if (condition) {
          if (identifier) {
            await browser.actions().mouseMove(identifier).perform();
          } else {
            throw "Cannot find Element";
          }
        } else if (tcc[i].objectrepository.action === "open_url") {
          console.log("Launch URL");
          try {
            await browser.get(tcc[i].objectrepository.url);
          } catch (error) {
            throw "Cannot open Url";
          }
        } else if (
          tcc[i].objectrepository.action === "text_input" ||
          tcc[i].objectrepository.action === "fileupload"
        ) {
          console.log("Input Text");

          if (strapiBestMatch.length > 0) {
            identifier = await get_previous_best_match(strapiBestMatch);
          }
          if (!identifier) {
            identifier = await get_best_matching_identifier(
              tcc[i].objectrepository
            );
          }
          if (identifier) {
            if (tcc[i].objectrepository.action == "text_input") {
              // console.log("file data------------------------------------------------------------", DRIVEN_DATA);
              let value = "";
              if (DRIVEN_DATA) {
                let tag = tcc[i].objectrepository.tag;
                if (!!DRIVEN_DATA[tag]) {
                  // take value from file
                  value = DRIVEN_DATA[tag].toString();
                } else {
                  // take value from db
                  if (
                    tcc[i].objectrepository["element_attributes"]["type"] &&
                    tcc[i].objectrepository["element_attributes"][
                      "type"
                    ].toLowerCase() === "password"
                  ) {
                    const bufferText1 = Buffer.from(
                      tcc[i].objectrepository.element_value,
                      "hex"
                    );
                    const decode_value = bufferText1.toString();
                    value = decode_value;
                  } else {
                    value = tcc[i].objectrepository.element_value;
                  }
                }
              } else {
                // take value from db
                if (
                  tcc[i].objectrepository["element_attributes"]["type"] &&
                  tcc[i].objectrepository["element_attributes"][
                    "type"
                  ].toLowerCase() === "password"
                ) {
                  const bufferText1 = Buffer.from(
                    tcc[i].objectrepository.element_value,
                    "hex"
                  );
                  const decode_value = bufferText1.toString();
                  if (decode_value === "") {
                    value = tcc[i].objectrepository.element_value;
                  } else {
                    value = decode_value;
                  }
                } else {
                  value = tcc[i].objectrepository.element_value;
                }
              }
              console.log("value..............................", value);

              // check if it is a keyboard event
              let result = value.match(/\$\{KEY_(.*?)\}/);

              let check = await checkECcondition(identifier, false);

              // check ? await identifier.sendKeys(tcc[i].objectrepository.element_value) : "";
              check
                ? result && result.length > 1
                  ? await send_key_downs(identifier, result)
                  : await identifier.sendKeys(value)
                : "";
              //   if (value.length > 150) {
              //    // handle string too long error
              //    for (let char of value) {
              //       check ? await identifier.sendKeys(char) : "";
              //     }
              //   } else {
              //     check ? await identifier.sendKeys(value) : "";
              //   }
            } else {
              let filename = tcc[i].objectrepository.fileupload_url.name;
              console.log(filename);
              const file = fs.createWriteStream(`${ch_path}/${filename}`);
              const request = http
                .get(
                  host + tcc[i].objectrepository.fileupload_url.url,
                  async function (response) {
                    response.pipe(file);
                    file.on("finish", function () {
                      file.close(); // close() is async, call cb after close completes.
                    });
                    let absolutePath = path.resolve(ch_path, filename);
                    let check = await checkECcondition(
                      identifier,
                      false,
                      false
                    );
                    check ? await identifier.sendKeys(absolutePath) : "";
                  }
                )
                .on("error", function (err) {
                  fs.unlink(dest);
                });
              await browser.driver.sleep(15000);
            }
          } else {
            throw "Cannot find Element";
          }
        } else if (tcc[i].objectrepository.action === "mouselclick") {
          console.log("Mouse Click");

          if (
            (Object.keys(tcc[i].objectrepository.grid_data).length === 0 &&
              tcc[i].objectrepository.grid_data.constructor === Object) ===
              false &&
            tcc[i].objectrepository.grid_pagination_xpath !== null &&
            tcc[i].objectrepository.grid_pagination_xpath !== undefined
          ) {
            // await browser.sleep(2000);

            let captured_row_data = [];
            for (let d of tcc[i].objectrepository.grid_data.row_data) {
              captured_row_data.push(d.replace(/\n/g, ""));
            }
            // GET FULL XPATH WHICH IS LONGER IN LENGTH
            let xpath_ = tcc[i].objectrepository.element_xpaths.sort(function (
              a,
              b
            ) {
              return b.length - a.length;
            })[0];
            xpath_ = xpath_.split("tr");

            // // GET ROWS COUNT
            // let rows = await element.all(by.xpath(`${xpath_[0]}tr`)).count();
            // // GET COLUMN COUNT
            // let col = await element.all(by.xpath(`${xpath_[0]}tr[1]/td`)).count();
            // console.log("rows -->", rows, "col -->", col);

            // GET ROWS/COLUMNS DATA
            let actual_xpath = await getRowCol(
              xpath_,
              captured_row_data,
              tcc[i].objectrepository.grid_pagination_xpath
            );
            console.log("actual_xpath ---->", actual_xpath);

            // TAKE ACTION ON XPATH
            let find_xpath = `${actual_xpath.split("td")[0]}td${
              xpath_[1].split("td")[1]
            }`;
            console.log("final element found --->", find_xpath);
            if (find_xpath.includes("svg")) {
              find_xpath = find_xpath.split("/svg")[0];
              console.log("svg xpath", find_xpath);
            }
            // await browser.executeScript("arguments[0].click()", element(by.xpath(find_xpath)));
            await element(by.xpath(find_xpath)).click();
          } else {
            identifier ? console.log("hai bhai") : console.log("nahi hai");

            if (strapiBestMatch.length > 0) {
              identifier = await get_previous_best_match(strapiBestMatch);
            }
            if (!identifier) {
              identifier = await get_best_matching_identifier(
                tcc[i].objectrepository
              );
            }
            // console.log("identifier -->", identifier);

            // if it doesnt find element just stop the loop and execution
            if (identifier) {
              let check = await checkECconditionForMouseclick(identifier);
              console.log("is element available ------------->", check);
              // await browser.executeScript("arguments[0].click()", identifier);
              let available = check
                ? await check_availability(identifier)
                : false;
              available
                ? await identifier.click()
                : await browser.executeScript(
                    "arguments[0].click()",
                    identifier
                  );
            } else {
              // Call after execute step
              // await afterExecuteStep(tcc[i], bestMatchingData);
              // break;
              console.log("----------element not found------------------");
              throw "Cannot find Element";
            }
          }
        } else if (tcc[i].objectrepository.action === "text_validation") {
          if (strapiBestMatch.length > 0) {
            identifier = await get_previous_best_match(strapiBestMatch);
          }
          if (!identifier) {
            identifier = await get_best_matching_identifier(
              tcc[i].objectrepository
            );
          }

          if (identifier) {
            console.log("");
            let validate_text = "";
            if (tcc[i].objectrepository.element_value) {
              validate_text = tcc[i].objectrepository.element_value;
            } else if (tcc[i].objectrepository.text) {
              validate_text = tcc[i].objectrepository.text;
            }
            console.log("validation text -->", validate_text);

            let element_text = await identifier.getText();
            if (!element_text) {
              element_text = await identifier.getAttribute("value");
            }
            console.log("found element text --->", element_text);
            if (validate_text === element_text) {
              console.log("validation success");
            } else {
              throw "Text validation failed!";
            }
          } else {
            console.log("----------element not found------------------");
            throw "Text validation failed!";
          }
        } else if (tcc[i].objectrepository.action === "element_validation") {
          if (strapiBestMatch.length > 0) {
            identifier = await get_previous_best_match(strapiBestMatch);
          }
          if (!identifier) {
            identifier = await get_best_matching_identifier(
              tcc[i].objectrepository
            );
          }

          if (identifier) {
            console.log("element validation success");
          } else {
            console.log("----------element not found------------------");
            throw "Element validation failed!";
          }
        } else if (tcc[i].objectrepository.action === "dropdown") {
          identifier ? console.log("hai bhai") : console.log("nahi hai");

          if (strapiBestMatch.length > 0) {
            identifier = await get_previous_best_match(strapiBestMatch);
          }
          if (!identifier) {
            identifier = await get_best_matching_identifier(
              tcc[i].objectrepository
            );
          }

          if (identifier) {
            // await browser.executeScript(`arguments[0].value=${tcc[i].objectrepository.element_value}`, identifier);
            await identifier
              .$(`[value="${tcc[i].objectrepository.element_value}"]`)
              .click();
          } else {
            // Call after execute step
            // await afterExecuteStep(tcc[i], bestMatchingData);
            // break;
            throw "Cannot find Element";
          }
        }
        // Call after execute step
        await afterExecuteStep(tcc[i], bestMatchingData);
      }
      done();
    } catch (error) {
      console.log("----------parent-error------------");
      console.log(error);
      // take failure snapshot
      let imageId = await failureScreenShot();
      // console.log("image id------------>", imageId);
      //let imageId = 121
      await failureUpdate(tcc[i], error, imageId);
      status = false;
      done();
    }
  }, 1200000);

  async function failureScreenShot() {
    let id = await browser.takeScreenshot().then(async function (png) {
      let saveImage = await fs.writeFile(
        failureImage_path,
        png,
        { encoding: "base64" },
        async function (err) {
          console.log("file_created");
        }
      );
      // let output = Buffer.from(png);
      let form = new FormData();
      form.append("files", fs.createReadStream(failureImage_path), {
        filename: "error_view.png",
      });
      const config = { headers: form.getHeaders() };
      let fileUploadReq = await axios.post(`${host}/upload`, form, config);
      console.log(fileUploadReq.data);
      return fileUploadReq.data[0]["id"];

      // // convert base64 to buffer
      // let output = Buffer.from(png);
      // // create form date
      // let form = new FormData();
      // form.append("files", output, { filename: "error_img.png" });
      // const config = { headers: form.getHeaders() };
      // let fileUploadReq = await axios.post(`${host}/upload`, form, config);
      // // return image id;
      // return fileUploadReq.data[0]["id"];
    });
    return id;
  }

  afterEach(async function (done) {
    console.log(done);
    await afterExecution(status);
    done();
  });
});

async function AutoHeal(ai_data, id) {
  let webelement;
  let browser_width = await browser.executeScript("return window.innerWidth");
  let browser_height = await browser.executeScript("return window.innerHeight");
  let resolution_ratio_width = browser_width / ai_data.scale.x;
  let resolution_ratio_height = browser_height / ai_data.scale.y;

  // for (const data of ai_data.data) {
  let data = ai_data.data[0];
  let centerX = (data.startX + data.endX) / 2;
  let centerY = (data.startY + data.endY) / 2;
  let find_ele = await FindELementReq();
  find_ele.data = find_ele.data.replace(
    "XCOORD",
    centerX * resolution_ratio_width
  );
  find_ele.data = find_ele.data.replace(
    "YCOORD",
    centerY * resolution_ratio_height
  );
  var element_resp = await browser.executeScript(find_ele.data);
  webelement = element_resp.element;

  let arraylist = ["id", "css", "value"];
  let attributes = {};
  let extraattributes = {};
  element_resp.element_attributes = JSON.parse(element_resp.element_attributes);
  // console.log(element_resp.element_attributes);

  for (const ele_attr of element_resp.element_attributes) {
    // console.log(ele_attr.key);

    if (arraylist.includes(ele_attr.key)) {
      attributes["element_" + ele_attr.key] = ele_attr.value;
    } else {
      extraattributes[ele_attr.key] = ele_attr.value;
    }
  }
  attributes["element_attributes"] = extraattributes;
  attributes["element_xpaths"] = [element_resp.extra_attributes];

  console.log("-----Atrributes-----");
  console.log(attributes);
  console.log("-------------------");

  let objresp = await AIMatchHealdata(attributes, id);

  // }
  return objresp;
}

async function check_availability(c_element) {
  let i = 0;
  let distance = 10;

  while (i < 20) {
    element_Location = await c_element.getLocation();

    let x = element_Location.x;
    let y = element_Location.y;
    let h = element_Location.height;
    let w = element_Location.width;
    let centx = (x + w + x) / 2;
    let centy = (y + h + y) / 2;

    try {
      var center_js = `return document.elementFromPoint(${centx}, ${centy}-window.scrollY)`;
      var center_pt_overlayelement = element(by.js(center_js));
      let center_pt_notavailable =
        center_pt_overlayelement === null ? false : true;

      var start_js = `return document.elementFromPoint(${x}+5, ${y}+5-window.scrollY)`;
      var start_pt_overlayelement = element(by.js(start_js));
      let start_pt_notavailable =
        start_pt_overlayelement === null ? false : true;

      console.log("----------trying----------");
      if (
        center_pt_notavailable &&
        (await center_pt_overlayelement.equals(c_element))
      ) {
        console.log("center yes");
        break;
      } else if (
        start_pt_notavailable &&
        (await start_pt_overlayelement.equals(c_element))
      ) {
        console.log("start yes");
        break;
      } else if (center_pt_notavailable && start_pt_notavailable) {
        console.log("yes");
        let parentElement = await center_pt_overlayelement.element(
          by.xpath("..")
        );

        let parentElement_notavailable = parentElement == null ? false : true;
        if (
          parentElement_notavailable &&
          (await parentElement.equals(c_element))
        ) {
          console.log("parent yes");
          // await parentElement.click()
          c_element = parentElement;
          break;
        }
        let parentElement1 = await parentElement.element(by.xpath(".."));
        // console.log(parentElement1);

        parentElement_notavailable = parentElement1 == null ? false : true;
        if (
          parentElement_notavailable &&
          (await parentElement1.equals(c_element))
        ) {
          console.log("parent parent yes");
          // await parentElement1.click()
          c_element = parentElement;
          break;
        }
      } else {
        console.log("no");
        // let viewport = Number(await browser.executeScript("return window.innerHeight"));
        var jss =
          "var viewPortHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);" +
          "var elementTop = arguments[0].getBoundingClientRect().top;" +
          "window.scrollBy(0, elementTop-(viewPortHeight/2));";
        // var jss = `var scrollY=window.scrollY;scrollY>${y}?window.scrollTo(0,${y}-${distance}):${y}>window.innerHeight?window.scrollTo(0,${y}+${distance}):window.scrollTo(0,${y}-${distance});`;
        await browser.executeScript(jss, c_element);
        // if (centy > viewport) {

        //   distance += 10;
        // }
        i++;
      }
    } catch (ex) {
      console.log("---------ex-----------");
      // console.log(ex);

      var jss =
        "var viewPortHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);" +
        "var elementTop = arguments[0].getBoundingClientRect().top;" +
        "window.scrollBy(0, elementTop-(viewPortHeight/2));";
      // var jss = `var scrollY=window.scrollY;scrollY>${y}?window.scrollTo(0,${y}-${distance}):${y}>window.innerHeight?window.scrollTo(0,${y}+${distance}):window.scrollTo(0,${y}-${distance});`;
      await browser.executeScript(jss, c_element);
      // let viewport = Number(await browser.executeScript("return window.innerHeight"));
      // console.log(viewport);
      // console.log(centy);

      // if (centy > viewport) {
      //   var jss = `var scrollY=window.scrollY;scrollY>${y}?window.scrollTo(0,${y}-${distance}):${y}>window.innerHeight?window.scrollTo(0,${y}+${distance}):window.scrollTo(0,${y}-${distance});`;
      //   await browser.executeScript(jss);

      //   distance += 10;
      // }
      i++;
    }
  }
  return c_element;
}
