package certificate

import (
  "io/ioutil"
  "log"
  "net/http"
  "crypto/tls"
  "time"
)

const NatsUrl string = os.Getenv("NATS_URL")
const NatsName string = os.Getenv("NATS_NAME")

type Result struct {
  CertExpired bool
  CertSelfSigned bool
  CertBadChain bool
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
    expired := false
    selfSigned := false

    conf := &tls.Config{
        InsecureSkipVerify: true,
    }

    conn, err := tls.Dial("tcp", domain+":443", conf)
    if err == nil {
      conn.Close()
      certs := conn.ConnectionState().PeerCertificates
      for _, cert := range certs {
          expired = expired || cert.NotAfter.After(currentTime)
          selfSigned = selfSigned ||
            cert.Issuer.CommonName==cert.Subject.CommonName
      }
    }

    res := Result{
      CertExpired: expired,
      CertSelfSigned: selfSigned,
      CertBadChain: expired || selfSigned
    }

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
