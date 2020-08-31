import React from "react";
import { Switch, Route } from "react-router-dom";
import Conf from "./views/Conf";
import { CreateConference } from "./components/Conference";
import { RouteComponentProps, withRouter } from "react-router";
import { Layout } from "antd";

import "./App.css";

interface AppProps extends RouteComponentProps<any>, React.Props<any> {
  history: any;
}

type AppState = {};

class App extends React.Component<AppProps, AppState> {
  constructor(props: AppProps) {
    super(props);

    this.state = {};
  }

  render() {
    return (
      <div>
        <Layout
          style={{
            height: "100vh",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: "100%",
            }}
          >
            <Switch>
              <Route component={CreateConference} path="" />
              <Route path="/conf/:id" exact={true}>
                <Conf />
              </Route>
            </Switch>
          </div>
        </Layout>
      </div>
    );
  }
}

export default withRouter(App);
