"use strict";
/* --------------------------------------------------------------------------------
 * deploys application (service) to target Twilio account.
 *
 * NOTE: that this function can only be run on localhost
 *
 * input:
 * event.action: CREATE|UPDATE|DELETE, defaults to CREATE|UPDATE depending on deployed state
 *
 * service identified via unique_name = APPLICATION_NAME in helpers.private.js
 * --------------------------------------------------------------------------------
 */
const assert = require("assert");
const { getParam, setParam, fetchVersionToDeploy } = require(Runtime.getFunctions()["helpers"].path);
const { TwilioServerlessApiClient } = require("@twilio-labs/serverless-api");
const { getListOfFunctionsAndAssets } = require("@twilio-labs/serverless-api/dist/utils/fs");
const fs = require("fs");

exports.handler = async function (context, event, callback) {
  const THIS = "deploy";

  assert(context.DOMAIN_NAME.startsWith("localhost:"), `Can only run on localhost!!!`);
  console.time(THIS);
  try {
    assert(event.configuration.APPLICATION_NAME, "missing APPLICATION_NAME variable!!!");
    assert(event.action, "missing event.action variable!!!");
    const application_name = event.configuration.APPLICATION_NAME;
    const env = event.configuration;
    console.log(THIS, "configuration:", env);

    console.log(THIS, `Deploying (${event.action}) Twilio service ... ${application_name}`);

    switch (event.action) {
      case "DEPLOY":
      case "REDEPLOY":
        {
          // ---------- deploy serverless service
          const service_sid = await deployService(context, env);
          console.log(THIS, `Deployed: ${service_sid}`);
          const client = context.getTwilioClient();
          await client.serverless
            .services(service_sid)
            .update({ uiEditable: true });
          console.log(THIS, "Make Twilio service editable ...");

          // ---------- provision dependent resources
          await provisionDependentResources(context);

          // ---------- deploy studio flow
          const studio_flow_sid = await deployStudioFlow(context);
          console.log(THIS, "deployed Studio flow");

          // ---------- Changes the default Flex Conversations address with type "Chat" to use studio flow, removes legacy addresses
          await configureConversationsChatAddress(context);

          const version_to_deploy = await fetchVersionToDeploy();
          await setParam(context, 'APPLICATION_VERSION', version_to_deploy);
          console.log(THIS, `Completed deployment of ${application_name}:${version_to_deploy}`);

          const response = {
            status: event.action,
            deployables: [
              { service_sid: service_sid },
              { studio_flow_id: studio_flow_sid },
            ],
          };
          console.log(THIS, response);
          return callback(null, response);
        }
        break;

      case "UNDEPLOY":
        {
          const undeployed_service_sid = await undeployService(context);

          const undeployed_studio_flow_sid = await undeployStudioFlow(context);

          // TODO: un-provision other services

          const response = {
            status: "UNDEPLOYED",
            deployables: [
              { service_sid: undeployed_service_sid },
              { studio_flow_id: undeployed_studio_flow_sid },
            ],
          };
          console.log(THIS, response);
          return callback(null, response);
        }
        break;

      default:
        throw new Error(`unknown event.action=${action}`);
    }
  } catch (err) {
    console.log(err);
    return callback(err);
  } finally {
    console.timeEnd(THIS);
  }
};

/* --------------------------------------------------------------------------------
 * Mutates default Flex Conversations (Chat) Address to use studio flow, remove legacy addresses
 * --------------------------------------------------------------------------------
 */
