#!/bin/bash
set -e

if [[ -z ${TWILIO_ACCOUNT_SID} ]]; then echo 'TWILIO_ACCOUNT_SID unset!'; exit 1; fi
if [[ -z ${TWILIO_AUTH_TOKEN} ]];  then echo 'TWILIO_AUTH_TOKEN unset!'; exit 1; fi

function output {
  echo 'package-studio-flow.sh:' $1
}

# --------------------------------------------------------------------------------
# script to download studio flow and package
# --------------------------------------------------------------------------------
output 'packaging studio flow...'

STUDIO_FLOW_FNAME='hls-webchat'
output "STUDIO_FLOW_FNAME=${STUDIO_FLOW_FNAME}"

SERVICE_NAME=$(basename `pwd`)
output "SERVICE_NAME=${SERVICE_NAME}"

# ---------- retrieve service sid
SERVICE_SID=$(twilio api:serverless:v1:services:list -o=json \
| jq --raw-output ".[] | select(.friendlyName == \"${SERVICE_NAME}\") | .sid")
[[ -z ${SERVICE_SID} ]] && echo "unable to find studio flow named ${SERVICE_NAME}!!!. aborting..." && exit 1
output "SERVICE_SID=${SERVICE_SID}"

# ---------- retrieve service environment, should only be one
ENVIRONMENT=$(twilio api:serverless:v1:services:environments:list --service-sid ${SERVICE_SID} -o=json \
| jq --raw-output '.[0]')
ENVIRONMENT_SID=$(echo ${ENVIRONMENT} | jq --raw-output '.sid')
[[ -z ${ENVIRONMENT_SID} ]] && echo "unable to find environment for service named ${SERVICE_NAME}!!!. aborting..." && exit 1
output "ENVIRONMENT_SID=${ENVIRONMENT_SID}"

ENVIRONMENT_NAME=$(echo ${ENVIRONMENT} | jq --raw-output '.uniqueName')
output "ENVIRONMENT_NAME=${ENVIRONMENT_NAME}"

ENVIRONMENT_DOMAIN=$(echo ${ENVIRONMENT} | jq --raw-output '.domainName')
output "ENVIRONMENT_DOMAIN=${ENVIRONMENT_DOMAIN}"

# ---------- service function for 'selectable-chat-messages'
FUNCTION_FNAME='/selectable-chat-messages'
FUNCTION_SID=$(twilio api:serverless:v1:services:functions:list -o=json --service-sid ${SERVICE_SID} \
| jq --raw-output ".[] | select(.friendlyName == \"${FUNCTION_FNAME}\") | .sid")
[[ -z ${FUNCTION_SID} ]] && echo "unable to find service function named ${FUNCTION_FNAME}!!!. aborting..." && exit 1
output "FUNCTION_SID=${FUNCTION_SID}"

# ---------- taskrouter workspace
WORKSPACE_SID=$(twilio api:taskrouter:v1:workspaces:list -o=json \
| jq --raw-output '.[0].sid')
[[ -z ${WORKSPACE_SID} ]] && echo "unable to find taskrouter workspace!!!. aborting..." && exit 1
output "WORKSPACE_SID=${WORKSPACE_SID}"

# ---------- taskrouter workspace workflow for incoming chat
WORKFLOW_FNAME='Assign to Anyone'
WORKFLOW_SID=$(twilio api:taskrouter:v1:workspaces:workflows:list -o=json --workspace-sid ${WORKSPACE_SID} \
| jq --raw-output ".[] | select(.friendlyName == \"${WORKFLOW_FNAME}\") | .sid")
[[ -z ${WORKFLOW_SID} ]] && echo "unable to find taskrouter workspace workflow!!!. aborting..." && exit 1
output "WORKFLOW_SID=${WORKFLOW_SID}"

# ---------- taskrouter workspace task-channel for 'Programmable Chat'
TASK_CHANNEL_UNAME='chat'
TASK_CHANNEL_SID=$(twilio api:taskrouter:v1:workspaces:task-channels:list -o=json --workspace-sid ${WORKSPACE_SID} \
| jq --raw-output ".[] | select(.uniqueName == \"${TASK_CHANNEL_UNAME}\") | .sid")
[[ -z ${TASK_CHANNEL_SID} ]] && echo "unable to find taskrouter workspace task_channel for chat!!!. aborting..." && exit 1
output "TASK_CHANNEL_SID=${TASK_CHANNEL_SID}"

# ---------- retrieve flow sid
STUDIO_FLOW_SID=$(twilio api:studio:v2:flows:list -o=json \
| jq --raw-output ".[] | select(.friendlyName == \"${STUDIO_FLOW_FNAME}\") | .sid")
[[ -z "${STUDIO_FLOW_SID}" ]] && echo "unable to find studio flow named ${STUDIO_FLOW_FNAME}!!! aborting..." && exit 1
output "STUDIO_FLOW_SID=${STUDIO_FLOW_SID}"

# ---------- fetch flow definition json
twilio api:studio:v2:flows:fetch --sid ${STUDIO_FLOW_SID} -o=json \
| jq '.[0].definition' > studio-flow-definition.json
output "Studio flow definition saved to 'studio-flow-definition.json'"

# ---------- replace variables
output "replace ${SERVICE_SID}        -> YOUR_SERVICE_SID"
output "replace ${FUNCTION_SID}       -> YOUR_FUNCTION_SID"
output "replace ${ENVIRONMENT_SID}    -> YOUR_ENVIRONMENT_SID"
output "replace ${ENVIRONMENT_DOMAIN} -> YOUR_ENVIRONMENT_DOMAIN"
output "replace ${WORKFLOW_SID}       -> YOUR_WORKFLOW_SID"
output "replace ${TASK_CHANNEL_SID}   -> YOUR_TASK_CHANNEL_SID"

sed -i '.raw' \
-e "s/${SERVICE_SID}/YOUR_SERVICE_SID/g" \
-e "s/${FUNCTION_SID}/YOUR_FUNCTION_SID/g" \
-e "s/${ENVIRONMENT_SID}/YOUR_ENVIRONMENT_SID/g" \
-e "s/${ENVIRONMENT_DOMAIN}/YOUR_ENVIRONMENT_DOMAIN/g" \
-e "s/${WORKFLOW_SID}/YOUR_WORKFLOW_SID/g" \
-e "s/${TASK_CHANNEL_SID}/YOUR_TASK_CHANNEL_SID/g" \
studio-flow-definition.json

# ---------- save new definition over old
cp studio-flow-definition.json assets/installer/studio-flow-template.private.json

rm studio-flow-*.json*

echo
echo "packaged 'studio-flow-template.private.json' for flow.friendly_name=${STUDIO_FLOW_FNAME}"
echo
