# Postgres operator

The files in this folder are patches and additions to the base configuration stored in the bases folder.

Credentials needed for the app to run in dev mode are stored in Kubernetes secrets that are generated by kustomize from `.env` files. The following files will need to exist: 

## api.env

This file stores credentials for the api to talk to the database, notify and other auth related values.
An example:

```
$ cat api.env
DB_USER=track_dmarc
DB_PASS=somepassword
DB_HOST=postgres
DB_PORT=5432
DB_NAME=track_dmarc
BASE32_SECRET=somestring
SUPER_SECRET_KEY=anotherstring
SUPER_SECRET_SALT=yetanotherstring
NOTIFICATION_API_KEY=test_key-yournotify-test-key
NOTIFICATION_API_URL=https://api.notification.alpha.canada.ca
```

## kiali.env

[Kiali](https://kiali.io/) is an observabilty dashboard for Istio. It looks for a login credentials stored in a secret and uses those for the login credentials.
With minikube running and the app installed you can access kiali with the command `istioctl dashboard kiali`.

```
$ cat kiali.env
username=someuser
passphrase=somepasswordforkiali
```

## Istio config

The `istio.yaml` file in this folder is generated with the following command:

```sh
istioctl manifest generate --set values.kiali.enabled=true \
  --set values.tracing.enabled=true \
  --set values.pilot.traceSampling=100 \
  --set values.global.proxy.accessLogFile="/dev/stdout" > istio.yaml
```

## Running it

```bash
kustomize build . | kubectl apply -f -
```