async function configureConversationsChatAddress(context) {
  const addressSid = await getParam(context, "CHAT_ADDRESS_SID");
  const studioFlowSid = await getParam(context, "STUDIO_FLOW_SID");

  const client = context.getTwilioClient();

  //remove legacy addresses
  const legacyAddrs = await client.flexApi.v1.flexFlow
    .list()
    .then((resp) =>
      resp.map((addr) => ({ fname: addr.friendlyName, sid: addr.sid }))
    )
    .catch((err) => console.log(`Could not remove legacy addresses: ${err}`));
  for await (const addr of legacyAddrs) {
    console.log(`Removing legacy address ${addr.fname}...`);
    await client.flexApi.v1.flexFlow(addr.sid).remove();
  }

  await client.conversations
    .addressConfigurations(addressSid)
    .update({
      autoCreation: {
        enabled: true,
        type: "studio",
        studioFlowSid: studioFlowSid,
        studioRetryCount: 3,
      },
    })
    .then(() =>
      console.log("Successfully changed default Flex Chat to use studio flow.")
    )
    .catch((err) =>
      console.log(
        `Could not update Flex Chat to use hls-webchat studio flow: ${err}`
      )
    );
}

/* --------------------------------------------------------------------------------
 * provisioned dependent services/resources
 * --------------------------------------------------------------------------------
 */
async function provisionDependentResources(context) {
  await getParam(context, 'VERIFY_SID');
  await getParam(context, 'API_KEY');
}

/* --------------------------------------------------------------------------------
 * deploys (creates new/updates existing) service to target Twilio account.
 *
 * - service identified via unique_name = APPLICATION_NAME in helpers.private.js
 *
 * returns: service SID, if successful
 * --------------------------------------------------------------------------------
 */
async function getAssets() {
  const { assets } = await getListOfFunctionsAndAssets(process.cwd(), {
    functionsFolderNames: [],
    assetsFolderNames: ["assets"],
  });
  //console.log('asset count:', assets.length);

  const indexHTMLs = assets.filter((asset) =>
    asset.name.includes("index.html")
  );
  // Set indext.html as a default document
  const allAssets = assets.concat(
    indexHTMLs.map((ih) => ({
      ...ih,
      path: ih.name.replace("index.html", ""),
      name: ih.name.replace("index.html", ""),
    }))
  );
  //console.log(allAssets);
  //return allAssets;
  return assets;
}

/* --------------------------------------------------------------------------------
 * deploys serverless service
 * --------------------------------------------------------------------------------
 */
async function deployService(context, envrionmentVariables = {}) {
  const client = context.getTwilioClient();

  const assets = await getAssets();
  console.log("asset count:", assets.length);

  const { functions } = await getListOfFunctionsAndAssets(process.cwd(), {
    functionsFolderNames: ["functions"],
    assetsFolderNames: [],
  });
  console.log("function count:", functions.length);

  const pkgJsonRaw = fs.readFileSync(`${process.cwd()}/package.json`);
  const pkgJsonInfo = JSON.parse(pkgJsonRaw);
  const dependencies = pkgJsonInfo.dependencies;
  console.log("package.json loaded");

  const deployOptions = {
    env: {
      ...envrionmentVariables,
    },
    pkgJson: {
      dependencies,
    },
    functionsEnv: "dev",
    functions,
    assets,
  };
  console.log("deployOptions.env:", deployOptions.env);

  context["APPLICATION_NAME"] = envrionmentVariables.APPLICATION_NAME;
  let service_sid = await getParam(context, "SERVICE_SID");
  if (service_sid) {
    // update service
    console.log("updating services ...");
    deployOptions.serviceSid = service_sid;
  } else {
    // create service
    console.log("creating services ...");
    deployOptions.serviceName = await getParam(context, "APPLICATION_NAME");
  }

  const serverlessClient = new TwilioServerlessApiClient({
    username: client.username, // ACCOUNT_SID
    password: client.password, // AUTH_TOKEN
  });

  serverlessClient.on("status-update", (evt) => {
    console.log(evt.message);
  });

  await serverlessClient.deployProject(deployOptions);
  service_sid = await getParam(context, "SERVICE_SID");

  return service_sid;
}

/* --------------------------------------------------------------------------------
 * undeploys sererless service
 * --------------------------------------------------------------------------------
 */
