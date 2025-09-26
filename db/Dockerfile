FROM postgres:15-bullseye

RUN apt-get update \
  && apt-get install -y postgis \
  && rm -rf /var/lib/apt/lists/*
