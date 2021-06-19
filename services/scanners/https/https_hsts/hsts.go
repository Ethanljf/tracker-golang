package hsts

import (
  "encoding/json"
  "io/ioutil"
  "log"
  "net/http"
  "strings"
  "strconv"
)

// One year
var MIN_HSTS_AGE int = 31536000

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

    hsts := "No HSTS"
    hstsMaxAge := 0
    preloaded := "HSTS Not Preloaded"

   	if err == nil {
      hstsHeader := resp.Header.Get("Strict-Transport-Security")

      if strings.Contains(hstsHeader, "max-age") {
        // "Strict-Transport-Security: max-age=31536000; includeSubDomains"
        // -> "max-age=31536000;"
        // -> "max-age=31536000"
        // -> 31536000
        maxAgeString := strings.Fields(hstsHeader)[1]
        maxAgeString = maxAgeString[:len(maxAgeString)-1]
        hstsMaxAge, err = strconv.Atoi(strings.Split(maxAgeString, "=")[1])

        if err != nil {
            log.Fatal(err)
            hstsMaxAge = 0
        }

        if hstsMaxAge >= MIN_HSTS_AGE {
          if strings.Contains(hstsHeader, "preload") {
              if strings.Contains(hstsHeader, "includeSubDomains") {
                hsts = "HSTS Fully Implemented"
                preloaded = "HSTS Preloaded"
              } else {
                hsts = "HSTS Not Including SubDomains"
              }
          }
        } else {
          hsts = "HSTS Max Age Too Short"
        }
      }
   	}

    // TODO - Send data to queue
}

func main() {
  http.HandleFunc("/", scan)
  log.Fatal(http.ListenAndServe(":8080", nil))
}
