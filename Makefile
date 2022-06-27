# --------------------------------------------------------------------------------------------------------------
# FOR DEVELOPER USE ONLY!!!
# --------------------------------------------------------------------------------------------------------------

# ---------- check twilio credentials from environment variables
# when below 2 variables are set, it will be the 'active' profile of twilio cli
ifndef TWILIO_ACCOUNT_SID
$(info Lookup your "ACCOUNT SID" at https://console.twilio.com/)
$(info execute in your terminal, 'export TWILIO_ACCOUNT_SID=AC********************************')
$(error TWILIO_ACCOUNT_SID environment variable is not set)
endif

ifndef TWILIO_AUTH_TOKEN
$(info Lookup your "AUTH TOKEN" at https://console.twilio.com/)
$(info execute in your terminal, 'export TWILIO_AUTH_TOKEN=********************************')
$(info TWILIO_AUTH_TOKEN environment variable is not set)
endif


# ---------- variables
BLUEPRINT_NAME   := $(shell basename `pwd`)
SERVICE_NAME     := $(BLUEPRINT_NAME)
STUDIO_FLOW_NAME := hls-webchat
GIT_REPO_URL     := $(shell git config --get remote.origin.url)
VERSION          := $(shell jq --raw-output .version package.json)
INSTALLER_NAME   := twiliohls/hls-website-installer
CPU_HARDWARE     := $(shell uname -m)
DOCKER_EMULATION := $(shell [[ `uname -m` == "arm64" ]] && echo --platform linux/amd64)
$(info ================================================================================)
$(info BLUEPRINT_NAME     : $(BLUEPRINT_NAME))
$(info GIT_REPO_URL       : $(GIT_REPO_URL))
$(info INSTALLER_NAME     : $(INSTALLER_NAME))
$(info CPU_HARDWARE       : $(shell uname -m))
$(info DOCKER_EMULATION   : $(DOCKER_EMULATION))
$(info TWILIO_ACCOUNT_NAME: $(shell twilio api:core:accounts:fetch --sid=$(TWILIO_ACCOUNT_SID) --no-header --properties=friendlyName))
$(info TWILIO_ACCOUNT_SID : $(TWILIO_ACCOUNT_SID))
$(info TWILIO_AUTH_TOKEN  : $(shell echo $(TWILIO_AUTH_TOKEN) | sed 's/./*/g'))
$(info SERVICE_NAME       : $(SERVICE_NAME))
$(info STUDIO_FLOW_NAME   : $(STUDIO_FLOW_NAME))
$(info ================================================================================)


targets:
	@echo ----- avaiable make targets:
	@grep '^[A-Za-z0-9\-]*:' Makefile | cut -d ':' -f 1 | sort


installer-build-github:
	docker build --tag $(INSTALLER_NAME):$(VERSION) $(DOCKER_EMULATION) --no-cache $(GIT_REPO_URL)#main


installer-build-local:
	docker build --tag $(INSTALLER_NAME):$(VERSION) $(DOCKER_EMULATION) --no-cache .


installer-push:
	docker push $(INSTALLER_NAME):$(VERSION)
	open -a "Google Chrome" https://hub.docker.com/r/$(INSTALLER_NAME)


installer-run:
	docker run --name $(INSTALLER_NAME):$(VERSION) --rm --publish 3000:3000 $(DOCKER_EMULATION) \
	--env ACCOUNT_SID=$(TWILIO_ACCOUNT_SID) --env AUTH_TOKEN=$(TWILIO_AUTH_TOKEN) \
	--interactive --tty $(INSTALLER_NAME)


installer-open:
	@while [[ -z $(curl --silent --head http://localhost:3000/installer/index.html) ]]; do \
      sleep 2 \
      echo "installer not up yet..." \
    done
	open -a "Google Chrome" http://localhost:3000/installer/index.html


get-service-sid:
	$(eval SERVICE_SID := $(shell twilio api:serverless:v1:services:list -o=json \
	| jq --raw-output '.[] | select(.friendlyName == "$(SERVICE_NAME)") | .sid'))
	@if [[ ! -z "$(SERVICE_SID)" ]]; then \
      echo "SERVICE_SID=$(SERVICE_SID)"; \
    else \
	  echo "$@: Service named $(SERVICE_NAME) is not deployed!!! aborting..."; \
	fi
	@[[ ! -z "$(SERVICE_SID)" ]]


get-environment-sid: get-service-sid
	$(eval ENVIRONMENT_SID := $(shell twilio api:serverless:v1:services:environments:list --service-sid $(SERVICE_SID) -o=json \
	| jq --raw-output '.[0].sid'))
	$(eval ENVIRONMENT_NAME := $(shell twilio api:serverless:v1:services:environments:list --service-sid $(SERVICE_SID) -o=json \
	| jq --raw-output '.[0].uniqueName'))
	$(eval ENVIRONMENT_DOMAIN := $(shell twilio api:serverless:v1:services:environments:list --service-sid $(SERVICE_SID) -o=json \
	| jq --raw-output '.[0].domainName'))
	@if [[ ! -z "$(ENVIRONMENT_SID)" ]]; then \
	  echo "ENVIRONMENT_SID=$(ENVIRONMENT_SID)"; \
	  echo "ENVIRONMENT_NAME=$(ENVIRONMENT_NAME)"; \
	  echo "ENVIRONMENT_DOMAIN=$(ENVIRONMENT_DOMAIN)"; \
	else \
	  echo "$@: Environment for service named $(SERVICE_NAME) is not found!!! aborting..."; \
	fi
	@[[ ! -z "$(ENVIRONMENT_SID)" ]]


get-flow-sid:
	$(eval STUDIO_FLOW_SID := $(shell twilio api:studio:v2:flows:list -o=json \
	| jq --raw-output '.[] | select(.friendlyName == "$(STUDIO_FLOW_NAME)") | .sid'))
	@if [[ ! -z "$(STUDIO_FLOW_SID)" ]]; then \
      echo "STUDIO_FLOW_SID=$(STUDIO_FLOW_SID)"; \
    else \
	  echo "$@: Studio flow named $(STUDIO_FLOW_NAME) is not deployed!!! aborting..."; \
	fi
	@[[ ! -z "$(STUDIO_FLOW_SID)" ]]


get-flex-configuration:
	twilio api:flex:v1:configuration:fetch -o=json


get-flex-sid:
	$(eval FLEX_SID := $(shell twilio api:flex:v1:configuration:fetch -o=json \
	| jq '.[0].flexServiceInstanceSid'))
	@if [[ ! -z "$(FLEX_SID)" ]]; then \
	  echo "FLEX_SID=$(FLEX_SID)"; \
	else \
	  echo "$@: Flex instance not found in Twilio account $(TWILIO_ACCOUNT_NAME)!!! aborting..."; \
	fi
	@[[ ! -z "$(FLEX_SID)" ]]


get-flex-web-flow-sid:
	$(eval FLEX_WEB_FLOW_SID := $(shell twilio api:flex:v1:flex-flows:list -o=json \
	| jq --raw-output '.[] | select(.channelType == "web") | .sid'))
	@if [[ ! -z "$(FLEX_WEB_FLOW_SID)" ]]; then \
	  echo "FLEX_WEB_FLOW_SID=$(FLEX_WEB_FLOW_SID)"; \
	else \
	  echo "$@: Webchat Flex flow not found!!! aborting..."; \
	fi
	@[[ ! -z "$(FLEX_WEB_FLOW_SID)" ]]


clean:
	rm -rf node_modules/
	rm -rf app/node_modules/
	@echo "remove react build files/directory"
	rm -f -r app/build
	@echo "remove react build files in assets"
	git ls-files --others --exclude-standard | grep "^assets" | xargs rm -v


build: clean
	cd app && npm install
	cd app && npm run build
	@echo "copy react build files to assets"
	cp -r app/build/* assets/


make-service-editable: get-service-sid
	twilio api:serverless:v1:services:update --sid=$(SERVICE_SID) --ui-editable -o=json


deploy-service:
	rm .twiliodeployinfo

	twilio serverless:deploy --runtime node14 --override-existing-project


# separate make target needed to be abortable
confirm-delete:
	@read -p "Delete $(SERVICE_NAME) service? [y/n] " answer && [[ $${answer:-N} = y ]]


undeploy-service: get-service-sid confirm-delete
	twilio api:serverless:v1:services:remove --sid $(SERVICE_SID)
	rm -f .twiliodeployinfo


configure-webchat: get-flex-web-flow-sid
	@echo configuring assets/webchat-appConfig.js
	sed -i '' -e 's/accountSid: "AC[0-9a-f]*"/accountSid: "'$(TWILIO_ACCOUNT_SID)'"/' assets/webchat-appConfig.js
	sed -i '' -e 's/flexFlowSid: "FO[0-9a-f]*"/flexFlowSid: "'$(FLEX_WEB_FLOW_SID)'"/' assets/webchat-appConfig.js


configure-flex-flow: get-flex-web-flow-sid get-flow-sid
	@echo configuring flex -to- studio-flow
	twilio api:flex:v1:flex-flows:update --sid=$(FLEX_WEB_FLOW_SID) \
	--integration-type=studio \
	--integration.retry-count=3 \
	--integration.flow-sid=$(STUDIO_FLOW_SID)


package-flow:
	assets/installer/package-studio-flow.private.sh


deploy-flow:
	assets/installer/deploy-studio-flow.private.sh


undeploy-flow: get-flow-sid
	twilio api:studio:v2:flows:remove --sid $(STUDIO_FLOW_SID)


deploy-all: build configure-webchat deploy-service deploy-flow configure-flex-flow
	@echo deployed and configured!
	@echo If initial deployment, also execute "make make-service-editable"


run-app:
	cd app && npm install
	cd app && npm run start


run-serverless:
	npm install
	@if [[ ! -f .env.localhost ]]; then \
      echo ".env.localhost needs to be copied from .env and value set!!! aborting..."; \
    fi
	@[[ -f .env.localhost ]]
	twilio serverless:start --env=.env.localhost


tail-log: get-environment-sid
	twilio serverless:logs --service-sid=$(SERVICE_SID) --environment=$(ENVIRONMENT_SID) --tail
