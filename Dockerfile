FROM ubuntu:22.04
WORKDIR /app
COPY . .
CMD ["echo", "Custom image ready!"]
