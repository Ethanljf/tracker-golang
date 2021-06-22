package implementation

import (
  "io/ioutil"
  "log"
  "net/http"
  "strings"
  "github.com/nats-io/nats.go"
)

const NatsUrl string = os.Getenv("NATS_URL")
const NatsName string = os.Getenv("NATS_NAME")

type Result struct {
  Implementation: string
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

    resp, err := http.Get("https://"+domain)
   	if err != nil {
   		status := "No HTTPS"
   	} else if !strings.HasPrefix(resp.Request.URL.String(),"https") {
      status := "Downgrades HTTPS"
    } else {
      status := "Valid HTTPS"
    }

    res := Results{status}

    nc, err := nats.Connect(NatsUrl, nats.Name(NatsName))
  	if err != nil {
  		log.Fatalf("Error occurred while attempting to connect to nats: %s", err)
  	}

    ec, _ := nats.NewEncodedConn(nc, nats.JSON_ENCODER)
    defer ec.Close()

    ec.Publish("scans", res)
}

func main() {
  http.HandleFunc("/", scan)
  log.Fatal(http.ListenAndServe(":8080", nil))
}
