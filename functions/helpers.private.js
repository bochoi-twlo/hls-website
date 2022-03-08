/* --------------------------------------------------------------------------------
 * common helper function used by functions
 *
 * behavior depends on deployment status of the service
 *
 * getAllParams(context)
 * getParam(context, key)
 * setParam(context, key, value) - when running on localhost, sets variable on deployed service
 *
 * include via:
 *   const { getAllParams, getParam, setParam } = require(Runtime.getFunctions()['helper'].path);
 *
 * --------------------------------------------------------------------------------
 */
const assert = require("assert");

/* --------------------------------------------------------------------------------
 * is executing on localhost
 * --------------------------------------------------------------------------------
 */
function isLocalhost(context) {
  return context.DOMAIN_NAME.startsWith('localhost:');
}

/* --------------------------------------------------------------------------------
 * assert executing on localhost
 * --------------------------------------------------------------------------------
 */
function assertLocalhost(context) {
  assert(context.DOMAIN_NAME.startsWith('localhost:'), `Can only run on localhost!!!`);
  assert(process.env.ACCOUNT_SID, 'ACCOUNT_SID not set in localhost environment!!!');
  assert(process.env.AUTH_TOKEN, 'AUTH_TOKEN not set in localhost environment!!!');
}


/* --------------------------------------------------------------------------------
 * sets environment variable on deployed service, does nothing on localhost
 * --------------------------------------------------------------------------------
 */
async function setParam(context, key, value) {
  if (context.DOMAIN_NAME.startsWith('localhost:')) return null; // do nothing on localhost
  if (context.service_sid) return null; // do nothing is service is not deployed
  const environment_sid = await getParam(context, 'ENVIRONMENT_SID');

  const client = context.getTwilioClient();

  const variables = await client.serverless
    .services(service_sid)
    .environments(environment_sid)
    .variables.list();
  let variable = variables.find(v => v.key === key);

  if (variable) {
    // update existing variable
    await client.serverless
      .services(service_sid)
      .environments(environment_sid)
      .variables(variable.sid)
      .update({ value })
      .then((v) => console.log('setParam: updated variable', v.key));
  } else {
    // create new variable
    await client.serverless
      .services(service_sid)
      .environments(environment_sid)
      .variables.create({ key, value })
      .then((v) => console.log('setParam: created variable', v.key));
  }

  context[key] = value;
  return {
    key: key,
    value: value
  };
}

/* --------------------------------------------------------------------------------
 * retrieve environment variable value
 *
 * parameters:
 * - context: Twilio Runtime context
 *
 * returns
 * - value of specified environment variable. Note that SERVICE_SID & ENVIRONMENT_SID will return 'null' if not yet deployed
 * --------------------------------------------------------------------------------
 */
