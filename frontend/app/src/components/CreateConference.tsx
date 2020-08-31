import React, { Component } from "react";
import { Redirect } from "react-router-dom";

import { Row, Col, Button } from "antd";

import "antd/dist/antd.css";

//@ts-ignore
import {
  BrowserRouter as Router,
  Switch,
  Route,
  useParams,
} from "react-router-dom";
import PeerVideo from "./PeerVideo";

type CreateConferenceProps = {};

type CreateConferenceState = {
  roomurl?: string;
};

export class CreateConference extends Component<
  CreateConferenceProps,
  CreateConferenceState
> {
  constructor(props: CreateConferenceProps) {
    super(props);
    this.state = {};
  }

  createRoom = (e: React.MouseEvent<HTMLElement, MouseEvent>) => {
    // let endpoint = "https://127.0.0.1:8000/conf";
    let endpoint = `${process.env.REACT_APP_API_PROTOCOL}${process.env.REACT_APP_WSROOM_PATH}/conf`;

    console.log(endpoint);
    return fetch(endpoint, {
      method: "GET",
      headers: {
        // Authorization: `Bearer ${localStorage.getItem("token")}`,
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
      },
    })
      .then((resp) => {
        if (!resp.ok) {
          throw new Error(resp.statusText);
        }
        return resp.json();
      })
      .then((data) => {
        console.log("data", data.id);
        let conflink = `${window.location.origin.toString()}/conf/${data.id}`;

        this.setState({
          roomurl: conflink,
        });
      })
      .catch((error: Error) => {
        console.log("create room error:", error);
        return null;
      });
  };

  render() {
    return (
      <Router>
        <Switch>
          <Route path="/conf/new">
            <div style={{ height: "100vh" }}>
              <Row
                align="middle"
                style={{
                  margin: "30px",
                  position: "absolute",
                  textAlign: "center",
                }}
              >
                <Col xs={24} lg={8} style={{ textAlign: "left" }}>
                  <Button onClick={this.createRoom}>CREATE ROOM</Button>
                  <div style={{ marginTop: "20px" }}>
                    <h3>
                      <a href={this.state.roomurl}>{this.state.roomurl}</a>
                    </h3>
                  </div>
                </Col>
              </Row>
            </div>
          </Route>
          <Route path="/conf/:id">
            <Conf />
          </Route>
          <Redirect from="*" to="/conf/new" />
        </Switch>
      </Router>
    );
  }
}

function Conf() {
  let { id } = useParams();
  console.log("confId", id);
  let a;
  if (id) {
    a = <PeerVideo id={id} />;
  } else {
    a = <p>"not found"</p>;
  }
  return <div style={{ paddingLeft: "10px" }}>{a}</div>;
}
