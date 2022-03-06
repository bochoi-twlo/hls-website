# HLS Website

##### Table of Contents
- [Pre-requisites](#pre-requisites)
- [Installation Guide](#install)
- [User Guide](#use)
- [Developer Notes](#developer)

<a name="pre-requisites"/>

## Pre-requisites

The following prerequisites must be satisfied prior to installing the application.

### Docker Desktop

Install Docker desktop that includes docker compose CLI will be used to run the application installer locally on your machine.
Goto [Docker Desktop](https://www.docker.com/products/docker-desktop) and install with default options.
After installation make sure to start Docker desktop.

### jq & xq

```shell
$ brew install jq           # install jq
...
$ jq --version              # confirm installation
jq-1.6
$ brew install python-yq    # install yq/xq
...
$ yq --version              # confirm installation
yq 2.13.0
```


<a name="install"/>

## Installation Guide

Please ensure that you do not have any running processes
that is listening on port `3000`
such as development servers or another HLS installer still running.

#### Build Installer Docker Image

```shell
docker build --tag hls-website-installer --no-cache https://github.com/bochoi-twlo/hls-website.git#main
```

If running on Apple Silicon (M1 chip), add `--platform linux/amd64` option.

#### Run Installer Docker Container

Replace `${ACCOUNT_SID}` and `${AUTH_TOKEN}` with that of your target Twilio account.

```shell
docker run --name hls-website-installer --rm --publish 3000:3000  \
--env ACCOUNT_SID=${ACCOUNT_SID} --env AUTH_TOKEN=${AUTH_TOKEN} \
--interactive --tty hls-website-installer
```

If running on Apple Silicon (M1 chip), add `--platform linux/amd64` option.

#### Open installer in browser

Open http://localhost:3000/installer/index.html

#### Terminate installer

To terminate installer:
- Enter Control-C in the terminal where `docker run ...` was executed
- Stop the `hls-website-installer` docker container via the Docker Desktop


<a name="use"/>

## User Guide

Not special instructions.



<a name="developer"/>

# Developer Notes

Run `make` to see available targets.
