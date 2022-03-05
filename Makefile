# --------------------------------------------------------------------------------------------------------------
# FOR DEVELOPER USE ONLY!!!
# --------------------------------------------------------------------------------------------------------------
SERVERLESS_NAME := $(shell basename `pwd`)
GIT_REPO_URL     := $(shell git config --get remote.origin.url)
INSTALLER_NAME   := hls-website-installer

# ---------- acquire twilio credentials from environment variables
ifndef TWILIO_ACCOUNT_SID
$(info TWILIO_ACCOUNT_SID environment variable is not set)
$(info Lookup your "ACCOUNT SID" at https://console.twilio.com/)
TWILIO_ACCOUNT_SID := $(shell read -p "Enter TWILIO_ACCOUNT_SID=" input && echo $$input)
$(info )
endif

ifndef TWILIO_AUTH_TOKEN
$(info TWILIO_AUTH_TOKEN environment variable is not set)
$(info Lookup your "AUTH TOKEN" at https://console.twilio.com/)
TWILIO_AUTH_TOKEN := $(shell read -p "Enter TWILIO_AUTH_TOKEN=" input && echo $$input)
$(info )
endif


$(info SERVERLESS_NAME    : $(SERVERLESS_NAME))
$(info GIT_REPO_URL       : $(GIT_REPO_URL))
$(info INSTALLER_NAME     : $(INSTALLER_NAME))
$(info TWILIO_ACCOUNT_NAME: $(shell twilio api:core:accounts:fetch --sid=$(TWILIO_ACCOUNT_SID) --no-header --properties=friendlyName))
$(info TWILIO_ACCOUNT_SID : $(TWILIO_ACCOUNT_SID))
$(info TWILIO_AUTH_TOKEN  : $(shell echo $(TWILIO_AUTH_TOKEN) | sed 's/./*/g'))

targets:
	@echo Make targets:
	@grep '^[A-Za-z0-9\-]*:' Makefile | cut -d ':' -f 1 | sort


installer-build-github:
	docker build --tag $(INSTALLER_NAME) --no-cache $(GIT_REPO_URL)#main


installer-build-local:
	docker build --tag $(INSTALLER_NAME) --no-cache .


installer-run:
	docker run --name $(INSTALLER_NAME) --rm --publish 3000:3000  \
	--env ACCOUNT_SID=$(TWILIO_ACCOUNT_SID) --env AUTH_TOKEN=$(TWILIO_ACCOUNT_SID) \
	--interactive --tty $(INSTALLER_NAME)


installer-open:
	@while [[ -z $(curl --silent --head http://localhost:3000/installer/index.html) ]]; do \
      sleep 2 \
      echo "installer not up yet..." \
    done
	open -a "Google Chrome" http://localhost:3000/installer/index.html


get-service-sid:
	$(eval SERVICE_SID := $(shell twilio api:serverless:v1:services:list -o=json \
	| jq --raw-output '.[] | select(.friendlyName == "$(SERVERLESS_NAME)") | .sid'))
	@echo "SERVICE_SID=$(SERVICE_SID)"
	@if [[ -z "$(SERVICE_SID)" ]]; then \
	  echo "Service named $(SERVERLESS_NAME) is not deployed!!!"; \
	fi


get-environment-sid: get-service-sid
	@if [[ -z "$(SERVICE_SID)" ]]; then \
	  echo "Service named $(SERVERLESS_NAME) is not deployed!!!"; \
	fi
	$(eval ENVIRONMENT_SID := $(shell twilio api:serverless:v1:services:environments:list --service-sid $(SERVICE_SID) -o=json \
	| jq --raw-output '.[0].sid'))
	@echo "ENVIRONMENT_SID=$(ENVIRONMENT_SID)"
	@if [[ -z "$(ENVIRONMENT_SID)" ]]; then \
	  echo "Environment for service named $(SERVERLESS_NAME) is not found!!!"; \
	fi


confirm-delete:
	@read -p "Delete $(SERVERLESS_NAME) functions service? [y/n] " answer && [ $${answer:-N} = y ]


delete: fetch-service-sid confirm-delete
	@curl -X DELETE https://serverless.twilio.com/v1/Services/$(SERVICE_SID) \
	--silent --user $(TWILIO_ACCOUNT_SID):$(TWILIO_AUTH_TOKEN) | jq .

	rm -f .twiliodeployinfo
	@echo ---------- "Deleted $(SERVERLESS_NAME) Functions Service"


clean:
	rm -f -r app/build


build: clean
	cd app && npm install
	cd app && npm run build
	cp -r app/build/* assets/


service-editable: get-service-sid
	twilio api:serverless:v1:services:update --sid=$(SERVICE_SID) --ui-editable -o=json


deploy: build service-editable
	npm install
	twilio serverless:deploy --runtime node14


run-frontend:
	cd app && npm install
	cd app && npm run start


run-backend:
	npm install
	if [[ ! -f .env.localhost ]]; then \
      echo ".env.localhost needs to be copied from .env and value set!!!"; \
    else \
	  twilio serverless:start --env=.env.localhost; \
	fi;


tail-log: get-environment-sid
	twilio serverless:logs --service-sid=$(SERVICE_SID) --environment=$(ENVIRONMENT_SID) --tail
