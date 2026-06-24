# Multi-stage build. One image builds all five service binaries; the SERVICE
# build-arg selects which binary the final image runs.
FROM golang:1.24-alpine AS build
ENV GOTOOLCHAIN=auto
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /out/server ./cmd/server

FROM gcr.io/distroless/static:nonroot
COPY --from=build /out/server /usr/local/bin/server
USER nonroot:nonroot
ENTRYPOINT ["/usr/local/bin/server"]
