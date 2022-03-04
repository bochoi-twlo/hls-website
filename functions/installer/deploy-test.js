'use strict';
/* --------------------------------------------------------------------------------
 * deploys application (service) to target Twilio account.
 *
 * NOTE: that this function can only be run on localhost
 *
 * input:
 * event.action: CREATE|DELETE, defaults to CREATE
 * --------------------------------------------------------------------------------
 */
const assert = require("assert");
const path = require('path')
const { execSync } = require('child_process');
const { getParam } = require(Runtime.getFunctions()['helpers'].path);


exports.handler = async function(context, event, callback) {
  const THIS = 'deploy-ehr';

  assert(context.DOMAIN_NAME.startsWith('localhost:'), `Can only run on localhost!!!`);
  console.time(THIS);
  try {
    const action = event.action ? event.action : 'CREATE';

    switch (action) {

      case 'CREATE': {

        {
          let cmd = 'echo $PATH';
          execSync(cmd, {
            env: {'PATH': '/usr/gnu/bin:/usr/local/bin:/bin:/usr/bin:/Applications/Docker.app/Contents/Resources/bin/docker-compose-v1:/Applications/Docker.app/Contents/Resources/bin'},
            stdio: 'inherit'});

          cmd = '/usr/local/bin/docker-compose --version';
          execSync(cmd, {
            env: {'PATH': '/usr/gnu/bin:/usr/local/bin:/bin:/usr/bin:/Applications/Docker.app/Contents/Resources/bin/docker-compose-v1:/Applications/Docker.app/Contents/Resources/bin'},
            stdio: 'inherit'
          });

          cmd = 'docker-compose version';
          execSync(cmd, {
            shell: '/bin/bash',
            env: {'PATH': '/usr/gnu/bin:/usr/local/bin:/bin:/usr/bin:/Applications/Docker.app/Contents/Resources/bin/docker-compose-v1:/Applications/Docker.app/Contents/Resources/bin'},
            stdio: 'inherit'});
        }

        console.log(THIS, `HLS-EHR deployed successfully`);
      }
        break;

      case 'DELETE': {
        const deployed = execSync("docker ps --all | grep openemr_app | wc -l");
        if (deployed.toString().trim() != '1') throw new Error('HLS-EHR not deployed!!!');

        const fp = Runtime.getAssets()['/ehr/ehr-uninstall.sh'].path;
        execSync(fp, { shell: '/bin/bash', stdio: 'inherit' });
      }
        break;

      default:
        throw new Error(`unknown event.action=${action}`);
    }

    const deployed = await execSync("docker ps --all | grep openemr_app | wc -l");
    const response = {
      deploy_state  : deployed.toString().trim() === '1' ? 'DEPLOYED' : 'NOT-DEPLOYED',
    }
    console.log(THIS, response);
    return callback(null, response);

  } catch(err) {
    console.log(err);
    return callback(err);
  } finally {
    console.timeEnd(THIS);
  }
}
