'use strict';
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
const { getParam, getAllParams } = require(Runtime.getFunctions()['helpers'].path);
const { TwilioServerlessApiClient } = require('@twilio-labs/serverless-api');
const { getListOfFunctionsAndAssets } = require('@twilio-labs/serverless-api/dist/utils/fs');
const fs = require('fs');
const { execSync } = require('child_process');


exports.handler = async function(context, event, callback) {
  const THIS = 'deploy-service';

  assert(context.DOMAIN_NAME.startsWith('localhost:'), `Can only run on localhost!!!`);
  console.time(THIS);
  try {
    assert(event.configuration.APPLICATION_NAME, 'missing APPLICATION_NAME variable!!!');
    assert(event.action, 'missing event.action variable!!!');
    const application_name = event.configuration.APPLICATION_NAME;
    const env = event.configuration;
    console.log(THIS, 'configuration:', env);

    console.log(THIS, `Deploying (${event.action}) Twilio service ... ${application_name}`);

    switch (event.action) {

      case 'DEPLOY': {
        await configureWebChat(context);

        const service_sid = await deployService(context, env);
        console.log(THIS, `Deployed: ${service_sid}`);

        console.log(THIS, 'Make Twilio service editable ...');
        const client = context.getTwilioClient();
        await client.serverless
          .services(service_sid)
          .update({uiEditable: true});

        console.log(THIS, 'Provisioning dependent Twilio services');
        const params = await getAllParams(context);
        //console.log(THIS, params);

        console.log(THIS, `Completed deployment of ${application_name}`);

        return callback(null, {
          service_sid: service_sid,
          service_status: 'DEPLOYED',
        });
      }
        break;

      case 'REDEPLOY': {
        await configureWebChat(context);

        const service_sid = await deployService(context, env);
        console.log(THIS, `Deployed: ${service_sid}`);

        console.log(THIS, 'Make Twilio service editable ...');
        const client = context.getTwilioClient();
        await client.serverless
          .services(service_sid)
          .update({uiEditable: true});

        console.log(THIS, 'Provisioning dependent Twilio services');
        const params = await getAllParams(context);
        //console.log(THIS, params);

        console.log(THIS, `Completed deployment of ${application_name}`);

        return callback(null, {
          service_sid: service_sid,
          service_status: 'REDEPLOYED',
        });
      }
        break;

      case 'UNDEPLOY': {
        const service_sid = await getParam(context, 'SERVICE_SID');
        const client = context.getTwilioClient();

        console.log('here');
        await client.serverless.services(service_sid).remove();
        console.log('there');

        return callback(null, {
          service_sid: service_sid,
          service_status: 'UNDEPLOYED',
        });
      }
        break;

      default: throw new Error(`unknown event.action=${action}`);
    }

  } catch(err) {
    console.log(err);
    return callback(err);
  } finally {
    console.timeEnd(THIS);
  }
}

/* --------------------------------------------------------------------------------
 * configure webchat-appConfig.js
 * --------------------------------------------------------------------------------
 */
async function configureWebChat(context) {
  console.log(process.cwd());
  const {assets} = await getListOfFunctionsAndAssets(
    process.cwd(),
    {
      functionsFolderNames: [],
      assetsFolderNames: ["assets"],
    });
  const webChatappConfigAsset = assets.filter(a => a.name.endsWith('webchat-appConfig.js'));

  // run only if react build is present in assets
  if (webChatappConfigAsset.length === 1) {
    console.log(webChatappConfigAsset[0]);

    const fdata = fs.readFileSync(webChatappConfigAsset[0].filePath, {encoding: 'utf8', flag: 'r+'});

    //console.log(fdata);
    const ACCOUNT_SID = await getParam(context, 'ACCOUNT_SID');
    const FLEX_WEB_FLOW_SID = await getParam(context, 'FLEX_WEB_FLOW_SID');
    console.log(ACCOUNT_SID, FLEX_WEB_FLOW_SID);
    const fdataReplacement = fdata
      .replace(/AC[0-9a-z]{32}/, ACCOUNT_SID)
      .replace(/FO[0-9a-z]{32}/, FLEX_WEB_FLOW_SID);
    //console.log(fdataReplacement);

    fs.writeFileSync(webChatappConfigAsset[0].filePath, fdataReplacement);
  }
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

  const indexHTMLs = assets.filter(asset => asset.name.includes('index.html'));
  // Set indext.html as a default document
  const allAssets = assets.concat(indexHTMLs.map(ih => ({
    ...ih,
    path: ih.name.replace("index.html", ""),
    name: ih.name.replace("index.html", ""),
  })));
  //console.log(allAssets);
  return allAssets;
}

async function deployService(context, envrionmentVariables = {}) {
  const client = context.getTwilioClient();

  const assets = await getAssets();
  console.log('asset count:' , assets.length);

  const { functions } = await getListOfFunctionsAndAssets(process.cwd(),{
    functionsFolderNames: ["functions"],
    assetsFolderNames: []
  });
  console.log('function count:' , functions.length);

  const pkgJsonRaw = fs.readFileSync(`${process.cwd()}/package.json`);
  const pkgJsonInfo = JSON.parse(pkgJsonRaw);
  const dependencies = pkgJsonInfo.dependencies;
  console.log('package.json loaded');

  const deployOptions = {
    env: {
      ...envrionmentVariables
    },
    pkgJson: {
      dependencies,
    },
    functionsEnv: 'dev',
    functions,
    assets,
  };
  console.log('deployOptions.env:', deployOptions.env);

  context['APPLICATION_NAME'] = envrionmentVariables.APPLICATION_NAME;
  let service_sid = await getParam(context, 'SERVICE_SID');
  if (service_sid) {
    // update service
    console.log('updating services ...');
    deployOptions.serviceSid = service_sid;
  } else {
    // create service
    console.log('creating services ...');
    deployOptions.serviceName = await getParam(context, 'APPLICATION_NAME');
  }

  const serverlessClient = new TwilioServerlessApiClient({
    username: client.username, // ACCOUNT_SID
    password: client.password, // AUTH_TOKEN
  });

  serverlessClient.on("status-update", evt => {
    console.log(evt.message);
  });

  await serverlessClient.deployProject(deployOptions);
  service_sid = await getParam(context, 'SERVICE_SID');

  return service_sid;
}