async function undeployService(context) {
  const THIS = "undeployService:";
  try {
    const client = context.getTwilioClient();
    // ---------- remove studio flow, if exists
    const service_sid = await getParam(context, "SERVICE_SID"); // will be null if not deployed
    if (service_sid) {
      const response = await client.serverless.services(service_sid).remove();
      console.log(THIS, "undeploy: ", response);
    }

    return service_sid;
  } catch (err) {
    console.log(THIS, err);
    throw new Error(err);
  }
}

/* --------------------------------------------------------------------------------
 * deploys studio flow
 * . create/update studio flow
 * . set flex flow integration for webchat
 * --------------------------------------------------------------------------------
 */
async function deployStudioFlow(context) {
  const THIS = "deployStudioFlow:";

  try {
    const SERVICE_SID = await getParam(context, "SERVICE_SID");
    const FUNCTION_SID = await getParam(context, "FUNCTION_SID");
    const ENVIRONMENT_SID = await getParam(context, "ENVIRONMENT_SID");
    const ENVIRONMENT_DOMAIN = await getParam(context, "ENVIRONMENT_DOMAIN");
    const FLEX_WORKFLOW_SID = await getParam(context, "FLEX_WORKFLOW_SID");
    const FLEX_TASK_CHANNEL_SID = await getParam(
      context,
      "FLEX_TASK_CHANNEL_SID"
    );
    const STUDIO_FLOW_NAME = await getParam(context, "STUDIO_FLOW_NAME");
    let STUDIO_FLOW_SID = await getParam(context, "STUDIO_FLOW_SID"); // will be null if not deployed

    const flow_definition_file =
      Runtime.getAssets()["/installer/studio-flow-template.json"].path;
    let flow_definition = fs
      .readFileSync(flow_definition_file)
      .toString("utf-8")
      .replace(/YOUR_SERVICE_SID/g, SERVICE_SID)
      .replace(/YOUR_FUNCTION_SID/g, FUNCTION_SID)
      .replace(/YOUR_ENVIRONMENT_SID/g, ENVIRONMENT_SID)
      .replace(/YOUR_ENVIRONMENT_DOMAIN/g, ENVIRONMENT_DOMAIN)
      .replace(/YOUR_FLEX_WORKFLOW_SID/g, FLEX_WORKFLOW_SID)
      .replace(/YOUR_FLEX_TASK_CHANNEL_SID/g, FLEX_TASK_CHANNEL_SID);

    const client = context.getTwilioClient();
    // ---------- create/update studio flow
    const flow = STUDIO_FLOW_SID
      ? await client.studio.flows(STUDIO_FLOW_SID).update({
          status: "published",
          commitMessage: "installer deploy update",
          definition: `${flow_definition}`,
        })
      : await client.studio.flows.create({
          friendlyName: STUDIO_FLOW_NAME,
          status: "published",
          commitMessage: "installer deploy create",
          definition: `${flow_definition}`,
        });
    STUDIO_FLOW_SID = flow.sid;

    return STUDIO_FLOW_SID;
  } catch (err) {
    console.log(THIS, err);
    throw new Error(err);
  } finally {
    console.log(THIS, "sucess");
  }
}

/* --------------------------------------------------------------------------------
 * undeploys studio flow
 * --------------------------------------------------------------------------------
 */
async function undeployStudioFlow(context) {
  const THIS = "undeployStudioFlow:";
  try {
    const client = context.getTwilioClient();
    // ---------- remove studio flow, if exists
    const STUDIO_FLOW_SID = await getParam(context, "STUDIO_FLOW_SID"); // will be null if not deployed
    if (STUDIO_FLOW_SID) {
      const response = await client.studio.v1.flows(STUDIO_FLOW_SID).remove();
      console.log(THIS, "undeploy: ", response);
    }

    return STUDIO_FLOW_SID;
  } catch (err) {
    console.log(THIS, err);
    throw new Error(err);
  }
}
