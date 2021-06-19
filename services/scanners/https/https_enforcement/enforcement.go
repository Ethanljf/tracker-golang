package enforcement

import (
  "fmt"
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

    // TODO - Send data to queue
}

func main() {
  http.HandleFunc("/", scan)
  log.Fatal(http.ListenAndServe(":8080", nil))
}
