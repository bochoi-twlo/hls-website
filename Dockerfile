# --------------------------------------------------------------------------------
# Dockerfile for local installer
# --------------------------------------------------------------------------------
FROM twilio/twilio-cli:3.2.0

RUN twilio plugins:install @twilio-labs/plugin-serverless

# build app
COPY app /app
WORKDIR /app
RUN npm install
RUN npm run build

# directory to copy/run application
WORKDIR /hls-installer

# copy github files needed for running locally
COPY Dockerfile package.json .env /hls-installer/
COPY assets /hls-installer/assets
COPY functions /hls-installer/functions
RUN cp -r /app/build/* /hls-installer/assets/

# install node dependencies in package.json
RUN npm install

# expose default port for running locally
EXPOSE 3000

CMD ["twilio", "serverless:start", "--load-local-env"]
