# Multi-stage build. One image builds all five service binaries; the SERVICE
# build-arg selects which binary the final image runs.
FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /out/gateway      ./cmd/gateway && \
    CGO_ENABLED=0 go build -o /out/pantry       ./cmd/pantry && \
    CGO_ENABLED=0 go build -o /out/recipe       ./cmd/recipe && \
    CGO_ENABLED=0 go build -o /out/nutrition    ./cmd/nutrition && \
    CGO_ENABLED=0 go build -o /out/gamification ./cmd/gamification

FROM alpine:3.20
RUN apk add --no-cache ca-certificates
COPY --from=build /out/ /usr/local/bin/
# SERVICE is overridden per service in docker-compose (gateway/pantry/...).
ARG SERVICE=gateway
ENV SERVICE=${SERVICE}
ENTRYPOINT ["/bin/sh", "-c", "exec /usr/local/bin/${SERVICE}"]
