# foucault
diy self balanced personal bot

Run with `docker compose up`

## About

This is a group of docker services running on a Raspberry Pi.

containers:

- A* pathfinder + object avoidance
  Node 
- Camera feed + object detection
  Node + Tensorflow.js + Google Coral TPU
- PID balance control
  Node 
- Frontend Web
  Node.js + ExpressJs 
  web frontend for i/o communication with the world. 

- Mqtt broker
  queue messages for internal services communications
- node-exporter
  exports RPi stats to Prometheus
- cadvisor
  monitors container resource usage and performance
- Prometheus 
  collects metrics
- grafana
  visualizes metrics

## Access services

Grafana: http://foucault:3001 (default credentials: admin/admin).
Prometheus: http://foucault:9090.
cAdvisor: http://foucault:8080 (for real-time container stats).
Node Exporter metrics will be available to Prometheus at http://foucault:9100/metrics.

Configure Grafana:
Login to Grafana and add Prometheus as a data source:
URL: http://prometheus:9090
Import dashboards for Node Exporter and cAdvisor from Grafana Labs (you can search for existing dashboards like Node Exporter Full and cAdvisor).

TODO: add TPU stats  --> edgetpu_runtime --status

```mermaid
  graph TD;
    A*==>|Mqtt|Frontend;
    Camera==>|Mqtt|Frontend;
    PID<==>|Mqtt|Frontend;
    Frontend<-->|Web|User;

    RPi-.->|node-exporter|Prometheus;
    Docker-.->|cadvisor|Prometheus;
    Prometheus-.->Grafana;
    Grafana-->|Web|User;

```
  