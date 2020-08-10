const fetch = require("node-fetch");
const amqp = require("amqplib/callback_api");
const host = process.env.STRAPI_HOST || "http://localhost:1337";
const rmq_host = process.env.RMQ_HOST || "amqp://localhost";
// const host = process.env.STRAPI_HOST || "https://admin.dataphion.com";
const url = host + "/graphql";
const objectrepository = host + "/objectrepositories/";
const testsessionexecution = host + "/testsessionexecutions/";
const aimatch = process.env.VISION_API_HOST || "http://localhost:9502/vision/api";
const moment = require("moment");
const _ = require("lodash");
const socket = require("socket.io-client")(host);
const testcase_id = process.env.TESTCASE_ID;
const testsessionexecution_id = process.env.TESTSESSIONEXECUTION_ID;
const environment_id = process.env.ENVIRONMENT_ID;
const browser_name = process.env.BROWSER_NAME || "chrome";
let testcaseexecution_id;

String.prototype.format = function() {
  var args = [].slice.call(arguments);
  return this.replace(/(\{\d+\})/g, function(a) {
    return args[+a.substr(1, a.length - 2) || 0];
  });
};

const isArrayEqual = function(x, y) {
  return _(x)
    .differenceWith(y, _.isEqual)
    .isEmpty();
};
const strapiReq = async function() {
  let objectrepo_query = `objectrepository{
    id,
    url,
    alias_name,
    page_url,
    thumbnail_url,
    current_tab,
    grid_pagination_xpath,
    highlighted_image_url,
    horizontal_anchor_text,
    vertical_anchor_text
    object_by_lable,
    action,
    element_type,
    element_label,
    element_id,
    element_value,
    element_xpaths,
    element_css,
    element_health,
    element_attributes,
    grid_data,
    parent_element_attributes,
    element_snapshot,
    description,
    nlu,
    browser_height,
    browser_width,
    tag,
    protocol,
    query_parameters,
    domain,
    path,
    text,
    x_scroll,
    y_scroll,
    pixel_ratio,
    parent_x_cord,
    parent_y_cord,
    x_cord,
    y_cord,
    height,
    width,
    placeholder,
    best_match,
    frame,
    value,
    timeout,
    expected_condition,
    fileupload_url{
      id
      name
      url
      provider
    }
  }`;

  console.log("testcase id", testcase_id);

  const query = `{
			    testcases(where:{id:"${testcase_id}"}){
            name,
            ddt_file{
              name,
              ext,
              url,
              id
            }
            application{
              id
            }
			      testcasecomponents{
              testcasegroup{
                id,
                testcasecomponents{
                  type,
                  related_object_id,
                  sequence_number,
                  ${objectrepo_query}
                }
              }
				    type,
				    related_object_id,
				    sequence_number,
				    ${objectrepo_query}
			    }
        }
      }`;

  try {
    const testcase_req = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        query
      })
    });
    const testcase_json = await testcase_req.json();
    // console.log("--------------------------------->>>>", testcase_json.data.testcases[0].application.id);
    return testcase_json;
  } catch (error) {
    console.log(error);
  }
};
const AIMatchReq = async function(data) {
  try {
    // console.log("---------AIMatch Req Data------");
    // console.log(data);

    const aimatch_req = await fetch(aimatch + "/TemplateMatch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    });
    const testcase_json = await aimatch_req.json();
    return testcase_json;
  } catch (error) {
    console.log(error);
  }
};
const AIMatchHealdata = async function(data, id) {
  try {
    const aimatch_heal = await fetch(objectrepository + id, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    });
    const testcase_json = await aimatch_heal.json();
    return testcase_json;
  } catch (error) {
    console.log(error);
  }
};
const FindELementReq = async function() {
  try {
    const findelement_req = await fetch(aimatch + "/find_element", {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      }
    });
    const findelement_json = await findelement_req.json();
    return findelement_json;
  } catch (error) {
    console.log(error);
  }
};

const beforeExecution = async function() {
  // Send testcase execution start msg to strapi
  await socket.emit(
    "ui_execution",
    (done_testcaseexecution = {
      status: "testcaseexecution started",
      testcaseexecution_id: testcaseexecution_id,
      testcase_id: testcase_id,
      start_time: moment().format("MM-DD-YYYY H:mm:ss")
    })
  );

  // Get default type id from testsuite
  try {
    const testcaseexecution_req = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        query: `mutation{
            createTestcaseexecution(input:{
              data:{
                status: "started",
                type: "ui",
                start_time:"${moment().format("MM-DD-YYYY H:mm:ss")}",
                testcase:"${testcase_id}",
                testsessionexecution:"${testsessionexecution_id}",
              }
            }) {
              testcaseexecution{
                id
              }
            }
          }`
      })
    });
    const testcaseexecution_json = await testcaseexecution_req.json();
    console.log(testcaseexecution_json);

    // Set testcase execution id as a global
    testcaseexecution_id = testcaseexecution_json.data.createTestcaseexecution.testcaseexecution.id;
  } catch (error) {
    console.log(error);
  }
};

const beforeExecuteStep = async function(step) {
  console.log(step.sequence_number);
  // console.log(step.objectrepository);

  // Send execution start msg to strapi for single step
  await socket.emit(
    "ui_execution",
    (step_data = {
      status: "started",
      id: step.objectrepository.id,
      testcase_id: testcase_id,
      action: step.objectrepository.action,
      start_time: moment().format("MM-DD-YYYY H:mm:ss")
    })
  );
};

