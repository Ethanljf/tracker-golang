package implementation

import (
  "encoding/json"
  "io/ioutil"
  "log"
  "net/http"
  "strings"
)

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
   		implementation := "No HTTPS"
   	} else if !strings.HasPrefix(resp.Request.URL.String(),"https") {
      implementation := "Downgrades HTTPS"
    } else {
      implementation := "Valid HTTPS"
    }

    // TODO - Send data to queue
}

func main() {
  http.HandleFunc("/", scan)
  log.Fatal(http.ListenAndServe(":8080", nil))
}
