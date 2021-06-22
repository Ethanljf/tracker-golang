package enforcement

import (
  "fmt"
  "io/ioutil"
  "log"
  "net/http"
  "strings"
  "github.com/nats-io/nats.go"
)

const NatsUrl string = os.Getenv("NATS_URL")
const NatsName string = os.Getenv("NATS_NAME")

type Result struct {
  EnforcementStatus string
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
    resp, err := http.Get("http://"+domain)

   	if err != nil {
   		fmt.Println(err)
   	}

    // If domain redirects from http to https, it is strictly enforced
    if strings.HasPrefix(resp.Request.URL.String(),"https") {
      enforcement := "Strict"
    } else {
      resp, err := http.Get("https://"+domain)
      // If domain downgrades from https, or can't be resolved with https prefix
      // then it is not enforced (unsupported)
     	if err != nil || !strings.HasPrefix(resp.Request.URL.String(),"https") {
     		enforcement := "Not Enforced"
      // If domain supports https but does not redirect from http to https,
      // its enforcement is considered to be "Moderate"
     	} else {
        enforcement := "Moderate"
      }
    }

    res := Result{enforcement}

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
