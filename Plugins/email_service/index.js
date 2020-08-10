const nodemailer = require("nodemailer");
const fs = require("fs");
const rawdata = require("./send");
const getbase64 = rawdata.getPdf;
let template_path = "./invoice.html";
const moment = require("moment");
const axios = require("axios").default;
const io = require("socket.io-client");
const host = "https://admin.dataphion.com";
// const host = "http://localhost:1337";
const socket = io(host);
const fetch = require("node-fetch");
const chartExporter = require("highcharts-export-server");
chartExporter.initPool();

socket.on("connect", function() {
  console.log("connect");
});

// start when get message on socketio
socket.on("send_email", async function(data) {
  // console.log(data);

  // get smtp details
  async function getExecutedData(id) {
    let data = await fetch(`${host}/graphql`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        query: `{
          testcaseexecutions(where:{id:"${id}"}){
            testcase{
              application{
                id,
                smtpdetail{
                  hostname,
                  port,
                  username,
                  password,
                  recipients
                }
              }
            }
          }
        }`
      })
    });
    return data.json();
  }

  // get smtp details
  const getData = await getExecutedData(data.testcaseexecutions[0].id);
  let smtp = getData.data.testcaseexecutions[0].testcase.application.smtpdetail;

  // get testcase details
  async function getTestcases(TestExecutions) {
    let tests = [];
    for (let test of TestExecutions) {
      const details = await axios.get(`${host}/testcaseexecutions/${test.id}`);
      tests.push(details.data);
    }
    return tests;
  }

  let TestsDetails = await getTestcases(data.testcaseexecutions);
  // console.log("TestsDetails ==============>", TestsDetails);

  // charts configuration
  const chartDetails = {
    type: "png",
    options: {
      chart: {
        type: "pie"
      },
      credits: {
        enabled: false
      },
      title: {
        text: "Report Summary"
      },
      plotOptions: {
        pie: {
          dataLabels: {
            enabled: true,
            format: "<b>{point.name}</b>: {point.y}"
          }
        }
      },
      series: [
        {
          data: [
            {
              name: "passed",
              y: parseInt(data.total_pass)
            },
            {
              name: "failed",
              y: parseInt(data.total_fail)
            }
          ]
        }
      ]
    }
  };

  await chartExporter.export(chartDetails, async (err, res) => {
    // convert hicharts to image
    // Get the image data (base64)
    let imageb64 = res.data;
    console.log("Saved image!");
    chartExporter.killPool();

    // calculate time difference
    let s_time = moment(data.start_time).format("YYYY/MM/DD HH:mm:ss"),
      e_time = moment(data.end_time).format("YYYY/MM/DD HH:mm:ss"),
      ms = moment(e_time, "YYYY/MM/DD HH:mm:ss").diff(moment(s_time, "YYYY/MM/DD HH:mm:ss")),
      d = moment.duration(ms),
      t_hours = Math.floor(d.asHours()),
      t_minutes = Math.floor(d.asMinutes()),
      t_seconds = Number(moment.utc(ms).format("ss"));
    let duration = moment.duration(`${t_hours}:${t_minutes}:${t_seconds}`);

    let template_data = {
      total: data.total_test,
      passed: data.total_pass,
      failed: data.total_fail,
      start: data.start_time,
      end: data.end_time,
      duration: `${duration._data.hours}hr ${duration._data.minutes}min ${duration._data.seconds}sec`,
      suite_name: data.testsuite.suite_name,
      test_type: data.testsuite.type,
      hostname: "pawan.dhami",
      os: "Windows 10 64bit",
      version: "v1.0.0",
      browser: "Version 80.0.",
      error: 0,
      imageb64: "data:image/jpeg;base64," + imageb64,
      testcase: TestsDetails
    };

    // get pdfs in base64 (invoice html template to pdf)
    const base64 = await getbase64(template_path, template_data);

    //send mail
    let transport = nodemailer.createTransport({
      //   host: "smtp.mailtrap.io",
      //   port: 2525,
      service: "gmail",
      auth: {
        user: smtp.username,
        pass: smtp.password
      }
    });

    const message = {
      from: smtp.username,
      to: smtp.recipients,
      subject: "Testsuites report",
      //   text: "Hi, \n Below is your testcase execution report \n",
      html: `<div style="display: flex; justify-content: center; margin: 25px ">
  <table
    style="width: 600px;
      padding: 25px"
  >
    <tbody>
      <tr style>
        <td style="width: 50%; display: flex; align-items: center;" width="50%">
          <img style="background-color: #2e86de; height: 35px; width: 35px" src="https://i.ibb.co/BccWVnK/DpLogo.png" alt="AI TESTER LOGO" class="CToWUd" />
          <div style="margin-left: 10px; font-family: 'Rubik', sans-serif !important; font-weight: 600; font-size: 24px; color: #576574;">
            <span style="font-family: 'Rubik', sans-serif !important; font-weight: 600; color: #ff9879;">AI</span>
            Tester
          </div>
        </td>
        <td style="width: 50%" width="50%">
          <h2 style="margin:0;font-size:18px;font-family: 'Rubik', sans-serif !important;color:#04a0dc;text-align:right">Test Suite Execution Report</h2>
        </td>
      </tr>
      <tr style="background-color:#fff">
        <td
          style="border:1px solid #dddee1;padding:24px;word-break:break-word;word-wrap:break-word;width: 100%;font-family: 'Rubik', sans-serif !important;
        font-size: 13px;"
          colspan="2"
        >
          <p>Dear Sir/Madam,<br /><br />Your test suite has just finished its execution. Here is the summary report.</p>
          <table style="width:100%;background-color:#f5f7fa;border:1px solid #dddee1; font-size: 14px" border="1" width="100%" bgcolor="#f5f7fa">
            <tbody>
              <tr>
                <td style="width:24%" width="24%">Host Name</td>
                <td colspan="3">${template_data.hostname}</td>
              </tr>
              <tr>
                <td>Operating System</td>
                <td colspan="3">${template_data.os}</td>
              </tr>
              <tr>
                <td>Browser</td>
                <td colspan="3">${template_data.browser}</td>
              </tr>
              <tr>
                <td>Test Suite</td>
                <td colspan="3">${template_data.suite_name}</td>
              </tr>
              <tr>
              <td>Suite Type</td>
              <td colspan="3">${template_data.test_type}</td>
            </tr>
              <tr>
                <td>Result</td>
                <td style="width:25%;color:green" width="25%">Passed: ${template_data.passed}</td>
                <td style="width:25%;color:red" width="25%">Failed: ${template_data.failed}</td>
                <td style="width:25%;color:red" width="25%">Error: ${template_data.error}</td>
              </tr>
            </tbody>
          </table>
          <p>
            You can now go to your test project to view the execution report <a href="http://localhost:3000/dashboard/${getData.data.testcaseexecutions[0].testcase.application.id}/reports">aitester.dataphion.com</a>. <br />
            <br />This email was sent automatically by Aitester. Please do not reply.<br /><br />Thanks,<br />Aitester
          </p>
        </td>
      </tr>
    </tbody>
  </table>
</div>
`,
      attachments: [
        {
          // binary buffer as an attachment
          filename: "report.pdf",
          content: Buffer.from(base64, "base64"),
          contentType: "application/pdf"
        }
      ]
    };

    transport.sendMail(message, function(err, info) {
      if (err) {
        console.log("error--- >", err);
      } else {
        console.log("info--------->", info);
      }
    });
  });
});