async function getParam(context, key) {

  const client = context.getTwilioClient();
  try {
    switch (key) {

      case 'SERVICE_SID': {
        // will throw error when running on localhost, so lookup by name if localhost
        if (! isLocalhost(context) && context.SERVICE_SID) return context.SERVICE_SID;

        const services = await client.serverless.services.list();
        const service = services.find(s => s.uniqueName === context.APPLICATION_NAME);
        await setParam(context, key, service.sid);

        return (service && service.sid) ? service.sid : null;
      }

      case 'ENVIRONMENT_SID': {
        // will throw error when running on localhost, so lookup by name if localhost
        if (! isLocalhost(context) && context.ENVIRONMENT_SID) return context.ENVIRONMENT_SID;

        const service_sid = await getParam(context, 'SERVICE_SID');
        if (service_sid === null) {
          return null; // service not yet deployed
        }
        const environments = await client.serverless
          .services(service_sid)
          .environments.list({limit : 1});

        return environments.length > 0 ? environments[0].sid : null;
      }

      case 'ENVIRONMENT_DOMAIN': {
        // will throw error when running on localhost, so lookup by name if localhost
        const service_sid = await getParam(context, 'SERVICE_SID');
        if (service_sid === null) {
          return null; // service not yet deployed
        }
        const environment_sid = await getParam(context, 'ENVIRONMENT_SID');

        const environment = await client.serverless
          .services(service_sid)
          .environments(environment_sid)
          .fetch();

        return environment.domainName;
      }

      case 'VERIFY_SID': {
        // value set in .env takes precedence
        if (context.TWILIO_SYNC_SID) return context.TWILIO_SYNC_SID;

        const services = await client.verify.services.list();
        const service = services.find(s => s.friendlyName === context.APPLICATION_NAME);
        if (service) {
          await setParam(context, key, service.sid);
          return service.sid;
        }

        console.log('Verify service not found so creating a new verify service...');
        let sid = null;
        await client.verify.services
          .create({ friendlyName: context.APPLICATION_NAME })
          .then((result) => {
            sid = result.sid;
          })
          .catch(err => {
              throw new Error('Unable to create a Twilio Verify Service!!! ABORTING!!!');
          });
        await setParam(context, key, sid);

        return sid;
      }

      case 'FUNCTION_SID': {
        // will throw error when running on localhost, so lookup by name if localhost
        if (! isLocalhost(context) && context.FUNCTION_SID) return context.FUNCTION_SID;

        const SERVICE_SID = await getParam(context, 'SERVICE_SID');
        if (SERVICE_SID) {
          const functions = await client.serverless.services(SERVICE_SID).functions.list();
          const fn = functions.find(f => f.friendlyName.includes(context.FUNCTION_FNAME));
          if (! fn) throw new Error(`no service function named ${context.FUNCTION_NAME}`)
        } else {
          return null;
        }
      }

      case 'FLEX_SID': {
        // value set in .env takes precedence
        if (context.FLEX_SID) return context.FLEX_SID;

        const flex = await client.flexApi.v1.configuration().fetch();
        const sid = flex.flexServiceInstanceSid;

        assert(flex, `Flex instance not found in Twilio account: ${context.ACCOUNT_SID}!!!`);
        await setParam(context, key, sid);
        return sid;
      }

      case 'FLEX_WEB_FLOW_SID': {
        // value set in .env takes precedence
        if (context.FLEX_WEB_FLOW_SID) return context.FLEX_WEB_FLOW_SID;

        const flows = await client.flexApi.v1.flexFlow.list();
        const sid = flows.filter(f => f.channelType === 'web')[0].sid;

        assert(sid, `Flex web flow not found in Twilio account: ${context.ACCOUNT_SID}!!!`);
        await setParam(context, key, sid);
        return sid;
      }

      case 'FLEX_WORKSPACE_SID': {
        // value set in .env takes precedence
        if (context.FLEX_WORKSPACE_SID) return context.FLEX_WORKSPACE_SID;

        const flex = await client.flexApi.v1.configuration().fetch();
        const sid = flex.taskrouterWorkspaceSid;

        assert(sid, `Taskrouter Workspace Sid not found in Twilio account: ${context.ACCOUNT_SID}!!!`);
        await setParam(context, key, sid);
        return sid;
      }

      case 'FLEX_WORKFLOW_SID': {
        // value set in .env takes precedence
        if (context.FLEX_WORKFLOW_SID) return context.FLEX_WORKFLOW_SID;

        const STUDIO_FLOW_NAME = await getParam(context, 'STUDIO_FLOW_NAME');
        const flows = await client.studio.flows.list();
        const sid = flows.filter(f => f.friendlyName === STUDIO_FLOW_NAME)[0].sid;

        assert(sid, `Studio flow not found named ${STUDIO_FLOW_NAME}!!!`);
        //await setParam(context, key, sid);
        return sid;
      }

      case 'FLEX_TASK_CHANNEL_SID': {
        // value set in .env takes precedence
        if (context.FLEX_TASK_CHANNEL_SID) return context.FLEX_TASK_CHANNEL_SID;

        const STUDIO_FLOW_NAME = await getParam(context, 'STUDIO_FLOW_NAME');
        const flows = await client.studio.flows.list();
        const sid = flows.filter(f => f.friendlyName === STUDIO_FLOW_NAME)[0].sid;

        assert(sid, `Studio flow not found named ${STUDIO_FLOW_NAME}!!!`);
        //await setParam(context, key, sid);
        return sid;
      }

      case 'STUDIO_FLOW_SID': {
        // value set in .env takes precedence
        if (context.STUDIO_FLOW_SID) return context.STUDIO_FLOW_SID;

        const STUDIO_FLOW_NAME = await getParam(context, 'STUDIO_FLOW_NAME');
        const flows = await client.studio.flows.list();
        const sid = flows.filter(f => f.friendlyName === STUDIO_FLOW_NAME)[0].sid;

        assert(sid, `Studio flow not found named ${STUDIO_FLOW_NAME}!!!`);
        //await setParam(context, key, sid);
        return sid;
      }

      default:
        if (key in context) return context[key];

        throw new Error(`Undefined key: ${key}!!!`);
    }
  } catch (err) {
    console.log(err);
    throw err;
  }
}


/* --------------------------------------------------------------------------------
 * retrieve all environment variable value
 *
 * Note that SERVICE_SID & ENVIRONMENT_SID will return 'null' if not yet deployed
 *
 * parameters:
 * - context: Twilio Runtime context
 *
 * returns
 * - object of all environment variable values
 * --------------------------------------------------------------------------------
 */
async function getAllParams(context) {

  const keys_context = Object.keys(context);
  // keys defined in getParam function above
  const keys_derived = [];

  const keys_all = keys_context.concat(keys_derived).sort();
  try {

    const result = {};
    for (k of keys_all) {
      if (k === 'getTwilioClient') continue; // exclude getTwilioClient function
      result[k] = await getParam(context, k);
    }
    return result;

  } catch (err) {
    console.log(err);
    throw err;
  }
}


// --------------------------------------------------------------------------------
module.exports = {
  getAllParams,
  getParam,
  setParam,
  isLocalhost,
  assertLocalhost,
};
