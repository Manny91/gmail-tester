const gmail = require("./gmail");
const fs = require("fs");
const {
  google
} = require("googleapis");
const util = require("util");

async function _get_recent_email(credentials_json, token_path, options = {
  include_body: true,
  label: "INBOX",
}) {
  const emails = [];
  // Load client secrets from a local file.
  const content = fs.readFileSync(credentials_json);
  const oAuth2Client = await gmail.authorize(JSON.parse(content), token_path);
  const gmail_client = google.gmail({
    version: "v1",
    oAuth2Client
  });
  const gmail_emails = await gmail.get_recent_email(gmail_client, oAuth2Client, options.label);
  if (gmail_emails && gmail_emails.length > 0) {
    for (const gmail_email of gmail_emails) {
      const emailFrom = gmail_email.payload.headers.find(h => h.name === "From");
      const emailSubject = gmail_email.payload.headers.find(h => h.name === "Subject");
      const emailTo = gmail_email.payload.headers.find(h => h.name === "To");
      const email = {
        from: emailFrom ? emailFrom.value : "",
        subject: emailSubject ? emailSubject.value : "",
        receiver: emailTo ? emailTo.value : "",
        id: gmail_email.id
      };
      if (options.include_body) {
        let email_body = {
          html: "",
          text: ""
        };
        const {
          body
        } = gmail_email.payload;
        if (body.size) {
          switch (gmail_email.payload.mimeType) {
            case "text/html":
              email_body.html = Buffer.from(body.data, "base64").toString("utf8");
              break;
            case "text/plain":
            default:
              email_body.text = Buffer.from(body.data, "base64").toString("utf8");
              break;
          }
        } else {
          let body_part = gmail_email.payload.parts.find(
            p => p.mimeType === "text/html"
          );
          if (body_part) {
            email_body.html = Buffer.from(body_part.body.data, "base64").toString(
              "utf8"
            );
          }
          body_part = gmail_email.payload.parts.find(
            p => p.mimeType === "text/plain"
          );
          if (body_part) {
            email_body.text = Buffer.from(body_part.body.data, "base64").toString(
              "utf8"
            );
          }
        }

        email.body = email_body;
      }
      emails.push(email);
    }
  }

  return emails;
}

async function check_inbox(
  credentials_json,
  token_path,
  subject,
  from,
  to,
  wait_time_sec = 30,
  max_wait_time_sec = 60,
  options
) {
  try {
    console.log(
      `[gmail] Checking for message from '${from}', to: ${to}, contains '${subject}' in subject...`
    );
    // Load client secrets from a local file.
    let found_email = null;
    let done_waiting_time = 0;
    do {
      const emails = await _get_recent_email(credentials_json, token_path, options);
      for (let email of emails) {
        if (
          email.receiver.indexOf(to) >= 0 &&
          email.subject.indexOf(subject) >= 0 &&
          email.from.indexOf(from) >= 0
        ) {
          found_email = email;
          break;
        }
      }

      if (!found_email) {
        console.log(
          `[gmail] Message not found. Waiting ${wait_time_sec} seconds...`
        );
        done_waiting_time += wait_time_sec;
        if (done_waiting_time >= max_wait_time_sec) {
          console.log("[gmail] Maximum waiting time exceeded!");
          break;
        }
        await util.promisify(setTimeout)(wait_time_sec * 1000);
      }
    } while (!found_email);
    return found_email;
  } catch (err) {
    console.log("[gmail] Error:", err);
  }
}


async function modifyMessage(
  credentials_json,
  token_path,
  messageId,
  options
) {
  try {
    console.log(
      `[gmail] modifyin message '${messageId}', using : ${options}`
    );

    // Load client secrets from a local file.
    const content = fs.readFileSync(credentials_json);
    const oAuth2Client = await gmail.authorize(JSON.parse(content), token_path);
    const gmail_client = google.gmail({
      version: "v1",
      oAuth2Client
    });

    const modifyResponse = await gmail.modify_email(gmail_client, oAuth2Client, messageId, options);
    return modifyResponse;
  } catch (err) {
    console.log("[gmail] Error:", err);
  }
}
/**
 * Get an array of messages
 *
 * @param {string} credentials_json - Path to credentials json file.
 * @param {string} token_path - Path to token json file.
 * @param {Object} options
 * @param {boolean} options.include_body - Return message body string.
 */
async function get_messages(credentials_json, token_path, options) {
  try {
    const emails = await _get_recent_email(
      credentials_json,
      token_path,
      options
    );
    return emails;
  } catch (err) {
    console.log("[gmail] Error:", err);
  }
}

module.exports = {
  check_inbox,
  get_messages,
  modifyMessage
};