package hsts

import (
  "encoding/json"
  "io/ioutil"
  "log"
  "net/http"
  "strings"
  "strconv"
  "github.com/nats-io/nats.go"
)

// One year
const MinHstsAge int = 31536000
const NatsUrl string = os.Getenv("NATS_URL")
const NatsName string = os.Getenv("NATS_NAME")

type Result struct {
  HstsStatus string
  HstsPreloaded bool
  HstsMaxAge int
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

    status := "No HSTS"
    maxAge := 0
    preloaded := false

   	if err == nil {
      hstsHeader := resp.Header.Get("Strict-Transport-Security")

      if strings.Contains(hstsHeader, "max-age") {
        // "Strict-Transport-Security: max-age=31536000; includeSubDomains"
        // -> "max-age=31536000;"
        // -> "max-age=31536000"
        // -> 31536000
        maxAgeString := strings.Fields(hstsHeader)[1]
        maxAgeString = maxAgeString[:len(maxAgeString)-1]
        maxAge, err = strconv.Atoi(strings.Split(maxAgeString, "=")[1])

        if err != nil {
            log.Fatal(err)
            maxAge = 0
        }

        if maxAge >= MinHstsAge {
          if strings.Contains(hstsHeader, "preload") {
              if strings.Contains(hstsHeader, "includeSubDomains") {
                status = "HSTS Fully Implemented"
                preloaded = true
              } else {
                status = "HSTS Not Including SubDomains"
              }
          }
        } else {
          status = "HSTS Max Age Too Short"
        }
      }
   	}

    res := Result{
      HstsStatus: status,
      HstsPreloaded: preloaded,
      HstsMaxAge: maxAge
    }

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
