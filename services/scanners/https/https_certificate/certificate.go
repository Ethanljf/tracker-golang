package certificate

import (
  "encoding/json"
  "io/ioutil"
  "log"
  "net/http"
  "crypto/tls"
  "time"
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

    currentTime := time.Now()
    certExpired := false
    certSelfSigned := false

    conf := &tls.Config{
        InsecureSkipVerify: true,
    }

    conn, err := tls.Dial("tcp", domain+":443", conf)
    if err == nil {
      conn.Close()
      certs := conn.ConnectionState().PeerCertificates
      for _, cert := range certs {
          certExpired = certExpired || cert.NotAfter.After(currentTime)
          certSelfSigned = certSelfSigned ||
            cert.Issuer.CommonName==cert.Subject.CommonName
      }
    }
    certBadChain := certExpired || certSelfSigned

    // TODO - Send data to queue
}

func main() {
  http.HandleFunc("/", scan)
  log.Fatal(http.ListenAndServe(":8080", nil))
}
