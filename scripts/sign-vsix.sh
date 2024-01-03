#!/bin/bash

FILE_TO_SIGN=$(find . -maxdepth 1 -name '*.vsix' -print -quit)

if [ -z "$FILE_TO_SIGN" ]; then
    echo "Error: No .vsix file found in the current directory." >&2
    exit 1
fi

required_vars=("ARTIFACTORY_PASSWORD" "ARTIFACTORY_HOST" "ARTIFACTORY_USERNAME" "GARASIGN_USERNAME" "GARASIGN_PASSWORD")
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "Error: Environment variable $var is not set." >&2
        exit 1
    fi
done

logout_artifactory() {
    docker logout "${ARTIFACTORY_HOST}" > /dev/null 2>&1
    echo "logged out from artifactory"
}

trap logout_artifactory EXIT


echo "${ARTIFACTORY_PASSWORD}" | docker login "${ARTIFACTORY_HOST}" -u "${ARTIFACTORY_USERNAME}" --password-stdin > /dev/null 2>&1

if [ $? -ne 0 ]; then
    echo "Docker login failed" >&2
    exit 1
fi

docker run \
  --rm \
  -e GRS_CONFIG_USER1_USERNAME="${GARASIGN_USERNAME}" \
  -e GRS_CONFIG_USER1_PASSWORD="${GARASIGN_PASSWORD}" \
  -v "$(pwd):/tmp/workdir" \
  -w /tmp/workdir \
  ${ARTIFACTORY_HOST}/release-tools-container-registry-local/garasign-gpg \
  /bin/bash -c "gpgloader && gpg --yes -v --armor -o /tmp/workdir/${FILE_TO_SIGN}.sig --detach-sign /tmp/workdir/${FILE_TO_SIGN}"

if [ $? -ne 0 ]; then
    echo "Signing failed" >&2
    exit 1
fi
