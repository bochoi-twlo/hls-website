/* --------------------------------------------------------------------------------
 * common helper function used by functions
 *
 * behavior depends on deployment status of the service
 *
 * getParam(context, key)
 * setParam(context, key, value) - when running on localhost, sets variable on deployed service
 *
 * include via:
 *   const { getParam, setParam } = require(Runtime.getFunctions()['helper'].path);
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
  assert(context.APPLICATION_NAME         , "undefined .env environment variable APPLICATION_NAME!!!");
  assert(context.CUSTOMER_NAME            , "undefined .env environment variable CUSTOMER_NAME!!!");

  if (
    key !== "SERVICE_SID" && // avoid warning
    key !== "ENVIRONMENT_SID" && // avoid warning
    context[key]
  ) {
    return context[key]; // first return context non-null context value
  }

  const client = context.getTwilioClient();
  try {
    switch (key) {

      case 'SERVICE_SID':
      {
        const services = await client.serverless.services.list();
        const service = services.find(
          (s) => s.friendlyName === context.APPLICATION_NAME
        );

        if (service) await setParam(context, key, service.sid);
        return service ? service.sid : null;
      }

      case 'ENVIRONMENT_SID':
      {
        const service_sid = await getParam(context, 'SERVICE_SID');
        if (service_sid === null) return null; // service not yet deployed

        const environments = await client.serverless
          .services(service_sid)
          .environments.list({limit : 1});

        return environments.length > 0 ? environments[0].sid : null;
      }

      case 'ENVIRONMENT_DOMAIN': {
        const service_sid = await getParam(context, 'SERVICE_SID');
        if (service_sid === null) return null; // service not yet deployed

        const environments = await client.serverless
          .services(service_sid)
          .environments.list({limit : 1});

        return environments.length > 0 ? environments[0].domainName : null;
      }

      case 'FUNCTION_SID':
      {
        assert(context.FUNCTION_FNAME, "undefined .env environment variable FUNCTION_FNAME!!!");

        const service_sid = await getParam(context, 'SERVICE_SID');
        if (service_sid === null) return null; // service not yet deployed

        const functions = await client.serverless.services(service_sid).functions.list();
        const fn = functions.find(f => f.friendlyName.includes(context.FUNCTION_FNAME));
        if (! fn) throw new Error(`no service function named ${context.FUNCTION_FNAME}`)

        await setParam(context, key, fn.sid);
        return fn.sid;
      }

      case 'VERIFY_SID':
      {
        const services = await client.verify.services.list();
        let service = services.find((s) => s.friendlyName === context.APPLICATION_NAME);
        if (!service) {
          console.log(`Verify service not found so creating a new verify service friendlyName=${context.APPLICATION_NAME}`);
          service = await client.verify.services.create({
            friendlyName: context.APPLICATION_NAME,
          });
        }
        if (!service) throw new Error("Unable to create a Twilio Verify Service!!! ABORTING!!!");

        await setParam(context, key, service.sid);
        return service.sid;
      }

      case 'FLEX_SID':
      {
        const flex = await client.flexApi.v1.configuration().fetch();
        assert(flex, `Flex instance not found in Twilio account: ${context.ACCOUNT_SID}!!!`);

        await setParam(context, key, flex.flexServiceInstanceSid);
        return flex.flexServiceInstanceSid;
      }

      case 'FLEX_CHAT_SERVICE_SID':
      {
        assert(context.FLEX_CHAT_SERVICE_FNAME, "undefined .env environment variable FLEX_CHAT_SERVICE_FNAME!!!");

        const services = await client.chat.v2.services.list();
        const service = services.find(f => f.friendlyName === context.FLEX_CHAT_SERVICE_FNAME);
        assert(service, `Flex chat service not found in Twilio account: ${context.ACCOUNT_SID}!!!`);

        await setParam(context, key, service.sid);
        return service.sid;
      }

      case 'FLEX_WEB_FLOW_SID':
      {
        const FLEX_WEB_FLOW_FNAME = 'Flex Web Channel Flow';

        // look for existing legacy address
        const flows = await client.flexApi.v1.flexFlow.list();
        const flow = flows.find(f => f.channelType === 'web');
        if (flow) return flow.sid;

        console.log("No Legacy Address for web found.");

        // fetch studio flow for legacy address
        let studio_flow_sid = await getParam(context, 'STUDIO_FLOW_SID');
        if (!studio_flow_sid) {
          const sflows = await client.studio.flows.list();
          const sflow = sflows.find(f => f.friendlyName === 'Chat Flow');
          assert(sflow, `Flex WebChat Studio flow not found in Twilio account: ${context.ACCOUNT_SID}!!!`);
          studio_flow_sid = sflow.sid;
        }
        const chat_service_sid = await getParam(context, 'FLEX_CHAT_SERVICE_SID');
        console.log(`Create Legacy Address for web with friendlyName=${FLEX_WEB_FLOW_FNAME}.`);

        const newFlow = await client.flexApi.v1.flexFlow.create({
          friendlyName: FLEX_WEB_FLOW_FNAME,
          chatServiceSid: chat_service_sid,
          channelType: 'web',
          enabled: true,
          integrationType: 'studio',
          'integration.flowSid': studio_flow_sid,
          janitorEnabled: true,
        });
        if (!newFlow) throw new Error("Unable to create a Flex Legacy Address for web!!! ABORTING!!!");

        return newFlow.sid;
      }

      case 'FLEX_SMS_FLOW_SID':
      {
        const FLEX_SMS_FLOW_FNAME = 'Flex Messaging Channel Flow';

        // if not found, look for existing conversation address (2.0)
        const addresses = await client.conversations.addressConfigurations.list();
        const address = addresses.find(a => (a.type === 'sms' && a.friendlyName === FLEX_SMS_FLOW_FNAME));

        // if found, return conversation sid
        if (address) {
          console.log(`Remove Conversation Address friendlyName=${FLEX_SMS_FLOW_FNAME}`);
          return address.sid;
        }
        
        throw new Error("Unable to find sms conversations address!!! ABORTING!!!");
      }

      case 'FLEX_WORKSPACE_SID':
      {
        // TODO: Note that Flex messaging 'legacy addresses' will be EOL end of 2023 July
        const flex = await client.flexApi.v1.configuration().fetch();
        assert(flex, `Flex instance not found in Twilio account: ${context.ACCOUNT_SID}!!!`);

        assert(flex.taskrouterWorkspaceSid, `Taskrouter Workspace Sid not found in Twilio account: ${context.ACCOUNT_SID}!!!`);
        await setParam(context, key, flex.taskrouterWorkspaceSid);
        return flex.taskrouterWorkspaceSid;
      }

      case 'FLEX_WORKFLOW_SID':
      {
        const flex_workspace_sid = await getParam(context, 'FLEX_WORKSPACE_SID');
        const flows = await client.taskrouter.v1.workspaces(flex_workspace_sid)
          .workflows.list();
        const flow = flows.find(f => f.friendlyName === context.FLEX_WORKFLOW_FNAME);
        assert(flow, `Unable to find flex workspace workflow named ${context.FLEX_WORKFLOW_FNAME}`);

        await setParam(context, key, flow.sid);
        return flow.sid;
      }

      case 'FLEX_TASK_CHANNEL_SID':
      {
        const flex_workspace_sid = await getParam(context, 'FLEX_WORKSPACE_SID');
        const channels = await client.taskrouter.v1.workspaces(flex_workspace_sid)
          .taskChannels.list();
        const channel = channels.find(c => c.uniqueName === context.FLEX_TASK_CHANNEL_UNAME);
        assert(channel, `Unable to find flex workspace task channel for ${context.FLEX_TASK_CHANNEL_UNAME}`);

        await setParam(context, key, channel.sid);
        return channel.sid;
      }

      case 'STUDIO_FLOW_SID':
      {
        const STUDIO_FLOW_NAME = await getParam(context, 'STUDIO_FLOW_NAME');
        const flows = await client.studio.flows.list();
        const flow = flows.find(f => f.friendlyName === STUDIO_FLOW_NAME);

        if (flow) await setParam(context, key, flow.sid);
        return flow ? flow.sid : null;
      }

      default:
        throw new Error(`Undefined key: ${key}!!!`);
    }
  } catch (err) {
    console.log(err);
    throw err;
  }
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


// --------------------------------------------------------------------------------
module.exports = {
  getParam,
  setParam,
};