const afterExecuteStep = async function(step, best_match) {
  let data = {
    url: `${step.objectrepository.url}`,
    type: "ui",
    action: `${step.objectrepository.action}`,
    index: `${Number(step.sequence_number)}`,
    description: `${step.objectrepository.description ? step.objectrepository.description.replace(/"/g, '\\"') : ""}`,
    testcaseexecution: `${testcaseexecution_id}`,
    objectrepository: `${step.objectrepository.id}`
  };
  // console.log("create-flowsteps----------------------", data);

  // Create logs in flowsteps
  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        query: `mutation{
            createFlowstep(input:{
              data:{
                url: "${step.objectrepository.url}",
                type: "ui",
                action: "${step.objectrepository.action}",
                index: ${step.sequence_number},
                description: "${step.objectrepository.description ? step.objectrepository.description.replace(/"/g, '\\"') : ""}"
                testcaseexecution: "${testcaseexecution_id}",
		            objectrepository: "${step.objectrepository.id}"
              }
            }){
              flowstep{
                  id
              }
            }
          }`
      })
    }).then(response => {
      // console.log("response ------------>", response);
    });
  } catch (error) {
    console.log(error);
  }

  // Send execution completed msg to strapi for single step
  await socket.emit(
    "ui_execution",
    (step_data = {
      status: "completed",
      testcase_id: testcase_id,
      id: step.objectrepository.id,
      action: step.objectrepository.action,
      end_time: moment().format("MM-DD-YYYY H:mm:ss")
    })
  );

  // Send best matching to strapi for single step
  if (step.sequence_number !== "1" && step.objectrepository.action !== "open_url" && best_match.length > 0) {
    const strapiBestMatch = step.objectrepository.best_match ? JSON.parse(step.objectrepository.best_match) : [];
    var compareOldNew = isArrayEqual(best_match, strapiBestMatch);
    if (!compareOldNew) {
      try {
        await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            query: `mutation{
            updateObjectrepository(
              input:{
                where:{id:"{0}"}
                data:{best_match:"{1}"}
              }
            ){
              objectrepository{
                id
              }
            }
          }`.format(step.objectrepository.id, JSON.stringify(best_match).replace(/"/g, '\\"'))
          })
        });
      } catch (error) {
        console.log(error);
      }
    }
  }
};
const failureUpdate = async function(step, error, imageId) {
  // Create logs in flowsteps
  // console.log("imageId---------------->", imageId);
  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        query: `mutation{
            createFlowstep(input:{
              data:{
                url: "${step.objectrepository.url}",
                type: "ui",
                action: "${step.objectrepository.action}",
                index: ${step.sequence_number},
                error_log: "${error}",
                error_view_id: "${imageId}"
                description: "${step.objectrepository.description.replace(/"/g, '\\"')}",
                testcaseexecution: "${testcaseexecution_id}",
	              objectrepository: "${step.objectrepository.id}",
              }
            }){
              flowstep{
                  id
              }
            }
          }`
      })
    });
  } catch (error) {
    console.log(error);
  }

  // Send execution completed msg to strapi for single step
  await socket.emit(
    "ui_execution",
    (step_data = {
      status: "failed",
      testcase_id: testcase_id,
      id: step.objectrepository.id,
      action: step.objectrepository.action,
      end_time: moment().format("MM-DD-YYYY H:mm:ss")
    })
  );
};

const afterExecution = async function(status) {
  // If last step of testcase
  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        query: `mutation {
          updateTestcaseexecution(
            input:{
              where:{id:"${testcaseexecution_id}"}
              data:{
                status:"${status ? "completed" : "failed"}",
                end_time:"${moment().format("MM-DD-YYYY H:mm:ss")}"
              }
            }
          ){
            testcaseexecution{
              id
            }
          }
        }`
      })
    });
  } catch (error) {
    console.log(error);
  }

  const aimatch_heal = await fetch(testsessionexecution + testsessionexecution_id, {
    method: "GET",
    headers: {
      "Content-Type": "application/json"
    }
  });
  const aimatch_heal_json = await aimatch_heal.json();

  if ("testsuite" in aimatch_heal_json) {
    // if testsuite is not default then push to rabbitmq
    if (!!aimatch_heal_json.testsuite && aimatch_heal_json.testsuite.suite_name !== "default") {
      let tse_data = status ? { total_pass: Number(aimatch_heal_json.total_pass) + 1 } : { total_fail: Number(aimatch_heal_json.total_fail) + 1 };
      fetch(testsessionexecution + testsessionexecution_id, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(tse_data)
      });
      // sendresponse();
    }
  }

  // Send testcase execution completed msg to strapi
  await socket.emit(
    "ui_execution",
    (done_testcaseexecution = {
      status: status ? "testcaseexecution completed" : "testcaseexecution failed",
      testcase_id: testcase_id,
      testcaseexecution_id: testcaseexecution_id,
      end_time: moment().format("MM-DD-YYYY H:mm:ss")
    })
  );
};

const sendresponse = () => {
  amqp.connect(rmq_host, (err, conn) => {
    conn.createChannel((err, ch) => {
      const q = "testdecider";
      const msg = { testsessionid: Number(testsessionexecution_id), environment_id, browser: browser_name };
      console.log(`\n PUSHING ${testsessionexecution_id} TO QUEUE ${q} ON amqp://localhost`);
      ch.assertQueue(q, { durable: false });
      ch.sendToQueue(q, Buffer.from(JSON.stringify(msg)));
    });
    setTimeout(() => {
      conn.close();
    }, 500);
  });
};

const helpers = {
  strapiReq: strapiReq,
  AIMatchReq: AIMatchReq,
  beforeExecution: beforeExecution,
  beforeExecuteStep: beforeExecuteStep,
  afterExecuteStep: afterExecuteStep,
  afterExecution: afterExecution,
  FindELementReq: FindELementReq,
  AIMatchHealdata: AIMatchHealdata,
  failureUpdate: failureUpdate
};

module.exports = helpers;
