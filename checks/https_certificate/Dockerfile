# COMPILE
FROM golang:1.15.6-alpine3.12 AS builder

ENV USER=scanner
ENV UID=10001

WORKDIR /https_certificate

RUN adduser \
    --disabled-password \
    --gecos "" \
    --home "/nonexistent" \
    --shell "/sbin/nologin" \
    --no-create-home \
    --uid "${UID}" \
    "${USER}"

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -o scan

# BUILD
FROM scratch

ENV USER=scanner

WORKDIR /usr/local/bin

# Import the user and group files from step 1
COPY --from=builder /etc/passwd /etc/passwd
COPY --from=builder /etc/group /etc/group
COPY --from=builder --chown=${USER}:${USER} /https_certificate/scan /usr/local/bin/scan

USER ${USER}:${USER}

ENTRYPOINT ["./scan"]
