package version

import (
  "encoding/json"
  "io/ioutil"
  "log"
  "net/http"
  "strings"
  "crypto/tls"
  "github.com/nats-io/nats.go"
)

const TlsVersions = map[uint64]string{
  0x0300: "SSL3.0",
  0x0301: "TLS1.0",
  0x0302: "TLS1.1",
  0x0303: "TLS1.2",
  0x0304: "TLS1.3"
}
const NatsUrl string = os.Getenv("NATS_URL")
const NatsName string = os.Getenv("NATS_NAME")

type Result struct {
  TlsVersion: string
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

    res := Results{TlsVersions[version]}

    resultJson, err := json.Marshal(m)
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
