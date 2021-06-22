package ciphers

import (
  "encoding/json"
  "io/ioutil"
  "log"
  "net/http"
  "strings"
  "crypto/tls"
  "github.com/nats-io/nats.go"
)

const NatsUrl string = os.Getenv("NATS_URL")
const NatsName string = os.Getenv("NATS_NAME")

type Result struct {
  UsedCiphers: []string
  StrongCiphers: []string
  AcceptableCiphers: []string
  WeakCiphers: []string
}

func scan(w http.ResponseWriter, r *http.Request) {
    defer r.Body.Close()
    body, err := ioutil.ReadAll(r.Body)

    if err != nil {
        log.Fatal(err)
    }

    var payload map[string]interface{}
    json.Unmarshal([]byte(body), &payload)

    domain := payload["domain"].(string)

    currentTime := time.Now()
    version := "None"

    conf := &tls.Config{
        InsecureSkipVerify: true,
    }

    conn, err := tls.Dial("tcp", domain+":443", conf)
    if err == nil {
      conn.Close()
      version = conn.ConnectionState().Version
    }

    res := Results{tlsVersion: version}

    resultJson, err := json.Marshal(res)
    if err != nil {
  		log.Fatalf("Error occurred while attempting to convert results to json byte array: %s", err)
  	}

    nc, err := nats.Connect(NatsUrl, nats.Name(NatsName))
  	if err != nil {
  		log.Fatalf("Error occurred while attempting to connect to nats: %s", err)
  	}
    nc.Publish("scans", resultJson)
}

func main() {
  http.HandleFunc("/", scan)
  log.Fatal(http.ListenAndServe(":8080", nil))
}
