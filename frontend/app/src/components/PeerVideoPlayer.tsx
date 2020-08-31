import React, { createRef } from "react";
import { Button } from "antd";

import "./PeerVideoPlayer.css";

type PeerVideoPlayerProps = {
  srcVideo?: MediaStream;
  id: string;
  username: string;
  videoEnabled: boolean;
  audioEnabled: boolean;
  screenSharingEnabled: boolean;
  toggleVideo: () => void;
  toggleAudio: () => void;
  toggleScreenSharing: () => void;
};

type PeerVideoPlayerState = {
  srcVideo?: MediaStream;
};

export class PeerVideoPlayer extends React.Component<
  PeerVideoPlayerProps,
  PeerVideoPlayerState
> {
  videoElement = createRef<HTMLVideoElement>();
  // canvasRef = createRef<HTMLCanvasElement>();

  constructor(props: PeerVideoPlayerProps) {
    super(props);
    this.state = { srcVideo: this.props.srcVideo };
  }

  componentDidMount() {
    if (this.videoElement.current && this.props.srcVideo) {
      this.videoElement.current.srcObject = this.props.srcVideo;
    }
  }

  componentDidUpdate(
    prevProps: PeerVideoPlayerProps,
    prevState: PeerVideoPlayerState
  ) {
    if (this.videoElement.current && this.props.srcVideo) {
      this.videoElement.current.srcObject = this.props.srcVideo;
      // let ctx = this.canvasRef.current?.getContext("2d");
      // ctx?.scale(-1,1);
    }
  }

  render() {
    return (
      <div
        style={{
          position: "relative",
          color: "white",
          paddingRight: "10px",
          maxHeight: "calc(100vh - 60px)",
        }}
      >
        <video
          ref={this.videoElement}
          className="video-container video-container-overlay"
          id={this.props.id}
          autoPlay={true}
          playsInline={true}
          controls={this.props.id === "me" ? false : true}
          muted={this.props.id === "me"}
          style={{
            width: "100%",
            height: "100%",
            backgroundColor: "#000",
            marginBottom: "0px",
            borderRadius: "7px",
          }}
        ></video>
        <div
          style={{
            borderRadius: "7px",
            position: "absolute",
            bottom: "8px",
            left: "4px",
            paddingRight: "4px",
            paddingLeft: "4px",
            backgroundColor: "#000",
          }}
        >
          {this.props.id === "me" ? "me" : this.props.username}
        </div>

        <div
          style={{
            display: `${this.props.id === "me" ? "inline" : "None"}`,
            position: "absolute",
            top: "4px",
            left: "4px",
          }}
        >
          <Button.Group>
            <Button
              size="small"
              onClick={() => {
                this.props.toggleVideo();
              }}
            >
              {this.props.videoEnabled ? "Disable video" : "Enable video"}
            </Button>
            <Button
              size="small"
              onClick={() => {
                this.props.toggleAudio();
              }}
            >
              {this.props.audioEnabled ? "Disable audio" : "Enable audio"}
            </Button>
            <Button
              size="small"
              onClick={() => {
                this.props.toggleScreenSharing();
              }}
            >
              {this.props.screenSharingEnabled
                ? "Disable screen sharing"
                : "Enable screen sharing"}
            </Button>
          </Button.Group>
        </div>
      </div>
    );
  }
}

export default PeerVideoPlayer;
